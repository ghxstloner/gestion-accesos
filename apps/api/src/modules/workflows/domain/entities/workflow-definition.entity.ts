import { createHash, randomUUID } from 'node:crypto';
import {
  BusinessRuleError,
  ConflictError,
  ValidationError,
} from '../../../../common/domain/errors/domain-error';
import type {
  RequestType,
  WorkflowStatus,
} from '../../../../generated/prisma/client';
import type { WorkflowGraphDefinition } from '../workflow-definition.types';
import { GraphValidator } from '../graph-validator';

export interface WorkflowDefinitionProps {
  id: string;
  key: string;
  name: string;
  description: string | null;
  requestType: RequestType | null;
  status: WorkflowStatus;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowVersionProps {
  id: string;
  workflowDefinitionId: string;
  versionNumber: number;
  status: WorkflowStatus;
  schemaVersion: number;
  definitionJson: WorkflowGraphDefinition;
  checksum: string;
  createdByUserId: string;
  publishedByUserId: string | null;
  createdAt: Date;
  publishedAt: Date | null;
}

/**
 * WorkflowDefinition is the stable identity of a workflow. Multiple versions
 * hang off of it. The definition itself does not store the graph — only
 * WorkflowVersion does (immutable once published).
 */
export class WorkflowDefinition {
  private constructor(private readonly props: WorkflowDefinitionProps) {}

