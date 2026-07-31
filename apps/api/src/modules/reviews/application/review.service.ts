import { Inject, Injectable, forwardRef } from '@nestjs/common';
import type { AuthenticatedUser } from '../../../common/presentation/decorators/authenticated-user';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../common/domain/errors/domain-error';
import { RequestService } from '../../requests/application/request.service';
import type { RequestTransition } from '../../requests/domain/request-state.policy';
import { RequestWorkflowOrchestrator } from '../../workflows/application/request-workflow-orchestrator.service';
import type { HumanTaskOutcome } from '../../workflows/domain/workflow-definition.types';
import {
  ReviewStatePolicy,
  type ReviewTaskTransition,
  type ReviewTaskType,
} from '../domain/review-state.policy';
import { ReviewTask } from '../domain/entities/review-task.entity';
import { ReviewMapper } from '../infrastructure/persistence/mappers/review.mapper';
import {
  REVIEW_REPOSITORY,
  type ReviewRepositoryPort,
  type ReviewListFilters,
} from '../domain/repositories/review.repository.port';

/**
 * Mapping of review-task transitions to the pair (Request state transition,
 * workflow human-task outcome) that the orchestrator needs.
 *
 * Notes:
 *  - `approve_documents` advances the Request to PENDING_FINAL_APPROVAL. On
 *    the workflow side it is an APPROVE outcome (the document-review human
 *    task completes and the engine advances to the next node).
 *  - `reject_documents` RETURNS the Request (the applicant must correct the
 *    documents), which on the workflow side is a RETURN_FOR_CORRECTION outcome
 *    (not REJECT — the Request is not rejected, just sent back).
 *  - `assign` / `unassign` are NOT in the map because they do not touch the
 *    Request state machine (handled separately in `applyRequestSideEffect`).
 */
const REVIEW_TRANSITION_TO_REQUEST_AND_OUTCOME: Partial<
  Record<
    ReviewTaskTransition,
    { requestTransition: RequestTransition; outcome: HumanTaskOutcome }
  >
> = {
  approve_documents: {
    requestTransition: 'approve_documents',
    outcome: 'APPROVE',
  },
  reject_documents: {
    requestTransition: 'return',
    outcome: 'RETURN_FOR_CORRECTION',
  },
  approve_final: { requestTransition: 'approve_final', outcome: 'APPROVE' },
  return: { requestTransition: 'return', outcome: 'RETURN_FOR_CORRECTION' },
  reject: { requestTransition: 'reject', outcome: 'REJECT' },
};

export interface CreateReviewTaskInput {
  requestId: string;
  taskType: ReviewTaskType;
  dueAt?: Date | null;
  assignedRoleCode?: string | null;
}

@Injectable()
export class ReviewService {
  constructor(
    @Inject(REVIEW_REPOSITORY) private readonly reviews: ReviewRepositoryPort,
    private readonly requestService: RequestService,
    // forwardRef: RequestWorkflowOrchestrator lives in WorkflowsModule, which
    // already depends back on RequestService (transitively on RequestsModule)
    // via the engine. ImportsReviewsModule -> RequestsModule already exists;
    // the orchestrator is reached through WorkflowsModule, imported into
    // ReviewsModule with the matching forwardRef. NO new cycle is introduced:
    // ReviewsModule now depends on WorkflowsModule exactly the same way
    // RequestsModule already does.
    @Inject(forwardRef(() => RequestWorkflowOrchestrator))
    private readonly orchestrator: RequestWorkflowOrchestrator,
  ) {}

  private assertManager(actor: AuthenticatedUser): void {
    const allowed = [
      'SYSTEM_ADMIN',
      'COMPANY_ADMIN',
      'DOCUMENT_RECEIVER',
      'ACCESS_DOCUMENTS_MANAGER',
      'CARD_ISSUER',
    ];
    if (!actor.roles.some((r) => allowed.includes(r))) {
      throw new ForbiddenError('You are not allowed to manage review tasks');
    }
  }

  async create(
    actor: AuthenticatedUser,
    input: CreateReviewTaskInput,
  ): Promise<ReviewTask> {
    this.assertManager(actor);
    // Verify the request exists and is in a state that can be reviewed
    const request = await this.requestService.getById(actor, input.requestId);
    if (
      request.status === 'DRAFT' ||
      request.status === 'CANCELLED' ||
      request.status === 'REJECTED'
    ) {
      throw new ValidationError(
        `Cannot create review task for request in status ${request.status}`,
      );
    }
    const task = ReviewTask.create({
      requestId: input.requestId,
      taskType: input.taskType,
      dueAt: input.dueAt,
    });
    await this.reviews.save(ReviewMapper.toRecord(task));
    return task;
  }

  async list(
    actor: AuthenticatedUser,
    filters: ReviewListFilters,
    page: number,
    pageSize: number,
  ) {
    this.assertManager(actor);
    return this.reviews.list({ filters, page, pageSize });
  }

