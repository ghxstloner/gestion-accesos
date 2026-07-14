import type { ReviewTaskRecord } from '../../domain/repositories/review.repository.port';

export interface ReviewTaskListResponse {
  id: string;
  requestId: string;
  taskType: string;
  status: string;
  assignedToUserId: string | null;
  assignedRoleCode: string | null;
  assignedAt: string | null;
  completedAt: string | null;
  dueAt: string | null;
  createdAt: string;
}

export class ReviewPresenter {
  static toResponse(r: ReviewTaskRecord): ReviewTaskListResponse {
    return {
      id: r.id,
      requestId: r.requestId,
      taskType: r.taskType,
      status: r.status,
      assignedToUserId: r.assignedToUserId,
      assignedRoleCode: r.assignedRoleCode,
      assignedAt: r.assignedAt ? r.assignedAt.toISOString() : null,
      completedAt: r.completedAt ? r.completedAt.toISOString() : null,
      dueAt: r.dueAt ? r.dueAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    };
  }

  static toList(items: ReviewTaskRecord[]): ReviewTaskListResponse[] {
    return items.map((r) => ReviewPresenter.toResponse(r));
  }
}
