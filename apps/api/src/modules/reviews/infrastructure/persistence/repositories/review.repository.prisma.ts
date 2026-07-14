import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '../../../../../generated/prisma/client';
import { PrismaService } from '../../../../../common/infrastructure/prisma/prisma.service';
import type { ReviewTask } from '../../../domain/entities/review-task.entity';
import {
  REVIEW_REPOSITORY,
  type ReviewListFilters,
  type ReviewListPage,
  type ReviewRepositoryPort,
  type ReviewTaskRecord,
} from '../../../domain/repositories/review.repository.port';

@Injectable()
export class ReviewPrismaRepository implements ReviewRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(row: {
    id: string;
    requestId: string;
    taskType: string;
    status: string;
    assignedToUserId: string | null;
    assignedRoleCode: string | null;
    assignedAt: Date | null;
    completedAt: Date | null;
    dueAt: Date | null;
    createdAt: Date;
  }): ReviewTaskRecord {
    return {
      id: row.id,
      requestId: row.requestId,
      taskType: row.taskType,
      status: row.status,
      assignedToUserId: row.assignedToUserId,
      assignedRoleCode: row.assignedRoleCode,
      assignedAt: row.assignedAt,
      completedAt: row.completedAt,
      dueAt: row.dueAt,
      createdAt: row.createdAt,
    };
  }

  async findById(id: string): Promise<ReviewTaskRecord | null> {
    const row = await this.prisma.reviewTask.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByRequest(requestId: string): Promise<ReviewTaskRecord[]> {
    const rows = await this.prisma.reviewTask.findMany({
      where: { requestId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async list(inputs: { filters: ReviewListFilters; page: number; pageSize: number }): Promise<ReviewListPage> {
    const where: Prisma.ReviewTaskWhereInput = {};
    if (inputs.filters.requestId) where.requestId = inputs.filters.requestId;
    if (inputs.filters.status) where.status = inputs.filters.status as Prisma.ReviewTaskWhereInput['status'];
    if (inputs.filters.assignedToUserId) where.assignedToUserId = inputs.filters.assignedToUserId;
    if (inputs.filters.assignedRoleCode) where.assignedRoleCode = inputs.filters.assignedRoleCode;
    if (inputs.filters.taskType) where.taskType = inputs.filters.taskType as Prisma.ReviewTaskWhereInput['taskType'];
    const [items, total] = await Promise.all([
      this.prisma.reviewTask.findMany({
        where,
        skip: (inputs.page - 1) * inputs.pageSize,
        take: inputs.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.reviewTask.count({ where }),
    ]);
    return {
      items: items.map((r) => this.toDomain(r)),
      total,
      page: inputs.page,
      pageSize: inputs.pageSize,
    };
  }

  async save(task: ReviewTaskRecord): Promise<void> {
    const data: Prisma.ReviewTaskUncheckedCreateInput = {
      id: task.id,
      requestId: task.requestId,
      taskType: task.taskType as Prisma.ReviewTaskUncheckedCreateInput['taskType'],
      status: task.status as Prisma.ReviewTaskUncheckedCreateInput['status'],
      assignedToUserId: task.assignedToUserId,
      assignedRoleCode: task.assignedRoleCode,
      assignedAt: task.assignedAt,
      completedAt: task.completedAt,
      dueAt: task.dueAt,
    };
    await this.prisma.reviewTask.upsert({
      where: { id: task.id },
      create: data,
      update: {
        status: data.status,
        assignedToUserId: data.assignedToUserId,
        assignedRoleCode: data.assignedRoleCode,
        assignedAt: data.assignedAt,
        completedAt: data.completedAt,
        dueAt: data.dueAt,
      },
    });
  }
}

export const REVIEW_REPOSITORY_PROVIDER = {
  provide: REVIEW_REPOSITORY,
  useClass: ReviewPrismaRepository,
};

// Re-export so type imports work properly in mapper
export type { ReviewTask };