  async listByRequest(
    actor: AuthenticatedUser,
    requestId: string,
  ): Promise<ReviewTask[]> {
    this.assertManager(actor);
    // Ensure the actor can read the request — getById enforces read access.
    await this.requestService.getById(actor, requestId);
    const records = await this.reviews.findByRequest(requestId);
    return records.map((r) => ReviewMapper.toDomain(r));
  }

  async getById(actor: AuthenticatedUser, id: string): Promise<ReviewTask> {
    this.assertManager(actor);
    const record = await this.reviews.findById(id);
    if (!record) throw new NotFoundError('ReviewTask', id);
    const task = ReviewMapper.toDomain(record);
    // Ensure actor can read underlying request
    await this.requestService.getById(actor, task.requestId);
    return task;
  }

  /**
   * Apply a transition to a review task AND propagate the reviewer decision
   * to both the underlying Request and the active WorkflowInstance via the
   * RequestWorkflowOrchestrator (single atomic transaction — no path can
   * mutate the Request status without also completing/advancing the matching
   * workflow task).
   */
  async transition(
    actor: AuthenticatedUser,
    taskId: string,
    transition: ReviewTaskTransition,
    extra: {
      comment?: string | null;
      reasonCode?: string | null;
      assignedToUserId?: string | null;
    },
  ): Promise<ReviewTask> {
    this.assertManager(actor);
    const task = await this.getById(actor, taskId);

    const rule = new ReviewStatePolicy().assertTransition(
      task.status,
      transition,
      task.taskType,
    );
    task.applyTransition(transition, rule.to, {
      actorUserId: extra.assignedToUserId ?? actor.userId,
      actorRoleCode: actor.roles[0] ?? '',
    });
    await this.reviews.save(ReviewMapper.toRecord(task));

    // Side effects on the underlying Request + WorkflowInstance (orchestrated):
    await this.applyRequestSideEffect(actor, task, transition, extra);

    return task;
  }

  /**
   * Propagate the reviewer decision to the Request lifecycle and the active
   * WorkflowInstance via {@link RequestWorkflowOrchestrator.onReviewOutcome}.
   *
   * The orchestrator is the SINGLE bridge: it commits the Request mutation
   * and the matching workflow task completion/advance inside one Prisma
   * transaction. Idempotent (idempotencyKey forwarded when present) and with
   * graceful legacy fallback when no published workflow / no ACTIVE instance
   * / no open task exists — so existing requests that pre-date the workflow
   * bridge keep working unchanged.
   *
   * The pre-state guard (check `req.status`) is kept to avoid forcing a
   * Request transition that the state policy would reject — same defensive
   * semantics as the legacy path, but routed through the orchestrator.
   *
   * `assign` / `unassign` are NOT routed through the orchestrator because they
   * do not affect Request status.
   */
  private async applyRequestSideEffect(
    actor: AuthenticatedUser,
    task: ReviewTask,
    transition: ReviewTaskTransition,
    extra: { comment?: string | null; reasonCode?: string | null },
  ): Promise<void> {
    const mapping = REVIEW_TRANSITION_TO_REQUEST_AND_OUTCOME[transition];
    if (!mapping) {
      // 'assign' / 'unassign' don't touch Request status.
      return;
    }
    const req = await this.requestService.getById(actor, task.requestId);

    // Defensive pre-state guard mirroring the legacy branches so no invalid
    // Request transition is attempted. The orchestrator's prepareTransition
    // would reject anyway, but checking here yields a cleaner error and keeps
    // the historical idempotency semantics (no-op when already past the gate).
    const isValidRequestStateForTransition = this.isApplicableForRequest(
      transition,
      req.status,
    );
    if (!isValidRequestStateForTransition) {
      return;
    }

    await this.orchestrator.onReviewOutcome({
      requestId: task.requestId,
      actor,
      requestTransition: mapping.requestTransition,
      outcome: mapping.outcome,
      comment: extra.comment ?? null,
      reasonCode: extra.reasonCode ?? null,
    });
  }

  /**
   * Re-implements the pre-state guards of the legacy `applyRequestSideEffect`.
   * Kept as a private helper so the post-wiring behaviour is byte-equivalent
   * to the legacy path's idempotency (skip when the Request is not in a state
   * that can receive the transition).
   */
  private isApplicableForRequest(
    transition: ReviewTaskTransition,
    requestStatus: string,
  ): boolean {
    switch (transition) {
      case 'approve_documents':
        return requestStatus === 'UNDER_DOCUMENT_REVIEW';
      case 'reject_documents':
        return requestStatus === 'UNDER_DOCUMENT_REVIEW';
      case 'approve_final':
        return requestStatus === 'PENDING_FINAL_APPROVAL';
      case 'return':
        return (
          requestStatus === 'PENDING_FINAL_APPROVAL' ||
          requestStatus === 'UNDER_DOCUMENT_REVIEW'
        );
      case 'reject':
        return requestStatus !== 'REJECTED' && requestStatus !== 'CANCELLED';
      default:
        return false;
    }
  }
}
