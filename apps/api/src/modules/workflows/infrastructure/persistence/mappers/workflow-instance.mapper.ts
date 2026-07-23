import { Prisma } from '../../../../../generated/prisma/client';
import {
  WorkflowInstance,
  WorkflowNodeInstance,
  WorkflowTask,
  WorkflowTransition,
  type WorkflowInstanceProps,
  type WorkflowNodeInstanceProps,
  type WorkflowTaskProps,
  type WorkflowTransitionProps,
} from '../../../domain/entities/workflow-instance.entity';
import type { EvaluationContext } from '../../../domain/workflow-definition.types';

type WorkflowInstanceRow = Prisma.WorkflowInstanceGetPayload<
  Record<string, unknown>
>;
type WorkflowNodeInstanceRow = Prisma.WorkflowNodeInstanceGetPayload<
  Record<string, unknown>
>;
type WorkflowTaskRow = Prisma.WorkflowTaskGetPayload<Record<string, unknown>>;
type WorkflowTransitionRow = Prisma.WorkflowTransitionGetPayload<
  Record<string, unknown>
>;

export class WorkflowInstanceMapper {
  static toDomain(row: WorkflowInstanceRow): WorkflowInstance {
    const ctx = (row.contextJson as unknown as EvaluationContext) ?? {};
    // currentNodeKey and autoTransitionCount are not model columns; recompute on read
    // by examining latest transition or default to null/0.
    // For persistence we store on a JSON metadata column inside contextJson when needed.
    type MetaAwareContext = EvaluationContext & {
      __meta?: { currentNodeKey?: string | null; autoTransitionCount?: number };
    };
    const meta = (ctx as MetaAwareContext).__meta ?? {};
    const props: WorkflowInstanceProps = {
      id: row.id,
      requestId: row.requestId,
      workflowVersionId: row.workflowVersionId,
      status: row.status,
      contextJson: stripMeta(ctx),
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      cancelledAt: row.cancelledAt,
      lockVersion: row.lockVersion,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      currentNodeKey: meta.currentNodeKey ?? null,
      autoTransitionCount: meta.autoTransitionCount ?? 0,
    };
    return WorkflowInstance.reconstitute(props);
  }

  static toUpsertInput(instance: WorkflowInstance): {
    create: Prisma.WorkflowInstanceUncheckedCreateInput;
    update: Prisma.WorkflowInstanceUncheckedUpdateInput;
  } {
    const p = instance.toProps();
    const merged: EvaluationContext = {
      ...p.contextJson,
      __meta: {
        currentNodeKey: p.currentNodeKey,
        autoTransitionCount: p.autoTransitionCount,
      },
    } as EvaluationContext;
    return {
      create: {
        id: p.id,
        requestId: p.requestId,
        workflowVersionId: p.workflowVersionId,
        status: p.status,
        contextJson: merged as unknown as Prisma.InputJsonValue,
        startedAt: p.startedAt,
        completedAt: p.completedAt,
        cancelledAt: p.cancelledAt,
        lockVersion: p.lockVersion,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      },
      update: {
        status: p.status,
        contextJson: merged as unknown as Prisma.InputJsonValue,
        completedAt: p.completedAt,
        cancelledAt: p.cancelledAt,
        lockVersion: p.lockVersion,
        updatedAt: p.updatedAt,
      },
    };
  }
}

function stripMeta(ctx: EvaluationContext): EvaluationContext {
  if (!ctx || typeof ctx !== 'object') return ctx;
  type MetaAwareContext = EvaluationContext & {
    __meta?: { currentNodeKey?: string | null; autoTransitionCount?: number };
  };
  const { __meta, ...rest } = ctx as MetaAwareContext;
  void __meta;
  return rest;
}

export class WorkflowNodeInstanceMapper {
  static toDomain(row: WorkflowNodeInstanceRow): WorkflowNodeInstance {
    const props: WorkflowNodeInstanceProps = {
      id: row.id,
      workflowInstanceId: row.workflowInstanceId,
      nodeKey: row.nodeKey,
      nodeType: row.nodeType,
      status: row.status,
      inputJson: row.inputJson as unknown as Record<string, unknown> | null,
      outputJson: row.outputJson as unknown as Record<string, unknown> | null,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      failedAt: row.failedAt,
      errorCode: row.errorCode,
      errorMessage: row.errorMessage,
      attemptNumber: row.attemptNumber,
    };
    return WorkflowNodeInstance.reconstitute(props);
  }

