import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../common/infrastructure/prisma/prisma.service';

export interface AuditEntry {
  actorUserId?: string | null;
  actorCompanyId?: string | null;
  action: string;
  aggregateType: string;
  aggregateId?: string | null;
  previousData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

/**
 * Append-only audit log writer. Always best-effort — never throws
 * into the calling flow.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      const data: Prisma.AuditEventUncheckedCreateInput = {
        id: randomUUID(),
        actorUserId: entry.actorUserId ?? null,
        actorCompanyId: entry.actorCompanyId ?? null,
        action: entry.action,
        aggregateType: entry.aggregateType,
        aggregateId: entry.aggregateId ?? null,
        previousData:
          (entry.previousData as Prisma.InputJsonValue) ?? undefined,
        newData: (entry.newData as Prisma.InputJsonValue) ?? undefined,
        metadata: (entry.metadata as Prisma.InputJsonValue) ?? undefined,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
        correlationId: entry.correlationId ?? null,
      };
      await this.prisma.auditEvent.create({ data });
    } catch (err) {
      this.logger.error(
        `Failed to write audit entry: ${(err as Error).message}`,
      );
    }
  }

  async list(filters: {
    aggregateType?: string;
    aggregateId?: string;
    actorUserId?: string;
    action?: string;
    page: number;
    pageSize: number;
  }) {
    const where: Prisma.AuditEventWhereInput = {};
    if (filters.aggregateType) where.aggregateType = filters.aggregateType;
    if (filters.aggregateId) where.aggregateId = filters.aggregateId;
    if (filters.actorUserId) where.actorUserId = filters.actorUserId;
    if (filters.action) where.action = filters.action;
    const [items, total] = await Promise.all([
      this.prisma.auditEvent.findMany({
        where,
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
        orderBy: { occurredAt: 'desc' },
      }),
      this.prisma.auditEvent.count({ where }),
    ]);
    return {
      items: items.map((r) => ({
        id: r.id,
        actorUserId: r.actorUserId,
        actorCompanyId: r.actorCompanyId,
        action: r.action,
        aggregateType: r.aggregateType,
        aggregateId: r.aggregateId,
        previousData: r.previousData,
        newData: r.newData,
        metadata: r.metadata,
        ipAddress: r.ipAddress,
        userAgent: r.userAgent,
        correlationId: r.correlationId,
        occurredAt: r.occurredAt.toISOString(),
      })),
      total,
      page: filters.page,
      pageSize: filters.pageSize,
    };
  }
}
