import { Inject, Injectable } from '@nestjs/common';
import {
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../common/domain/errors/domain-error';
import type { AuthenticatedUser } from '../../../common/presentation/decorators/authenticated-user';
import type { RequestType } from '../../../generated/prisma/client';
import {
  WorkflowDefinition,
  WorkflowVersion,
} from '../domain/entities/workflow-definition.entity';
import {
  WORKFLOW_DEFINITION_REPOSITORY,
  WORKFLOW_VERSION_REPOSITORY,
  type WorkflowDefinitionListFilters,
  type WorkflowDefinitionRepositoryPort,
  type WorkflowVersionRepositoryPort,
  type PageInput,
} from '../domain/repositories/workflow-definition.repository.port';
import type { WorkflowGraphDefinition } from '../domain/workflow-definition.types';

const MANAGE_ROLES = new Set(['SYSTEM_ADMIN', 'COMPANY_ADMIN']);

function assertCanManage(actor: AuthenticatedUser): void {
  const allowed = actor.roles.some((r) => MANAGE_ROLES.has(r));
  if (!allowed) {
    throw new ForbiddenError(
      'Only SYSTEM_ADMIN or COMPANY_ADMIN can manage workflow definitions',
    );
  }
}

export interface CreateWorkflowDefinitionInput {
  key: string;
  name: string;
  description?: string | null;
  requestType?: RequestType | null;
}

export interface UpdateWorkflowDefinitionInput {
  name?: string;
  description?: string | null;
}

export interface ListWorkflowDefinitionsInput
  extends Partial<WorkflowDefinitionListFilters>, PageInput {}

export interface CreateDraftInput {
  definitionJson: WorkflowGraphDefinition;
}

export interface UpdateDraftInput {
  definitionJson: WorkflowGraphDefinition;
}

@Injectable()
export class WorkflowDefinitionService {
  constructor(
    @Inject(WORKFLOW_DEFINITION_REPOSITORY)
    private readonly definitions: WorkflowDefinitionRepositoryPort,
    @Inject(WORKFLOW_VERSION_REPOSITORY)
    private readonly versions: WorkflowVersionRepositoryPort,
  ) {}

  /* ── Definitions ── */

  async create(
    input: CreateWorkflowDefinitionInput,
    actor: AuthenticatedUser,
  ): Promise<WorkflowDefinition> {
    assertCanManage(actor);
    const existing = await this.definitions.findByKey(input.key);
    if (existing) {
      throw new ConflictError(
        `Workflow definition with key '${input.key}' already exists`,
      );
    }
    const def = WorkflowDefinition.create({
      key: input.key,
      name: input.name,
      description: input.description ?? null,
      requestType: input.requestType ?? null,
      createdByUserId: actor.userId,
    });
    await this.definitions.save(def);
    return def;
  }

  async findById(id: string): Promise<WorkflowDefinition> {
    const def = await this.definitions.findById(id);
    if (!def) throw new NotFoundError('WorkflowDefinition', id);
    return def;
  }

  async findByKey(key: string): Promise<WorkflowDefinition> {
    const def = await this.definitions.findByKey(key);
    if (!def) throw new NotFoundError('WorkflowDefinition', key);
    return def;
  }

  async list(input: ListWorkflowDefinitionsInput): Promise<{
    items: WorkflowDefinition[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    return this.definitions.list(
      {
        status: input.status,
        requestType: input.requestType,
        key: input.key,
        search: input.search,
      },
      { page: input.page, pageSize: input.pageSize },
    );
  }

  async update(
    id: string,
    patch: UpdateWorkflowDefinitionInput,
    actor: AuthenticatedUser,
  ): Promise<WorkflowDefinition> {
    assertCanManage(actor);
    const def = await this.findById(id);
    if (patch.name === undefined && patch.description === undefined) {
      throw new ValidationError('At least one field must be provided');
    }
    def.rename(patch.name ?? def.name, patch.description);
    await this.definitions.save(def);
    return def;
  }

  async retire(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<WorkflowDefinition> {
    assertCanManage(actor);
    const def = await this.findById(id);
    def.retire();
    await this.definitions.save(def);
    // Cascade: retire any PUBLISHED version too.
    const published = await this.versions.findPublishedForDefinition(id);
    if (published) {
      published.retire();
      await this.versions.save(published);
    }
    return def;
  }

  async delete(id: string, actor: AuthenticatedUser): Promise<void> {
    assertCanManage(actor);
    const def = await this.findById(id);
    if (!def.canBeDeleted()) {
      throw new BusinessRuleError(
        `WorkflowDefinition ${id} is ${def.status} and cannot be deleted`,
      );
    }
    await this.definitions.delete(id);
  }

  /* ── Versions ── */

  async createDraft(
    definitionId: string,
    input: CreateDraftInput,
    actor: AuthenticatedUser,
  ): Promise<WorkflowVersion> {
    assertCanManage(actor);
    const def = await this.findById(definitionId);
    if (!def.canHaveNewDraft()) {
      throw new BusinessRuleError(
        `WorkflowDefinition ${definitionId} is ${def.status} and cannot accept new drafts`,
      );
    }
    // Reject if there is already a DRAFT version for this definition.
    const latest = await this.versions.findLatestForDefinition(definitionId);
    if (latest && latest.isDraft) {
      throw new ConflictError(
        `WorkflowDefinition ${definitionId} already has an open DRAFT version (${latest.id})`,
      );
    }
    const nextVersionNumber = latest ? latest.versionNumber + 1 : 1;
    const draft = WorkflowVersion.createDraft({
      workflowDefinitionId: definitionId,
      versionNumber: nextVersionNumber,
      definitionJson: input.definitionJson,
      createdByUserId: actor.userId,
    });
    await this.versions.save(draft);
    return draft;
  }

  async findVersionById(versionId: string): Promise<WorkflowVersion> {
    const v = await this.versions.findById(versionId);
    if (!v) throw new NotFoundError('WorkflowVersion', versionId);
    return v;
  }

  async listVersions(
    definitionId: string,
    page: PageInput,
  ): Promise<{
    items: WorkflowVersion[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    return this.versions.list(
      { workflowDefinitionId: definitionId },
      { page: page.page, pageSize: page.pageSize },
    );
  }

  async updateDraft(
    versionId: string,
    input: UpdateDraftInput,
    actor: AuthenticatedUser,
  ): Promise<WorkflowVersion> {
    assertCanManage(actor);
    const v = await this.findVersionById(versionId);
    v.updateGraph(input.definitionJson);
    await this.versions.save(v);
    return v;
  }

  /** Publish idempotently — if checksum matches an existing PUBLISHED version, return it. */
  async publish(
    versionId: string,
    actor: AuthenticatedUser,
  ): Promise<WorkflowVersion> {
    assertCanManage(actor);
    const v = await this.findVersionById(versionId);
    if (!v.isDraft) {
      throw new ConflictError(
        `WorkflowVersion ${versionId} is ${v.status} and cannot be published`,
      );
    }
    // Idempotency: if a PUBLISHED version with the same checksum exists, refuse.
    const same = await this.versions.findByChecksum(
      v.workflowDefinitionId,
      v.checksum,
    );
    if (same && same.isPublished) {
      throw new ConflictError(
        `An identical graph is already published as version ${same.versionNumber}`,
      );
    }
    v.publish(actor.userId);
    await this.versions.save(v);
    return v;
  }

  async retireVersion(
    versionId: string,
    actor: AuthenticatedUser,
  ): Promise<WorkflowVersion> {
    assertCanManage(actor);
    const v = await this.findVersionById(versionId);
    v.retire();
    await this.versions.save(v);
    return v;
  }

  async deleteDraft(
    versionId: string,
    actor: AuthenticatedUser,
  ): Promise<void> {
    assertCanManage(actor);
    const v = await this.findVersionById(versionId);
    if (!v.isDraft) {
      throw new BusinessRuleError(
        `WorkflowVersion ${versionId} is ${v.status} and cannot be deleted`,
      );
    }
    await this.versions.deleteDraft(versionId, actor.userId);
  }
}
