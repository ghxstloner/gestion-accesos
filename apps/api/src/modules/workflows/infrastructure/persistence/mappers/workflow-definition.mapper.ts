import type { Prisma } from '@prisma/client';
import {
  WorkflowDefinition,
  WorkflowVersion,
} from '../../../domain/entities/workflow-definition.entity';
import {
  WORKFLOW_SCHEMA_VERSION,
  type WorkflowGraphDefinition,
} from '../../../domain/workflow-definition.types';

type WorkflowDefinitionRow = Prisma.WorkflowDefinitionGetPayload<
  Record<string, unknown>
>;
type WorkflowVersionRow = Prisma.WorkflowVersionGetPayload<
  Record<string, unknown>
>;

export class WorkflowDefinitionMapper {
  static toDomain(row: WorkflowDefinitionRow): WorkflowDefinition {
    return WorkflowDefinition.reconstitute({
      id: row.id,
      key: row.key,
      name: row.name,
      description: row.description,
      requestType: row.requestType,
      status: row.status,
      createdByUserId: row.createdByUserId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  static toCreateInput(
    d: WorkflowDefinition,
  ): Prisma.WorkflowDefinitionUncheckedCreateInput {
    const p = d.toProps();
    return {
      id: p.id,
      key: p.key,
      name: p.name,
      description: p.description,
      requestType: p.requestType,
      status: p.status,
      createdByUserId: p.createdByUserId,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }

  static toUpdateInput(
    d: WorkflowDefinition,
  ): Prisma.WorkflowDefinitionUncheckedUpdateInput {
    const p = d.toProps();
    return {
      key: p.key,
      name: p.name,
      description: p.description,
      requestType: p.requestType,
      status: p.status,
      updatedAt: p.updatedAt,
    };
  }
}

export class WorkflowVersionMapper {
  static toDomain(row: WorkflowVersionRow): WorkflowVersion {
    return WorkflowVersion.reconstitute({
      id: row.id,
      workflowDefinitionId: row.workflowDefinitionId,
      versionNumber: row.versionNumber,
      status: row.status,
      schemaVersion: row.schemaVersion,
      definitionJson: row.definitionJson as unknown as WorkflowGraphDefinition,
      checksum: row.checksum,
      createdByUserId: row.createdByUserId,
      publishedByUserId: row.publishedByUserId,
      createdAt: row.createdAt,
      publishedAt: row.publishedAt,
    });
  }

  static toCreateInput(
    v: WorkflowVersion,
  ): Prisma.WorkflowVersionUncheckedCreateInput {
    const p = v.toProps();
    return {
      id: p.id,
      workflowDefinitionId: p.workflowDefinitionId,
      versionNumber: p.versionNumber,
      status: p.status,
      schemaVersion: p.schemaVersion ?? WORKFLOW_SCHEMA_VERSION,
      definitionJson: p.definitionJson as unknown as Prisma.InputJsonValue,
      checksum: p.checksum,
      createdByUserId: p.createdByUserId,
      publishedByUserId: p.publishedByUserId,
      createdAt: p.createdAt,
      publishedAt: p.publishedAt,
    };
  }

  static toUpdateInput(
    v: WorkflowVersion,
  ): Prisma.WorkflowVersionUncheckedUpdateInput {
    const p = v.toProps();
    return {
      status: p.status,
      schemaVersion: p.schemaVersion,
      definitionJson: p.definitionJson as unknown as Prisma.InputJsonValue,
      checksum: p.checksum,
      publishedByUserId: p.publishedByUserId,
      publishedAt: p.publishedAt,
    };
  }
}
