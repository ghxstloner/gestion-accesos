import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
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

/** Query filters supported by the audit list / detail / export endpoints. */
export interface AuditListFilters {
  from?: Date;
  to?: Date;
  actorUserId?: string;
  actorCompanyId?: string;
  action?: string;
  aggregateType?: string;
  aggregateId?: string;
  result?: 'SUCCESS' | 'FAILURE';
  correlationId?: string;
  page: number;
  pageSize: number;
}

/** Field paths whose values must be redacted in any prev/new payload. */
const SENSITIVE_KEYS = new Set([
  'password',
  'passwordHash',
  'newPassword',
  'currentPassword',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'jwtSecret',
  'hashedPassword',
  'documentNumber',
  'documentIdentifier',
  'cardCode',
  'cardMaterialData',
]);

export const REDACTED = '***REDACTED***';

/** Recursively mask sensitive keys inside JSON-shaped payloads. */
export function maskSensitive<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    const arr = value as unknown[];
    return arr.map((v) => maskSensitive(v)) as unknown as T;
  }
  if (typeof value === 'object' && !(value instanceof Date)) {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(src)) {
      out[k] = SENSITIVE_KEYS.has(k) ? REDACTED : maskSensitive(v);
    }
    return out as unknown as T;
  }
  return value;
}

/** CSV cell escaper per RFC 4180 — wraps in quotes and doubles inner quotes. */
export function csvCell(raw: unknown): string {
  const s =
    raw === null || raw === undefined
      ? ''
      : typeof raw === 'string'
        ? raw
        : typeof raw === 'number' || typeof raw === 'boolean'
          ? String(raw)
          : JSON.stringify(raw);
  if (/["\n\r,]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(
  rows: Record<string, unknown>[],
  columns: string[],
): string {
  const head = columns.join(',');
  const body = rows
    .map((r) => columns.map((c) => csvCell(r[c])).join(','))
    .join('\n');
  return rows.length ? `${head}\n${body}` : head;
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
    actorCompanyId?: string;
    action?: string;
    page: number;
    pageSize: number;
  }) {
    const result = await this.query({
      aggregateType: filters.aggregateType,
      aggregateId: filters.aggregateId,
      actorUserId: filters.actorUserId,
      actorCompanyId: filters.actorCompanyId,
      action: filters.action,
      page: filters.page,
      pageSize: filters.pageSize,
    });
    return result;
  }

  /** Build the Prisma where-clause from the unified filter object. */
  private buildWhere(filters: AuditListFilters): Prisma.AuditEventWhereInput {
    const where: Prisma.AuditEventWhereInput = {};
    if (filters.from || filters.to) {
      where.occurredAt = {
        ...(filters.from && { gte: filters.from }),
        ...(filters.to && { lte: filters.to }),
      };
    }
    if (filters.actorUserId) where.actorUserId = filters.actorUserId;
    if (filters.actorCompanyId) {
      where.actorCompanyId = filters.actorCompanyId;
    }
    if (filters.aggregateType) where.aggregateType = filters.aggregateType;
    if (filters.aggregateId) where.aggregateId = filters.aggregateId;
    if (filters.correlationId) where.correlationId = filters.correlationId;
    if (filters.result) {
      // The action string carries the outcome suffix when present
      // ("<action>.success" / "<action>.failure"). We substring-match.
      where.action = { contains: `.${filters.result.toLowerCase()}` };
    }
    if (filters.action) where.action = filters.action;
    return where;
  }

  private maskRow(r: {
    id: string;
    actorUserId: string | null;
    actorCompanyId: string | null;
    action: string;
    aggregateType: string;
    aggregateId: string | null;
    previousData: unknown;
    newData: unknown;
    metadata: unknown;
    ipAddress: string | null;
    userAgent: string | null;
    correlationId: string | null;
    occurredAt: Date;
  }) {
    return {
      id: r.id,
      actorUserId: r.actorUserId,
      actorCompanyId: r.actorCompanyId,
      action: r.action,
      aggregateType: r.aggregateType,
      aggregateId: r.aggregateId,
      previousData: maskSensitive(r.previousData),
      newData: maskSensitive(r.newData),
      metadata: maskSensitive(r.metadata),
      ipAddress: r.ipAddress,
      userAgent: r.userAgent,
      correlationId: r.correlationId,
      occurredAt: r.occurredAt.toISOString(),
    };
  }

  /**
   * Filtered list with the full advanced filter set. Reuses list() pattern
   * but accepts the richer AuditListFilters contract used by the new
   * /audit/query and /audit/export endpoints.
   */
  async query(filters: AuditListFilters) {
    const where = this.buildWhere(filters);
    const [items, total] = await Promise.all([
      this.prisma.auditEvent.findMany({
        where,
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.auditEvent.count({ where }),
    ]);
    return {
      items: items.map((r) => this.maskRow(r)),
      total,
      page: filters.page,
      pageSize: filters.pageSize,
    };
  }

  /** Single audit event detail with prev/new diff payloads. */
  async detail(id: string) {
    const r = await this.prisma.auditEvent.findUnique({ where: { id } });
    if (!r) return null;
    return this.maskRow(r);
  }

  /** Generate a CSV string respecting the same filters + masking as query(). */
  async exportCsv(filters: AuditListFilters): Promise<string> {
    const where = this.buildWhere(filters);
    // Hard cap to avoid unbounded memory growth; clients should narrow ranges.
    const rows = await this.prisma.auditEvent.findMany({
      where,
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: 10_000,
    });
    const masked = rows.map((r) => this.maskRow(r));
    return toCsv(
      masked.map((r) => ({
        occurredAt: r.occurredAt,
        actorUserId: r.actorUserId ?? '',
        action: r.action,
        aggregateType: r.aggregateType,
        aggregateId: r.aggregateId ?? '',
        correlationId: r.correlationId ?? '',
      })),
      [
        'occurredAt',
        'actorUserId',
        'action',
        'aggregateType',
        'aggregateId',
        'correlationId',
      ],
    );
  }
}
