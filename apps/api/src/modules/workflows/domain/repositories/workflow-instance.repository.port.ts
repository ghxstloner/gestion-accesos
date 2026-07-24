import type {
  WorkflowInstance,
  WorkflowNodeInstance,
  WorkflowTask,
  WorkflowTransition,
} from '../entities/workflow-instance.entity';
import type { EvaluationContext } from '../workflow-definition.types';

export const WORKFLOW_INSTANCE_REPOSITORY = Symbol(
  'WORKFLOW_INSTANCE_REPOSITORY',
);

/**
 * Opaque token representing a Prisma transaction client.
 * Defined here so the domain port can accept it without importing Prisma
 * (the implementation layer is the only place that materialises a real tx).
 */
export interface WorkflowTransactionClient {
  readonly __brand: 'WorkflowTransactionClient';
}

export interface WorkflowTaskListFilters {
  workflowInstanceId?: string;
  requestId?: string;
  status?: string;
  assignedUserId?: string;
  assignedRoleCode?: string;
  claimed?: boolean;
  /** only open tasks (PENDING|CLAIMED) */
  open?: boolean;
}

export interface WorkflowTaskListPage {
  items: WorkflowTask[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Snapshot for transactional persist of workflow execution.
 * Everything in this batch is written in a single Prisma transaction
 * with the optimistic lock check on `expectedLockVersion`.
 *
 * Returns the resulting WorkflowInstance after reload.
 */
export interface WorkflowExecutionCommit {
  instance: WorkflowInstance;
  /** optimistic lock expectation */
  expectedLockVersion: number;
  /** upsert all of these */
  nodeInstances: WorkflowNodeInstance[];
  /** upsert all of these */
  tasks: WorkflowTask[];
  /** insert all of these (transition history) */
  transitions: WorkflowTransition[];
  /** idempotency key for this commit; if provided, must be unique per instance */
  idempotencyKey?: string | null;
}

export interface WorkflowInstanceRepositoryPort {
  findById(id: string): Promise<WorkflowInstance | null>;
  findByRequestId(requestId: string): Promise<WorkflowInstance | null>;
  save(instance: WorkflowInstance): Promise<void>;

  /**
   * Persist a fresh WorkflowInstance using a caller-supplied transaction.
   * Used by `RequestWorkflowOrchestrator` so the instance + its Request are
   * committed atomically. Only the instance row is written (no node/task
   * graph here — those persist on the first `commitExecution`).
   */
  saveInTx(
    instance: WorkflowInstance,
    tx: WorkflowTransactionClient,
  ): Promise<void>;

  /**
   * Atomically persist execution state with optimistic-lock check.
   * - reads instance with current lockVersion
   * - if input.expectedLockVersion !== stored lockVersion → ConflictError
   * - writes instance + nodeInstances + tasks + transitions together
   * - if idempotencyKey is provided, attempts re-play are no-ops (returned transitions already match)
   */
  commitExecution(input: WorkflowExecutionCommit): Promise<WorkflowInstance>;

  /**
   * Same as {@link commitExecution} but enlists the writes in an externally
   * supplied transaction, so the engine's transition can commit alongside
   * the Request transition.
   */
  commitExecutionInTx(
    input: WorkflowExecutionCommit,
    tx: WorkflowTransactionClient,
  ): Promise<WorkflowInstance>;

  findNodeInstances(
    workflowInstanceId: string,
  ): Promise<WorkflowNodeInstance[]>;
  findTransitions(workflowInstanceId: string): Promise<WorkflowTransition[]>;

  findTaskById(id: string): Promise<{
    task: WorkflowTask;
    instance: WorkflowInstance;
  } | null>;

  listTasks(
    filters: WorkflowTaskListFilters,
    page: { page: number; pageSize: number },
    /** restrict to actor's company scope */
    actorCompanyId: string | null,
  ): Promise<WorkflowTaskListPage>;

  saveTask(task: WorkflowTask): Promise<void>;
}

/**
 * Saved query hint for prisma includes. Lives in the port file so it can be
 * imported by infrastructure without redefining it.
 *
 * NOTE: this is intentionally a `const` object typed with `Prisma.WorkflowTaskInclude`
 * via an infrastructure-side cast. We deliberately avoid importing Prisma here
 * to keep domain code free of ORM types — the infrastructure layer casts.
 */
export const TASK_INCLUDE = {
  workflowInstance: {
    include: {
      workflowVersion: true,
      request: {
        select: {
          id: true,
          companyId: true,
          requestNumber: true,
          status: true,
        },
      },
    },
  },
  nodeInstance: true,
} as const;

/** Type re-export to avoid pulling prisma types in domain code surface */
export type EvaluationContextLike = EvaluationContext;
