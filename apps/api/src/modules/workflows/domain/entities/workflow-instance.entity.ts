import { randomUUID } from 'node:crypto';
import {
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  ValidationError,
} from '../../../../common/domain/errors/domain-error';
import {
  HUMAN_TASK_OUTCOMES,
  MAX_AUTO_TRANSITIONS,
  type ConditionExpression,
  type EvaluationContext,
  type HumanTaskOutcome,
  type WorkflowAssignment,
  type WorkflowGraphDefinition,
  type WorkflowNode,
} from '../workflow-definition.types';
import { ConditionEvaluator } from '../condition-evaluator';

export type WorkflowInstanceStatusValue =
  'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'FAILED';

export type WorkflowNodeInstanceStatusValue =
  'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export type WorkflowTaskStatusValue =
  'PENDING' | 'CLAIMED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';

export interface WorkflowNodeInstanceProps {
  id: string;
  workflowInstanceId: string;
  nodeKey: string;
  nodeType: string;
  status: WorkflowNodeInstanceStatusValue;
  inputJson: Record<string, unknown> | null;
  outputJson: Record<string, unknown> | null;
  startedAt: Date;
  completedAt: Date | null;
  failedAt: Date | null;
  errorCode: string | null;
  errorMessage: string | null;
  attemptNumber: number;
}

export class WorkflowNodeInstance {
  private constructor(private readonly props: WorkflowNodeInstanceProps) {}

  static create(input: {
    workflowInstanceId: string;
    nodeKey: string;
    nodeType: string;
    inputJson?: Record<string, unknown> | null;
    now?: Date;
  }): WorkflowNodeInstance {
    if (!input.nodeKey?.trim()) {
      throw new ValidationError('nodeKey is required');
    }
    const now = input.now ?? new Date();
    return new WorkflowNodeInstance({
      id: randomUUID(),
      workflowInstanceId: input.workflowInstanceId,
      nodeKey: input.nodeKey,
      nodeType: input.nodeType,
      status: 'PENDING',
      inputJson: input.inputJson ?? null,
      outputJson: null,
      startedAt: now,
      completedAt: null,
      failedAt: null,
      errorCode: null,
      errorMessage: null,
      attemptNumber: 1,
    });
  }

  static reconstitute(props: WorkflowNodeInstanceProps): WorkflowNodeInstance {
    return new WorkflowNodeInstance(props);
  }

  get id() {
    return this.props.id;
  }
  get workflowInstanceId() {
    return this.props.workflowInstanceId;
  }
  get nodeKey() {
    return this.props.nodeKey;
  }
  get nodeType() {
    return this.props.nodeType;
  }
  get status() {
    return this.props.status;
  }
  get inputJson() {
    return this.props.inputJson;
  }
  get outputJson() {
    return this.props.outputJson;
  }
  get startedAt() {
    return this.props.startedAt;
  }
  get completedAt() {
    return this.props.completedAt;
  }
  get failedAt() {
    return this.props.failedAt;
  }
  get errorCode() {
    return this.props.errorCode;
  }
  get errorMessage() {
    return this.props.errorMessage;
  }
  get attemptNumber() {
    return this.props.attemptNumber;
  }

  start(): void {
    if (this.props.status !== 'PENDING') {
      throw new ConflictError(
        `Node ${this.nodeKey} cannot transition from ${this.props.status} to RUNNING`,
      );
    }
    this.props.status = 'RUNNING';
  }

  complete(outputJson?: Record<string, unknown> | null): void {
    this.props.status = 'COMPLETED';
    this.props.outputJson = outputJson ?? null;
    this.props.completedAt = new Date();
  }

  fail(errorCode: string, errorMessage: string): void {
    this.props.status = 'FAILED';
    this.props.errorCode = errorCode;
    this.props.errorMessage = errorMessage;
    this.props.failedAt = new Date();
  }

