/**
 * Single source of truth for Request state transitions.
 *
 * Aligned with Prisma enum `RequestStatus` (12 cases).
 *
 * Status flow:
 *
 *   DRAFT ──submit──> SUBMITTED
 *   DRAFT ──cancel──> CANCELLED
 *   SUBMITTED ──return──> RETURNED_FOR_CORRECTION
 *   SUBMITTED ──reject──> REJECTED
 *   SUBMITTED ──advance──> UNDER_DOCUMENT_REVIEW
 *   RETURNED_FOR_CORRECTION ──resubmit──> SUBMITTED
 *   RETURNED_FOR_CORRECTION ──cancel──> CANCELLED
 *   UNDER_DOCUMENT_REVIEW ──approve docs──> DOCUMENTS_APPROVED
 *   UNDER_DOCUMENT_REVIEW ──return──> RETURNED_FOR_CORRECTION
 *   UNDER_DOCUMENT_REVIEW ──reject──> REJECTED
 *   DOCUMENTS_APPROVED ──advance──> PENDING_FINAL_APPROVAL
 *   PENDING_FINAL_APPROVAL ──approve final──> APPROVED
 *   PENDING_FINAL_APPROVAL ──return──> RETURNED_FOR_CORRECTION
 *   PENDING_FINAL_APPROVAL ──reject──> REJECTED
 *   APPROVED ──start production──> IN_PRODUCTION
 *   IN_PRODUCTION ──mark ready──> READY_FOR_DELIVERY
 *   READY_FOR_DELIVERY ──deliver──> DELIVERED
 *
 * Terminal: REJECTED, CANCELLED, DELIVERED.
 */

import {
  BusinessRuleError,
  ConflictError,
} from '../../../common/domain/errors/domain-error';
import type { RequestStatus } from './entities/request.entity';

export type RequestTransition =
  | 'submit'
  | 'resubmit'
  | 'cancel'
  | 'return'
  | 'reject'
  | 'advance_to_document_review'
  | 'approve_documents'
  | 'advance_to_final'
  | 'approve_final'
  | 'start_production'
  | 'mark_ready'
  | 'deliver';

export type RequestEventType =
  | 'CREATED'
  | 'SUBMITTED'
  | 'RESUBMITTED'
  | 'CANCELLED'
  | 'RETURNED'
  | 'REJECTED'
  | 'DOCUMENT_APPROVED'
  | 'DOCUMENT_REJECTED'
  | 'STAGE_APPROVED'
  | 'APPROVED'
  | 'STARTED_PRODUCTION'
  | 'MARKED_READY'
  | 'DELIVERED';

interface TransitionRule {
  from: RequestStatus[];
  to: RequestStatus;
  eventType: RequestEventType;
}

export const REQUEST_TRANSITIONS: Record<RequestTransition, TransitionRule> = {
  submit: { from: ['DRAFT'], to: 'SUBMITTED', eventType: 'SUBMITTED' },
  resubmit: {
    from: ['RETURNED_FOR_CORRECTION'],
    to: 'SUBMITTED',
    eventType: 'RESUBMITTED',
  },
  cancel: {
    from: ['DRAFT', 'RETURNED_FOR_CORRECTION'],
    to: 'CANCELLED',
    eventType: 'CANCELLED',
  },
  return: {
    from: [
      'SUBMITTED',
      'UNDER_DOCUMENT_REVIEW',
      'DOCUMENTS_APPROVED',
      'PENDING_FINAL_APPROVAL',
    ],
    to: 'RETURNED_FOR_CORRECTION',
    eventType: 'RETURNED',
  },
  reject: {
    from: [
      'SUBMITTED',
      'UNDER_DOCUMENT_REVIEW',
      'DOCUMENTS_APPROVED',
      'PENDING_FINAL_APPROVAL',
    ],
    to: 'REJECTED',
    eventType: 'REJECTED',
  },
  advance_to_document_review: {
    from: ['SUBMITTED'],
    to: 'UNDER_DOCUMENT_REVIEW',
    eventType: 'STAGE_APPROVED',
  },
  approve_documents: {
    from: ['UNDER_DOCUMENT_REVIEW'],
    to: 'DOCUMENTS_APPROVED',
    eventType: 'DOCUMENT_APPROVED',
  },
  advance_to_final: {
    from: ['DOCUMENTS_APPROVED'],
    to: 'PENDING_FINAL_APPROVAL',
    eventType: 'STAGE_APPROVED',
  },
  approve_final: {
    from: ['PENDING_FINAL_APPROVAL'],
    to: 'APPROVED',
    eventType: 'APPROVED',
  },
  start_production: {
    from: ['APPROVED'],
    to: 'IN_PRODUCTION',
    eventType: 'STARTED_PRODUCTION',
  },
  mark_ready: {
    from: ['IN_PRODUCTION'],
    to: 'READY_FOR_DELIVERY',
    eventType: 'MARKED_READY',
  },
  deliver: {
    from: ['READY_FOR_DELIVERY'],
    to: 'DELIVERED',
    eventType: 'DELIVERED',
  },
};

export class RequestStatePolicy {
  static assertTransition(
    from: RequestStatus,
    transition: RequestTransition,
  ): RequestStatus {
    const rule = REQUEST_TRANSITIONS[transition];
    if (!rule) {
      throw new BusinessRuleError(`Unknown transition: ${transition}`);
    }
    if (!rule.from.includes(from)) {
      throw new ConflictError(
        `Cannot ${transition} a request in status ${from}. Allowed source statuses: ${rule.from.join(', ')}.`,
      );
    }
    return rule.to;
  }

  static canTransition(
    from: RequestStatus,
    transition: RequestTransition,
  ): boolean {
    const rule = REQUEST_TRANSITIONS[transition];
    return !!rule && rule.from.includes(from);
  }

  static eventTypeFor(transition: RequestTransition): RequestEventType {
    return REQUEST_TRANSITIONS[transition].eventType;
  }

  static isTerminal(status: RequestStatus): boolean {
    return (
      status === 'REJECTED' || status === 'CANCELLED' || status === 'DELIVERED'
    );
  }

  static isEditable(status: RequestStatus): boolean {
    return status === 'DRAFT' || status === 'RETURNED_FOR_CORRECTION';
  }
}
