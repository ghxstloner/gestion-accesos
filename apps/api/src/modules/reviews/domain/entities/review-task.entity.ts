import { randomUUID } from 'node:crypto';
import { ConflictError } from '../../../../common/domain/errors/domain-error';
import type { ReviewTaskStatus, ReviewTaskType, ReviewTaskTransition } from '../review-state.policy';

export interface ReviewTaskProps {
  id: string;
  requestId: string;
  taskType: ReviewTaskType;
  status: ReviewTaskStatus;
  assignedToUserId: string | null;
  assignedRoleCode: string | null;
  assignedAt: Date | null;
  completedAt: Date | null;
  dueAt: Date | null;
  createdAt: Date;
}

export class ReviewTask {
  private constructor(private readonly props: ReviewTaskProps) {}

  static create(input: {
    requestId: string;
    taskType: ReviewTaskType;
    dueAt?: Date | null;
  }): ReviewTask {
    return new ReviewTask({
      id: randomUUID(),
      requestId: input.requestId,
      taskType: input.taskType,
      status: 'PENDING',
      assignedToUserId: null,
      assignedRoleCode: null,
      assignedAt: null,
      completedAt: null,
      dueAt: input.dueAt ?? null,
      createdAt: new Date(),
    });
  }

  static reconstitute(props: ReviewTaskProps): ReviewTask {
    return new ReviewTask(props);
  }

  get id() { return this.props.id; }
  get requestId() { return this.props.requestId; }
  get taskType() { return this.props.taskType; }
  get status() { return this.props.status; }
  get assignedToUserId() { return this.props.assignedToUserId; }
  get assignedRoleCode() { return this.props.assignedRoleCode; }
  get assignedAt() { return this.props.assignedAt; }
  get completedAt() { return this.props.completedAt; }
  get dueAt() { return this.props.dueAt; }
  get createdAt() { return this.props.createdAt; }

  toProps(): ReviewTaskProps {
    return { ...this.props };
  }

  isComplete(): boolean {
    return this.props.status === 'COMPLETED' || this.props.status === 'CANCELLED';
  }

  /** Apply a transition; throws if invalid. Returns the new status. */
  applyTransition(
    transition: ReviewTaskTransition,
    nextStatus: ReviewTaskStatus,
    payload: { actorUserId: string; actorRoleCode: string; now?: Date },
  ): void {
    const now = payload.now ?? new Date();
    if (transition === 'assign') {
      this.props.assignedToUserId = payload.actorUserId;
      this.props.assignedRoleCode = payload.actorRoleCode;
      if (!this.props.assignedAt) {
        this.props.assignedAt = now;
      }
    } else if (transition === 'unassign') {
      this.props.assignedToUserId = null;
      this.props.assignedRoleCode = null;
      this.props.assignedAt = null;
    } else {
      // All other transitions complete the task
      if (this.isComplete()) {
        throw new ConflictError(`Task ${this.id} has already been completed`);
      }
      this.props.completedAt = now;
    }
    this.props.status = nextStatus;
  }
}