  /**
   * Increment attempt counter for retry. Resets status to PENDING.
   */
  retry(): void {
    this.props.attemptNumber += 1;
    this.props.status = 'PENDING';
    this.props.errorCode = null;
    this.props.errorMessage = null;
    this.props.failedAt = null;
    this.props.completedAt = null;
    this.props.startedAt = new Date();
  }

  cancel(): void {
    this.props.status = 'FAILED';
    this.props.errorCode = 'CANCELLED';
    this.props.errorMessage = 'Node cancelled by upstream cancellation';
  }

  toProps(): WorkflowNodeInstanceProps {
    return { ...this.props };
  }
}

export interface WorkflowTaskProps {
  id: string;
  workflowInstanceId: string;
  nodeInstanceId: string;
  status: WorkflowTaskStatusValue;
  assignmentType: 'ROLE' | 'USER';
  assignedUserId: string | null;
  assignedRoleCode: string | null;
  assignedCompanyId: string | null;
  claimedByUserId: string | null;
  dueAt: Date | null;
  completedByUserId: string | null;
  completedAt: Date | null;
  outcome: HumanTaskOutcome | null;
  comment: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A WorkflowTask is a human-actionable item. Created when entering a
 * HUMAN_TASK node. An assignment scopes who can claim it.
 *
 * - To claim a task, actor must satisfy assignment (role/user/company).
 * - To complete, actor must have claimed it first (unless assigned to USER).
 * - Outcome is one of HUMAN_TASK_OUTCOMES + node config allowedOutcomes.
 */
export class WorkflowTask {
  private constructor(private readonly props: WorkflowTaskProps) {}

