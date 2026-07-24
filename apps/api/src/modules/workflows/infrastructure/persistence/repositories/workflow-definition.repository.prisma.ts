import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../../common/infrastructure/prisma/prisma.service';
import {
  ConflictError,
  NotFoundError,
} from '../../../../../common/domain/errors/domain-error';
import {
  WorkflowDefinition,
  WorkflowVersion,
} from '../../../domain/entities/workflow-definition.entity';
import type { RequestType } from '@prisma/client';
import {
  WorkflowDefinitionMapper,
  WorkflowVersionMapper,
} from '../mappers/workflow-definition.mapper';
import {
  type PageInput,
  type WorkflowDefinitionListFilters,
  type WorkflowDefinitionListPage,
  type WorkflowDefinitionRepositoryPort,
  type WorkflowVersionListFilters,
  type WorkflowVersionListPage,
  type WorkflowVersionRepositoryPort,
  WORKFLOW_DEFINITION_REPOSITORY,
  WORKFLOW_VERSION_REPOSITORY,
} from '../../../domain/repositories/workflow-definition.repository.port';

@Injectable()
export class WorkflowDefinitionPrismaRepository implements WorkflowDefinitionRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<WorkflowDefinition | null> {
    const row = await this.prisma.workflowDefinition.findUnique({
      where: { id },
    });
    return row ? WorkflowDefinitionMapper.toDomain(row) : null;
  }

  async findByKey(key: string): Promise<WorkflowDefinition | null> {
    const row = await this.prisma.workflowDefinition.findUnique({
      where: { key },
    });
    return row ? WorkflowDefinitionMapper.toDomain(row) : null;
  }

  async findLatestVersionPerDefinition(
    filters: WorkflowDefinitionListFilters,
  ): Promise<WorkflowDefinition[]> {
    // Fetch definitions first
    const defs = await this.prisma.workflowDefinition.findMany({
      where: this.buildWhere(filters),
      orderBy: { updatedAt: 'desc' },
    });
    return defs.map((d) => WorkflowDefinitionMapper.toDomain(d));
  }

  async findPublishedForRequestType(requestType: RequestType): Promise<{
    definition: WorkflowDefinition;
    publishedVersion: WorkflowVersion | null;
  } | null> {
    const definitionRow = await this.prisma.workflowDefinition.findFirst({
      where: {
        requestType,
        status: 'PUBLISHED',
      },
      orderBy: { updatedAt: 'desc' },
    });
    if (!definitionRow) return null;
    const versionRow = await this.prisma.workflowVersion.findFirst({
      where: {
        workflowDefinitionId: definitionRow.id,
        status: 'PUBLISHED',
      },
      orderBy: { versionNumber: 'desc' },
    });
    return {
      definition: WorkflowDefinitionMapper.toDomain(definitionRow),
      publishedVersion: versionRow
        ? WorkflowVersionMapper.toDomain(versionRow)
        : null,
    };
  }

  async list(
    filters: WorkflowDefinitionListFilters,
    page: PageInput,
  ): Promise<WorkflowDefinitionListPage> {
    const where = this.buildWhere(filters);
    const [rows, total] = await Promise.all([
      this.prisma.workflowDefinition.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page.page - 1) * page.pageSize,
        take: page.pageSize,
      }),
      this.prisma.workflowDefinition.count({ where }),
    ]);
    return {
      items: rows.map((r) => WorkflowDefinitionMapper.toDomain(r)),
      total,
      page: page.page,
      pageSize: page.pageSize,
    };
  }

  async save(definition: WorkflowDefinition): Promise<void> {
    const input = WorkflowDefinitionMapper.toCreateInput(definition);
    await this.prisma.workflowDefinition.upsert({
      where: { id: definition.id },
      create: input,
      update: WorkflowDefinitionMapper.toUpdateInput(definition),
    });
  }

  async delete(id: string): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) throw new NotFoundError('WorkflowDefinition', id);
    if (!existing.canBeDeleted()) {
      throw new ConflictError(
        `Cannot delete WorkflowDefinition ${id} in status ${existing.status}`,
      );
    }
    await this.prisma.workflowDefinition.delete({ where: { id } });
  }

  private buildWhere(
    filters: WorkflowDefinitionListFilters,
  ): Prisma.WorkflowDefinitionWhereInput {
    const where: Prisma.WorkflowDefinitionWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.requestType) where.requestType = filters.requestType;
    if (filters.key) where.key = filters.key;
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search } },
        { key: { contains: filters.search } },
      ];
    }
    return where;
  }
}

