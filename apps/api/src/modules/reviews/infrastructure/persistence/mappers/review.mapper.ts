import { ReviewTask } from '../../../domain/entities/review-task.entity';
import type { ReviewTaskRecord } from '../../../domain/repositories/review.repository.port';

export class ReviewMapper {
  static toRecord(task: ReviewTask): ReviewTaskRecord {
    const p = task.toProps();
    return {
      id: p.id,
      requestId: p.requestId,
      taskType: p.taskType,
      status: p.status,
      assignedToUserId: p.assignedToUserId,
      assignedRoleCode: p.assignedRoleCode,
      assignedAt: p.assignedAt,
      completedAt: p.completedAt,
      dueAt: p.dueAt,
      createdAt: p.createdAt,
    };
  }

  static toDomain(record: ReviewTaskRecord): ReviewTask {
    return ReviewTask.reconstitute({
      id: record.id,
      requestId: record.requestId,
      taskType: record.taskType as ReviewTask['taskType'],
      status: record.status as ReviewTask['status'],
      assignedToUserId: record.assignedToUserId,
      assignedRoleCode: record.assignedRoleCode,
      assignedAt: record.assignedAt,
      completedAt: record.completedAt,
      dueAt: record.dueAt,
      createdAt: record.createdAt,
    });
  }
}