  static create(input: {
    workflowInstanceId: string;
    nodeInstanceId: string;
    assignment: WorkflowAssignment;
    /** company id to scope role assignment (always taken from instance) */
    companyId: string | null;
    dueAt?: Date | null;
    now?: Date;
  }): WorkflowTask {
    if (input.assignment.type === 'ROLE' && !input.assignment.roleCode) {
      throw new ValidationError('ROLE assignment requires roleCode');
    }
    if (input.assignment.type === 'USER' && !input.assignment.userId) {
      throw new ValidationError('USER assignment requires userId');
    }
    const now = input.now ?? new Date();
    return new WorkflowTask({
      id: randomUUID(),
      workflowInstanceId: input.workflowInstanceId,
      nodeInstanceId: input.nodeInstanceId,
      status: 'PENDING',
      assignmentType: input.assignment.type,
      assignedUserId: input.assignment.userId ?? null,
      assignedRoleCode: input.assignment.roleCode ?? null,
      assignedCompanyId: input.companyId,
      claimedByUserId: null,
      dueAt: input.dueAt ?? null,
      completedByUserId: null,
      completedAt: null,
      outcome: null,
      comment: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: WorkflowTaskProps): WorkflowTask {
    return new WorkflowTask(props);
  }

  get id() {
    return this.props.id;
  }
  get workflowInstanceId() {
    return this.props.workflowInstanceId;
  }
  get nodeInstanceId() {
    return this.props.nodeInstanceId;
  }
  get status() {
    return this.props.status;
  }
  get assignmentType() {
    return this.props.assignmentType;
  }
  get assignedUserId() {
    return this.props.assignedUserId;
  }
  get assignedRoleCode() {
    return this.props.assignedRoleCode;
  }
  get assignedCompanyId() {
    return this.props.assignedCompanyId;
  }
  get claimedByUserId() {
    return this.props.claimedByUserId;
  }
  get dueAt() {
    return this.props.dueAt;
  }
  get completedByUserId() {
    return this.props.completedByUserId;
  }
  get completedAt() {
    return this.props.completedAt;
  }
  get outcome() {
    return this.props.outcome;
  }
  get comment() {
    return this.props.comment;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get updatedAt() {
    return this.props.updatedAt;
  }
  get isOpen() {
    return this.props.status === 'PENDING' || this.props.status === 'CLAIMED';
  }
  get isCompleted() {
    return this.props.status === 'COMPLETED';
  }

  canBeClaimedBy(actor: {
    userId: string;
    roles: string[];
    companyId: string | null;
  }): boolean {
    if (!this.isOpen) return false;
    if (this.assignmentType === 'USER') {
      return this.assignedUserId === actor.userId;
    }
    // ROLE assignment
    if (!actor.roles.includes(this.assignedRoleCode)) return false;
    // companyScoped: skip enforcement — handled by repository scoping
    return true;
  }

  claim(actor: {
    userId: string;
    roles: string[];
    companyId: string | null;
  }): void {
    if (!this.isOpen) {
      throw new ConflictError(
        `Task ${this.id} is not claimable (status=${this.props.status})`,
      );
    }
    if (!this.canBeClaimedBy(actor)) {
      throw new ForbiddenError('You are not assigned to this task');
    }
    this.props.status = 'CLAIMED';
    this.props.claimedByUserId = actor.userId;
    this.props.updatedAt = new Date();
  }

  complete(input: {
    actor: { userId: string; roles: string[]; companyId: string | null };
    outcome: HumanTaskOutcome;
    comment?: string | null;
    allowedOutcomes?: readonly HumanTaskOutcome[];
    now?: Date;
  }): void {
    if (!HUMAN_TASK_OUTCOMES.includes(input.outcome)) {
      throw new ValidationError(
        `outcome must be one of ${HUMAN_TASK_OUTCOMES.join(', ')}`,
      );
    }
    if (
      input.allowedOutcomes &&
      input.allowedOutcomes.length > 0 &&
      !input.allowedOutcomes.includes(input.outcome)
    ) {
      throw new ValidationError(
        `outcome ${input.outcome} is not allowed for this task`,
      );
    }
    if (this.props.status === 'COMPLETED') {
      throw new ConflictError(`Task ${this.id} is already completed`);
    }
    if (this.props.status === 'CANCELLED' || this.props.status === 'EXPIRED') {
      throw new ConflictError(
        `Task ${this.id} is ${this.props.status} and cannot be completed`,
      );
    }
    // If PENDING (unclaimed) and assignment is USER, allow direct completion.
    // Otherwise the actor must be the claimer.
    if (this.props.status === 'PENDING') {
      if (!this.canBeClaimedBy(input.actor)) {
        throw new ForbiddenError('You must claim this task before completing');
      }
      this.props.claimedByUserId = input.actor.userId;
    } else if (this.props.status === 'CLAIMED') {
      if (this.props.claimedByUserId !== input.actor.userId) {
        throw new ForbiddenError('Another user has claimed this task');
      }
    }
    const now = input.now ?? new Date();
    this.props.status = 'COMPLETED';
    this.props.completedByUserId = input.actor.userId;
    this.props.completedAt = now;
    this.props.outcome = input.outcome;
    this.props.comment = input.comment ?? null;
    this.props.updatedAt = now;
  }

  cancel(reason?: string): void {
    if (this.isCompleted) return;
    this.props.status = 'CANCELLED';
    this.props.updatedAt = new Date();
    if (reason) this.props.comment = reason;
  }

  toProps(): WorkflowTaskProps {
    return { ...this.props, outcome: this.props.outcome };
  }
}

export interface WorkflowTransitionProps {
  id: string;
  workflowInstanceId: string;
  sourceNodeKey: string;
  targetNodeKey: string;
  action: string;
  actorUserId: string | null;
  taskId: string | null;
  idempotencyKey: string | null;
  metadataJson: Record<string, unknown> | null;
  createdAt: Date;
}

export class WorkflowTransition {
  private constructor(private readonly props: WorkflowTransitionProps) {}

  static record(input: {
    workflowInstanceId: string;
    sourceNodeKey: string;
    targetNodeKey: string;
    action: string;
    actorUserId?: string | null;
    taskId?: string | null;
    /** if provided, must be unique per instance — used for idempotency */
    idempotencyKey?: string | null;
    metadata?: Record<string, unknown> | null;
    now?: Date;
  }): WorkflowTransition {
    return new WorkflowTransition({
      id: randomUUID(),
      workflowInstanceId: input.workflowInstanceId,
      sourceNodeKey: input.sourceNodeKey,
      targetNodeKey: input.targetNodeKey,
      action: input.action,
      actorUserId: input.actorUserId ?? null,
      taskId: input.taskId ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      metadataJson: input.metadata ?? null,
      createdAt: input.now ?? new Date(),
    });
  }

  static reconstitute(props: WorkflowTransitionProps): WorkflowTransition {
    return new WorkflowTransition(props);
  }

  toProps(): WorkflowTransitionProps {
    return { ...this.props };
  }
}

export interface WorkflowInstanceProps {
  id: string;
  requestId: string;
  workflowVersionId: string;
  status: WorkflowInstanceStatusValue;
  contextJson: EvaluationContext;
  startedAt: Date;
  completedAt: Date | null;
  cancelledAt: Date | null;
  lockVersion: number;
  createdAt: Date;
  updatedAt: Date;
  /** current node key, derived but cached for query convenience */
  currentNodeKey: string | null;
  /** count of automatic transitions attempted; capped at MAX_AUTO_TRANSITIONS */
  autoTransitionCount: number;
}

/**
 * Coroutine-like orchestration state for one Request flowing through one
 * WorkflowVersion. The actual graph navigation lives in the engine service;
 * this entity only enforces invariants about lifecycle + concurrency.
 */
export class WorkflowInstance {
  private constructor(private readonly props: WorkflowInstanceProps) {}

  static start(input: {
    id?: string;
    requestId: string;
    workflowVersionId: string;
    context: EvaluationContext;
    startNodeKey: string;
    now?: Date;
  }): WorkflowInstance {
    if (!input.startNodeKey) {
      throw new ValidationError('startNodeKey is required');
    }
    const now = input.now ?? new Date();
    return new WorkflowInstance({
      id: input.id ?? randomUUID(),
      requestId: input.requestId,
      workflowVersionId: input.workflowVersionId,
      status: 'ACTIVE',
      contextJson: input.context,
      startedAt: now,
      completedAt: null,
      cancelledAt: null,
      lockVersion: 1,
      createdAt: now,
      updatedAt: now,
      currentNodeKey: input.startNodeKey,
      autoTransitionCount: 0,
    });
  }

  static reconstitute(props: WorkflowInstanceProps): WorkflowInstance {
    return new WorkflowInstance(props);
  }

  get id() {
    return this.props.id;
  }
  get requestId() {
    return this.props.requestId;
  }
  get workflowVersionId() {
    return this.props.workflowVersionId;
  }
  get status() {
    return this.props.status;
  }
  get contextJson() {
    return this.props.contextJson;
  }
  get startedAt() {
    return this.props.startedAt;
  }
  get completedAt() {
    return this.props.completedAt;
  }
  get cancelledAt() {
    return this.props.cancelledAt;
  }
  get lockVersion() {
    return this.props.lockVersion;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get updatedAt() {
    return this.props.updatedAt;
  }
  get currentNodeKey() {
    return this.props.currentNodeKey;
  }
  get autoTransitionCount() {
    return this.props.autoTransitionCount;
  }
  get isActive() {
    return this.props.status === 'ACTIVE';
  }
  get isFinished() {
    return (
      this.props.status === 'COMPLETED' ||
      this.props.status === 'CANCELLED' ||
      this.props.status === 'FAILED'
    );
  }

  /**
   * Snapshot fields needed by the engine for transactional writes.
   * Returns the lockVersion BEFORE the next mutation.
   */
  beginTransition(): number {
    if (this.isFinished) {
      throw new BusinessRuleError(
        `Cannot transition a ${this.props.status} instance`,
      );
    }
    return this.props.lockVersion;
  }

  /**
   * Move to next node. Caller is responsible for graph routing.
   * Throws if the instance has already been finished or the lock version
   * does not match (caller must reload on conflict).
   */
  advanceTo(
    nodeKey: string,
    expectedLockVersion: number,
    options: { automatic?: boolean; now?: Date } = {},
  ): void {
    if (this.props.lockVersion !== expectedLockVersion) {
      throw new ConflictError(
        `Stale lockVersion ${expectedLockVersion} (current=${this.props.lockVersion})`,
      );
    }
    if (options.automatic) {
      this.props.autoTransitionCount += 1;
      if (this.props.autoTransitionCount > MAX_AUTO_TRANSITIONS) {
        throw new BusinessRuleError(
          `Exceeded MAX_AUTO_TRANSITIONS (${MAX_AUTO_TRANSITIONS}) — possible infinite loop`,
        );
      }
    }
    this.props.currentNodeKey = nodeKey;
    this.props.lockVersion += 1;
    this.props.updatedAt = options.now ?? new Date();
  }

  updateContext(patch: Partial<EvaluationContext>): void {
    this.props.contextJson = { ...this.props.contextJson, ...patch };
    this.props.updatedAt = new Date();
  }

  complete(now: Date = new Date()): void {
    if (this.props.status !== 'ACTIVE') {
      throw new BusinessRuleError(
        `Cannot complete a ${this.props.status} instance`,
      );
    }
    this.props.status = 'COMPLETED';
    this.props.completedAt = now;
    this.props.updatedAt = now;
    this.props.lockVersion += 1;
  }

  cancel(
    actorOrSystem: 'SYSTEM' | 'USER' = 'SYSTEM',
    now: Date = new Date(),
  ): void {
    if (this.props.status === 'COMPLETED') {
      throw new BusinessRuleError('Cannot cancel a COMPLETED instance');
    }
    if (this.props.status === 'CANCELLED') return;
    this.props.status = 'CANCELLED';
    this.props.cancelledAt = now;
    this.props.updatedAt = now;
    this.props.lockVersion += 1;
    void actorOrSystem;
  }

  fail(now: Date = new Date()): void {
    if (this.props.status === 'COMPLETED') {
      throw new BusinessRuleError('Cannot fail a COMPLETED instance');
    }
    this.props.status = 'FAILED';
    this.props.updatedAt = now;
    this.props.lockVersion += 1;
  }

  toProps(): WorkflowInstanceProps {
    return { ...this.props };
  }
}

/**
 * Helper for the engine: given a graph + current node + action + context,
 * returns the edge to follow (highest priority whose condition matches).
 * Throws ValidationError if no outgoing edge matches.
 */
export function selectOutgoingEdge(input: {
  graph: WorkflowGraphDefinition;
  from: string;
  action: string;
  ctx: EvaluationContext;
}): { to: string; condition?: ConditionExpression } {
  const matching = input.graph.edges.filter(
    (e) => e.from === input.from && e.action === input.action,
  );
  if (matching.length === 0) {
    throw new ValidationError(
      `No outgoing edge from ${input.from} for action ${input.action}`,
    );
  }
  // Validate action is permitted by source node outcome config
  const fromNode: WorkflowNode | undefined = input.graph.nodes.find(
    (n) => n.key === input.from,
  );
  if (
    fromNode?.type === 'HUMAN_TASK' &&
    fromNode.config?.outcomes &&
    fromNode.config.outcomes.length > 0
  ) {
    if (!fromNode.config.outcomes.includes(input.action as HumanTaskOutcome)) {
      throw new ValidationError(
        `Action ${input.action} not permitted by node ${input.from} (allowed: ${fromNode.config.outcomes.join(', ')})`,
      );
    }
  }
  const sorted = matching
    .slice()
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  for (const edge of sorted) {
    if (!edge.condition) return { to: edge.to, condition: undefined };
    if (ConditionEvaluator.evaluate(edge.condition, input.ctx)) {
      return { to: edge.to, condition: edge.condition };
    }
  }
  throw new ValidationError(
    `No outgoing edge from ${input.from} for action ${input.action} satisfied its condition`,
  );
}
