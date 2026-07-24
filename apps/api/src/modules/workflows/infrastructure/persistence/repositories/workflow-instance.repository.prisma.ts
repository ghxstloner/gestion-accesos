import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../../common/infrastructure/prisma/prisma.service';
import {
  ConflictError,
  NotFoundError,
} from '../../../../../common/domain/errors/domain-error';
import {
  WorkflowInstance,
  WorkflowNodeInstance,
  WorkflowTask,
  WorkflowTransition,
} from '../../../domain/entities/workflow-instance.entity';
import {
  TASK_INCLUDE,
  type WorkflowExecutionCommit,
  type WorkflowInstanceRepositoryPort,
  type WorkflowTaskListFilters,
  type WorkflowTaskListPage,
  type WorkflowTransactionClient,
  WORKFLOW_INSTANCE_REPOSITORY,
} from '../../../domain/repositories/workflow-instance.repository.port';
import {
  WorkflowInstanceMapper,
  WorkflowNodeInstanceMapper,
  WorkflowTaskMapper,
  WorkflowTransitionMapper,
} from '../mappers/workflow-instance.mapper';

@Injectable()
export class WorkflowInstancePrismaRepository implements WorkflowInstanceRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<WorkflowInstance | null> {
    const row = await this.prisma.workflowInstance.findUnique({
      where: { id },
    });
    return row ? WorkflowInstanceMapper.toDomain(row) : null;
  }

  async findByRequestId(requestId: string): Promise<WorkflowInstance | null> {
    const row = await this.prisma.workflowInstance.findUnique({
      where: { requestId },
    });
    return row ? WorkflowInstanceMapper.toDomain(row) : null;
  }

  async save(instance: WorkflowInstance): Promise<void> {
    const { create, update } = WorkflowInstanceMapper.toUpsertInput(instance);
    await this.prisma.workflowInstance.upsert({
      where: { id: instance.id },
      create,
      update,
    });
  }

  async saveInTx(
    instance: WorkflowInstance,
    tx: WorkflowTransactionClient,
  ): Promise<void> {
    const { create, update } = WorkflowInstanceMapper.toUpsertInput(instance);
    const client = tx as unknown as Prisma.TransactionClient;
    await client.workflowInstance.upsert({
      where: { id: instance.id },
      create,
      update,
    });
  }

  /**
   * Atomically persist the execution state with optimistic-lock check.
   * Owns the Prisma transaction.
   */
  async commitExecution(
    input: WorkflowExecutionCommit,
  ): Promise<WorkflowInstance> {
    return await this.prisma.$transaction((tx) => this.runCommit(tx, input));
  }

  /**
   * Same as {@link commitExecution} but enlists into an externally supplied
   * transaction (e.g. opened by RequestWorkflowOrchestrator).
   */
  async commitExecutionInTx(
    input: WorkflowExecutionCommit,
    tx: WorkflowTransactionClient,
  ): Promise<WorkflowInstance> {
    const client = tx as unknown as Prisma.TransactionClient;
    return await this.runCommit(client, input);
  }

  /**
   * Pure commit body, executed either inside the repository's own transaction
   * (`commitExecution`) or inside an externally supplied one
   * (`commitExecutionInTx`).
   *
   * Strategy:
   *  1. Read current lockVersion of the instance (within the tx).
   *  2. Verify input.expectedLockVersion matches; otherwise -> ConflictError.
   *  3. If idempotencyKey provided, attempt to find existing transition —
   *     if found, treat as replay → no-op (return current state).
   *  4. Upsert instance, node instances, tasks; create transitions.
   */
  private async runCommit(
    tx: Prisma.TransactionClient,
    input: WorkflowExecutionCommit,
  ): Promise<WorkflowInstance> {
    const current = await tx.workflowInstance.findUnique({
      where: { id: input.instance.id },
      select: { lockVersion: true },
    });
    if (!current) {
      throw new NotFoundError('WorkflowInstance', input.instance.id);
    }
    if (current.lockVersion !== input.expectedLockVersion) {
      throw new ConflictError(
        `Stale lockVersion ${input.expectedLockVersion} (current=${current.lockVersion})`,
      );
    }

    // Idempotency: if idempotencyKey provided and already exists, no-op.
    if (input.idempotencyKey) {
      const existing = await tx.workflowTransition.findUnique({
        where: {
          workflowInstanceId_idempotencyKey: {
            workflowInstanceId: input.instance.id,
            idempotencyKey: input.idempotencyKey,
          },
        },
      });
      if (existing) {
        // Replay detected: return current instance unchanged
        const fresh = await tx.workflowInstance.findUnique({
          where: { id: input.instance.id },
        });
        return WorkflowInstanceMapper.toDomain(fresh);
      }
    }

    // Upsert instance
    const { create: instCreate, update: instUpdate } =
      WorkflowInstanceMapper.toUpsertInput(input.instance);
    await tx.workflowInstance.upsert({
      where: { id: input.instance.id },
      create: instCreate,
      update: instUpdate,
    });

    // Upsert node instances
    for (const n of input.nodeInstances) {
      const { create, update } = WorkflowNodeInstanceMapper.toUpsertInput(n);
      await tx.workflowNodeInstance.upsert({
        where: { id: n.id },
        create,
        update,
      });
    }

    // Upsert tasks
    for (const t of input.tasks) {
      const { create, update } = WorkflowTaskMapper.toUpsertInput(t);
      await tx.workflowTask.upsert({
        where: { id: t.id },
        create,
        update,
      });
    }

    // Insert transitions (history)
    for (const transition of input.transitions) {
      await tx.workflowTransition.create({
        data: WorkflowTransitionMapper.toCreateInput(transition),
      });
    }

    const refreshed = await tx.workflowInstance.findUnique({
      where: { id: input.instance.id },
    });
    return WorkflowInstanceMapper.toDomain(refreshed);
  }

  async findNodeInstances(
    workflowInstanceId: string,
  ): Promise<WorkflowNodeInstance[]> {
    const rows = await this.prisma.workflowNodeInstance.findMany({
      where: { workflowInstanceId },
      orderBy: { startedAt: 'asc' },
    });
    return rows.map((r) => WorkflowNodeInstanceMapper.toDomain(r));
  }

  async findTransitions(
    workflowInstanceId: string,
  ): Promise<WorkflowTransition[]> {
    const rows = await this.prisma.workflowTransition.findMany({
      where: { workflowInstanceId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => WorkflowTransitionMapper.toDomain(r));
  }

  async findTaskById(
    id: string,
  ): Promise<{ task: WorkflowTask; instance: WorkflowInstance } | null> {
    const row = await this.prisma.workflowTask.findUnique({
      where: { id },
      include: TASK_INCLUDE,
    });
    if (!row) return null;
    const task = WorkflowTaskMapper.toDomain(row);
    const instance = WorkflowInstanceMapper.toDomain(row.workflowInstance);
    return { task, instance };
  }

  async listTasks(
    filters: WorkflowTaskListFilters,
    page: { page: number; pageSize: number },
    actorCompanyId: string | null,
  ): Promise<WorkflowTaskListPage> {
    const where: Prisma.WorkflowTaskWhereInput = {};
    if (filters.workflowInstanceId) {
      where.workflowInstanceId = filters.workflowInstanceId;
    }
    if (filters.requestId) {
      where.workflowInstance = { requestId: filters.requestId };
    }
    if (filters.status) where.status = filters.status as never;
    if (filters.assignedUserId) where.assignedUserId = filters.assignedUserId;
    if (filters.assignedRoleCode) {
      where.assignedRoleCode = filters.assignedRoleCode;
    }
    if (filters.open) {
      where.status = { in: ['PENDING', 'CLAIMED'] };
    }
    // Company scoping: filter by instance.request.companyId
    if (actorCompanyId) {
      where.workflowInstance = {
        ...(where.workflowInstance as Prisma.WorkflowInstanceWhereInput),
        request: { companyId: actorCompanyId },
      };
    }
    const [rows, total] = await Promise.all([
      this.prisma.workflowTask.findMany({
        where,
        include: TASK_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page.page - 1) * page.pageSize,
        take: page.pageSize,
      }),
      this.prisma.workflowTask.count({ where }),
    ]);
    return {
      items: rows.map((r) => {
        const row = r as unknown as Prisma.WorkflowTaskGetPayload<
          Record<string, unknown>
        >;
        return WorkflowTaskMapper.toDomain(row);
      }),
      total,
      page: page.page,
      pageSize: page.pageSize,
    };
  }

  async saveTask(task: WorkflowTask): Promise<void> {
    const { create, update } = WorkflowTaskMapper.toUpsertInput(task);
    await this.prisma.workflowTask.upsert({
      where: { id: task.id },
      create,
      update,
    });
  }
}

export const WORKFLOW_INSTANCE_REPOSITORY_PROVIDER = {
  provide: WORKFLOW_INSTANCE_REPOSITORY,
  useClass: WorkflowInstancePrismaRepository,
};
