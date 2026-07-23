import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../../../common/presentation/decorators/authenticated-user';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../common/domain/errors/domain-error';
import { RequestService } from '../../requests/application/request.service';
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
   * Apply a transition to a review task AND to the underlying Request
   * (so the request state machine stays in sync).
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

    // Side effects on the underlying Request:
    await this.applyRequestSideEffect(actor, task, transition, extra);

    return task;
  }

  private async applyRequestSideEffect(
    actor: AuthenticatedUser,
    task: ReviewTask,
    transition: ReviewTaskTransition,
    extra: { comment?: string | null; reasonCode?: string | null },
  ): Promise<void> {
    const req = await this.requestService.getById(actor, task.requestId);
    if (transition === 'approve_documents') {
      // After document approval, advance to PENDING_FINAL_APPROVAL
      if (req.status === 'UNDER_DOCUMENT_REVIEW') {
        await this.requestService.transition(actor, {
          requestId: task.requestId,
          transition: 'approve_documents',
        });
      }
    } else if (transition === 'reject_documents') {
      // Reject documents → send back to applicant for correction
      if (req.status === 'UNDER_DOCUMENT_REVIEW') {
        await this.requestService.transition(actor, {
          requestId: task.requestId,
          transition: 'return',
          comment: extra.comment ?? null,
          reasonCode: extra.reasonCode ?? null,
        });
      }
    } else if (transition === 'approve_final') {
      if (req.status === 'PENDING_FINAL_APPROVAL') {
        await this.requestService.transition(actor, {
          requestId: task.requestId,
          transition: 'approve_final',
        });
      }
    } else if (transition === 'return') {
      if (
        req.status === 'PENDING_FINAL_APPROVAL' ||
        req.status === 'UNDER_DOCUMENT_REVIEW'
      ) {
        await this.requestService.transition(actor, {
          requestId: task.requestId,
          transition: 'return',
          comment: extra.comment ?? null,
          reasonCode: extra.reasonCode ?? null,
        });
      }
    } else if (transition === 'reject') {
      if (req.status !== 'REJECTED' && req.status !== 'CANCELLED') {
        await this.requestService.transition(actor, {
          requestId: task.requestId,
          transition: 'reject',
          comment: extra.comment ?? null,
          reasonCode: extra.reasonCode ?? null,
        });
      }
    }
    // 'assign' / 'unassign' don't touch Request status
  }
}