  static toUpsertInput(n: WorkflowNodeInstance): {
    create: Prisma.WorkflowNodeInstanceUncheckedCreateInput;
    update: Prisma.WorkflowNodeInstanceUncheckedUpdateInput;
  } {
    const p = n.toProps();
    return {
      create: {
        id: p.id,
        workflowInstanceId: p.workflowInstanceId,
        nodeKey: p.nodeKey,
        nodeType: p.nodeType,
        status: p.status,
        inputJson:
          (p.inputJson as unknown as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        outputJson:
          (p.outputJson as unknown as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        startedAt: p.startedAt,
        completedAt: p.completedAt,
        failedAt: p.failedAt,
        errorCode: p.errorCode,
        errorMessage: p.errorMessage,
        attemptNumber: p.attemptNumber,
      },
      update: {
        status: p.status,
        inputJson:
          (p.inputJson as unknown as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        outputJson:
          (p.outputJson as unknown as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        completedAt: p.completedAt,
        failedAt: p.failedAt,
        errorCode: p.errorCode,
        errorMessage: p.errorMessage,
        attemptNumber: p.attemptNumber,
      },
    };
  }
}

export class WorkflowTaskMapper {
  static toDomain(row: WorkflowTaskRow): WorkflowTask {
    const props: WorkflowTaskProps = {
      id: row.id,
      workflowInstanceId: row.workflowInstanceId,
      nodeInstanceId: row.nodeInstanceId,
      status: row.status,
      assignmentType: row.assignmentType,
      assignedUserId: row.assignedUserId,
      assignedRoleCode: row.assignedRoleCode,
      assignedCompanyId: row.assignedCompanyId,
      claimedByUserId: row.claimedByUserId,
      dueAt: row.dueAt,
      completedByUserId: row.completedByUserId,
      completedAt: row.completedAt,
      outcome: row.outcome as WorkflowTask['outcome'],
      comment: row.comment,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
    return WorkflowTask.reconstitute(props);
  }

  static toUpsertInput(t: WorkflowTask): {
    create: Prisma.WorkflowTaskUncheckedCreateInput;
    update: Prisma.WorkflowTaskUncheckedUpdateInput;
  } {
    const p = t.toProps();
    return {
      create: {
        id: p.id,
        workflowInstanceId: p.workflowInstanceId,
        nodeInstanceId: p.nodeInstanceId,
        status: p.status,
        assignmentType: p.assignmentType,
        assignedUserId: p.assignedUserId,
        assignedRoleCode: p.assignedRoleCode,
        assignedCompanyId: p.assignedCompanyId,
        claimedByUserId: p.claimedByUserId,
        dueAt: p.dueAt,
        completedByUserId: p.completedByUserId,
        completedAt: p.completedAt,
        outcome: p.outcome,
        comment: p.comment,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      },
      update: {
        status: p.status,
        claimedByUserId: p.claimedByUserId,
        completedByUserId: p.completedByUserId,
        completedAt: p.completedAt,
        outcome: p.outcome,
        comment: p.comment,
        updatedAt: p.updatedAt,
      },
    };
  }
}

export class WorkflowTransitionMapper {
  static toDomain(row: WorkflowTransitionRow): WorkflowTransition {
    const props: WorkflowTransitionProps = {
      id: row.id,
      workflowInstanceId: row.workflowInstanceId,
      sourceNodeKey: row.sourceNodeKey,
      targetNodeKey: row.targetNodeKey,
      action: row.action,
      actorUserId: row.actorUserId,
      taskId: row.taskId,
      idempotencyKey: row.idempotencyKey,
      metadataJson: row.metadataJson as unknown as Record<
        string,
        unknown
      > | null,
      createdAt: row.createdAt,
    };
    return WorkflowTransition.reconstitute(props);
  }

  static toCreateInput(
    t: WorkflowTransition,
  ): Prisma.WorkflowTransitionUncheckedCreateInput {
    const p = t.toProps();
    return {
      id: p.id,
      workflowInstanceId: p.workflowInstanceId,
      sourceNodeKey: p.sourceNodeKey,
      targetNodeKey: p.targetNodeKey,
      action: p.action,
      actorUserId: p.actorUserId,
      taskId: p.taskId,
      idempotencyKey: p.idempotencyKey,
      metadataJson: p.metadataJson
        ? (p.metadataJson as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      createdAt: p.createdAt,
    };
  }
}