  static create(input: {
    key: string;
    name: string;
    description?: string | null;
    requestType?: RequestType | null;
    createdByUserId: string;
    now?: Date;
  }): WorkflowDefinition {
    const key = input.key?.trim();
    if (!key) throw new ValidationError('Workflow key is required');
    if (!/^[a-z0-9_]{3,100}$/i.test(key)) {
      throw new ValidationError(
        'Workflow key must be 3-100 chars of [a-z0-9_]',
      );
    }
    if (!input.name?.trim()) {
      throw new ValidationError('Workflow name is required');
    }
    const now = input.now ?? new Date();
    return new WorkflowDefinition({
      id: randomUUID(),
      key,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      requestType: input.requestType ?? null,
      status: 'DRAFT',
      createdByUserId: input.createdByUserId,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: WorkflowDefinitionProps): WorkflowDefinition {
    return new WorkflowDefinition(props);
  }

  get id() {
    return this.props.id;
  }
  get key() {
    return this.props.key;
  }
  get name() {
    return this.props.name;
  }
  get description() {
    return this.props.description;
  }
  get requestType() {
    return this.props.requestType;
  }
  get status() {
    return this.props.status;
  }
  get createdByUserId() {
    return this.props.createdByUserId;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get updatedAt() {
    return this.props.updatedAt;
  }

  canBeDeleted(): boolean {
    return this.props.status === 'DRAFT';
  }

  canHaveNewDraft(): boolean {
    // A definition may have at most ONE DRAFT version at a time.
    return this.props.status !== 'RETIRED';
  }

  rename(name: string, description?: string | null): void {
    if (this.props.status === 'RETIRED') {
      throw new BusinessRuleError('Cannot rename a retired workflow');
    }
    if (!name?.trim()) throw new ValidationError('Workflow name is required');
    this.props.name = name.trim();
    if (description !== undefined) {
      this.props.description = description.trim() || null;
    }
    this.props.updatedAt = new Date();
  }

  retire(): void {
    if (this.props.status === 'RETIRED') return;
    if (this.props.status === 'DRAFT') {
      throw new BusinessRuleError(
        'Cannot retire a DRAFT workflow — delete it instead',
      );
    }
    this.props.status = 'RETIRED';
    this.props.updatedAt = new Date();
  }

  toProps(): WorkflowDefinitionProps {
    return { ...this.props };
  }
}

/**
 * WorkflowVersion is the versioned, immutable-on-publish graph container.
 * DRAFT can be edited, PUBLISHED/RETIRED cannot.
 */
export class WorkflowVersion {
  private constructor(private readonly props: WorkflowVersionProps) {}

  static createDraft(input: {
    workflowDefinitionId: string;
    versionNumber: number;
    definitionJson: WorkflowGraphDefinition;
    createdByUserId: string;
    now?: Date;
  }): WorkflowVersion {
    if (input.versionNumber < 1) {
      throw new ValidationError('versionNumber must be >= 1');
    }
    GraphValidator.assertValid(input.definitionJson);
    const checksum = WorkflowVersion.computeChecksum(input.definitionJson);
    const now = input.now ?? new Date();
    return new WorkflowVersion({
      id: randomUUID(),
      workflowDefinitionId: input.workflowDefinitionId,
      versionNumber: input.versionNumber,
      status: 'DRAFT',
      schemaVersion: input.definitionJson.schemaVersion,
      definitionJson: input.definitionJson,
      checksum,
      createdByUserId: input.createdByUserId,
      publishedByUserId: null,
      createdAt: now,
      publishedAt: null,
    });
  }

  static reconstitute(props: WorkflowVersionProps): WorkflowVersion {
    return new WorkflowVersion(props);
  }

  /**
   * Deterministic sha256 of the canonical JSON serialization.
   * Changes to graph or ordering will alter the checksum, enabling
   * no-op publish detection.
   */
  static computeChecksum(graph: WorkflowGraphDefinition): string {
    const canonical = JSON.stringify({
      schemaVersion: graph.schemaVersion,
      nodes: (graph.nodes ?? [])
        .slice()
        .sort((a, b) => a.key.localeCompare(b.key))
        .map((n) => ({
          key: n.key,
          type: n.type,
          name: n.name,
          description: n.description ?? null,
          assignment: n.assignment ?? null,
          config: n.config ?? null,
        })),
      edges: (graph.edges ?? [])
        .slice()
        .sort((a, b) => {
          const l = `${a.from}->${a.to}:${a.action}`;
          const r = `${b.from}->${b.to}:${b.action}`;
          return l.localeCompare(r);
        })
        .map((e) => ({
          from: e.from,
          to: e.to,
          action: e.action,
          condition: e.condition ?? null,
          priority: e.priority ?? null,
        })),
    });
    return createHash('sha256').update(canonical).digest('hex');
  }

  get id() {
    return this.props.id;
  }
  get workflowDefinitionId() {
    return this.props.workflowDefinitionId;
  }
  get versionNumber() {
    return this.props.versionNumber;
  }
  get status() {
    return this.props.status;
  }
  get schemaVersion() {
    return this.props.schemaVersion;
  }
  get definitionJson() {
    return this.props.definitionJson;
  }
  get checksum() {
    return this.props.checksum;
  }
  get createdByUserId() {
    return this.props.createdByUserId;
  }
  get publishedByUserId() {
    return this.props.publishedByUserId;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get publishedAt() {
    return this.props.publishedAt;
  }
  get isDraft() {
    return this.props.status === 'DRAFT';
  }
  get isPublished() {
    return this.props.status === 'PUBLISHED';
  }
  get isRetired() {
    return this.props.status === 'RETIRED';
  }

  updateGraph(graph: WorkflowGraphDefinition): void {
    if (!this.isDraft) {
      throw new ConflictError(
        `WorkflowVersion ${this.id} is ${this.props.status} and cannot be edited`,
      );
    }
    GraphValidator.assertValid(graph);
    this.props.definitionJson = graph;
    this.props.schemaVersion = graph.schemaVersion;
    this.props.checksum = WorkflowVersion.computeChecksum(graph);
  }

  publish(publishedByUserId: string, now: Date = new Date()): void {
    if (!this.isDraft) {
      throw new ConflictError(
        `WorkflowVersion ${this.id} is already ${this.props.status}`,
      );
    }
    this.props.status = 'PUBLISHED';
    this.props.publishedByUserId = publishedByUserId;
    this.props.publishedAt = now;
  }

  retire(): void {
    if (this.props.status === 'DRAFT') {
      throw new BusinessRuleError('Cannot retire a DRAFT version');
    }
    if (this.props.status === 'RETIRED') return;
    this.props.status = 'RETIRED';
  }

  toProps(): WorkflowVersionProps {
    return {
      ...this.props,
      definitionJson: this.props.definitionJson,
    };
  }
}