@Injectable()
export class WorkflowVersionPrismaRepository implements WorkflowVersionRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<WorkflowVersion | null> {
    const row = await this.prisma.workflowVersion.findUnique({
      where: { id },
    });
    return row ? WorkflowVersionMapper.toDomain(row) : null;
  }

  async findByChecksum(
    workflowDefinitionId: string,
    checksum: string,
  ): Promise<WorkflowVersion | null> {
    const row = await this.prisma.workflowVersion.findFirst({
      where: {
        workflowDefinitionId,
        checksum,
      },
    });
    return row ? WorkflowVersionMapper.toDomain(row) : null;
  }

  async findLatestForDefinition(
    workflowDefinitionId: string,
  ): Promise<WorkflowVersion | null> {
    const row = await this.prisma.workflowVersion.findFirst({
      where: { workflowDefinitionId },
      orderBy: { versionNumber: 'desc' },
    });
    return row ? WorkflowVersionMapper.toDomain(row) : null;
  }

  async findPublishedForDefinition(
    workflowDefinitionId: string,
  ): Promise<WorkflowVersion | null> {
    const row = await this.prisma.workflowVersion.findFirst({
      where: { workflowDefinitionId, status: 'PUBLISHED' },
      orderBy: { versionNumber: 'desc' },
    });
    return row ? WorkflowVersionMapper.toDomain(row) : null;
  }

  async findPublishedForRequestType(
    requestType: RequestType,
  ): Promise<WorkflowVersion | null> {
    const row = await this.prisma.workflowVersion.findFirst({
      where: {
        workflowDefinition: { requestType, status: 'PUBLISHED' },
        status: 'PUBLISHED',
      },
      orderBy: { versionNumber: 'desc' },
    });
    return row ? WorkflowVersionMapper.toDomain(row) : null;
  }

  async list(
    filters: WorkflowVersionListFilters,
    page: PageInput,
  ): Promise<WorkflowVersionListPage> {
    const where: Prisma.WorkflowVersionWhereInput = {};
    if (filters.workflowDefinitionId) {
      where.workflowDefinitionId = filters.workflowDefinitionId;
    }
    if (filters.status) where.status = filters.status;
    const [rows, total] = await Promise.all([
      this.prisma.workflowVersion.findMany({
        where,
        orderBy: [{ versionNumber: 'desc' }],
        skip: (page.page - 1) * page.pageSize,
        take: page.pageSize,
      }),
      this.prisma.workflowVersion.count({ where }),
    ]);
    return {
      items: rows.map((r) => WorkflowVersionMapper.toDomain(r)),
      total,
      page: page.page,
      pageSize: page.pageSize,
    };
  }

  async save(version: WorkflowVersion): Promise<void> {
    const input = WorkflowVersionMapper.toCreateInput(version);
    await this.prisma.workflowVersion.upsert({
      where: { id: version.id },
      create: input,
      update: WorkflowVersionMapper.toUpdateInput(version),
    });
  }

  async deleteDraft(id: string, _actorUserId: string): Promise<void> {
    void _actorUserId;
    const v = await this.findById(id);
    if (!v) throw new NotFoundError('WorkflowVersion', id);
    if (!v.isDraft) {
      throw new ConflictError(
        `Cannot delete version ${id} in status ${v.status}`,
      );
    }
    await this.prisma.workflowVersion.delete({ where: { id } });
  }
}

export const WORKFLOW_DEFINITION_REPOSITORY_PROVIDER = {
  provide: WORKFLOW_DEFINITION_REPOSITORY,
  useClass: WorkflowDefinitionPrismaRepository,
};

export const WORKFLOW_VERSION_REPOSITORY_PROVIDER = {
  provide: WORKFLOW_VERSION_REPOSITORY,
  useClass: WorkflowVersionPrismaRepository,
};
