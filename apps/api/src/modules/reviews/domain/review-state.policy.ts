import { ConflictError } from '../../../common/domain/errors/domain-error';

export type ReviewTaskType = 'DOCUMENT_REVIEW' | 'FINAL_APPROVAL';

export type ReviewTaskStatus = 'PENDING' | 'ASSIGNED' | 'COMPLETED' | 'CANCELLED';

/**
 * Lower-level state transitions available to the review API. Each transition
 * is tied to one HTTP endpoint per spec section 17 (no PATCH /status endpoint).
 */
export type ReviewTaskTransition =
  | 'assign'
  | 'unassign'
  | 'approve_documents'
  | 'reject_documents'
  | 'approve_final'
  | 'return'
  | 'reject';

export interface ReviewTransitionRule {
  from: ReviewTaskStatus[];
  to: ReviewTaskStatus;
  eventType:
    | 'ASSIGNED'
    | 'DOCUMENT_APPROVED'
    | 'DOCUMENT_REJECTED'
    | 'STAGE_APPROVED'
    | 'RETURNED'
    | 'REJECTED';
  requiresTaskType?: ReviewTaskType;
}

export const REVIEW_TRANSITIONS: Record<ReviewTaskTransition, ReviewTransitionRule> = {
  assign: {
    from: ['PENDING', 'ASSIGNED'],
    to: 'ASSIGNED',
    eventType: 'ASSIGNED',
  },
  unassign: {
    from: ['ASSIGNED'],
    to: 'PENDING',
    eventType: 'ASSIGNED',
  },
  approve_documents: {
    from: ['ASSIGNED'],
    to: 'COMPLETED',
    eventType: 'DOCUMENT_APPROVED',
    requiresTaskType: 'DOCUMENT_REVIEW',
  },
  reject_documents: {
    from: ['ASSIGNED'],
    to: 'COMPLETED',
    eventType: 'DOCUMENT_REJECTED',
    requiresTaskType: 'DOCUMENT_REVIEW',
  },
  approve_final: {
    from: ['ASSIGNED'],
    to: 'COMPLETED',
    eventType: 'STAGE_APPROVED',
    requiresTaskType: 'FINAL_APPROVAL',
  },
  return: {
    from: ['ASSIGNED'],
    to: 'COMPLETED',
    eventType: 'RETURNED',
  },
  reject: {
    from: ['ASSIGNED'],
    to: 'COMPLETED',
    eventType: 'REJECTED',
  },
};

export class ReviewStatePolicy {
  assertTransition(
    from: ReviewTaskStatus,
    transition: ReviewTaskTransition,
    taskType: ReviewTaskType,
  ): ReviewTransitionRule {
    const rule = REVIEW_TRANSITIONS[transition];
    if (!rule.from.includes(from)) {
      throw new ConflictError(
        `Task in status ${from} cannot apply transition ${transition}`,
      );
    }
    if (rule.requiresTaskType && rule.requiresTaskType !== taskType) {
      throw new ConflictError(
        `Transition ${transition} requires task type ${rule.requiresTaskType} but got ${taskType}`,
      );
    }
    return rule;
  }

  isTerminal(status: ReviewTaskStatus): boolean {
    return status === 'COMPLETED' || status === 'CANCELLED';
  }
}
