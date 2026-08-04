import { Injectable } from '@nestjs/common';
import { NotFoundError } from '../../../../../common/domain/errors/domain-error';
import { PrismaService } from '../../../../../common/infrastructure/prisma/prisma.service';
import {
  type AlertSeverity,
  type AlertUpsertInput,
  type OperationalAlertListFilters,
  type OperationalAlertListPage,
  type OperationalAlertRecord,
  type OperationalAlertRepositoryPort,
  type OperationalAlertStatus,
} from '../../../domain/repositories/alert.repository.port';

type AlertRow = {
  id: string;
  ruleId: string;
  ruleCode: string;
  severity: AlertSeverity;
  entityType: string;
  entityId: string;
  title: string;
  message: string;
  observedAt: Date;
  status: OperationalAlertStatus;
  companyId: string | null;
  acknowledgedByUserId: string | null;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class OperationalAlertPrismaRepository implements OperationalAlertRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    filters: OperationalAlertListFilters,
  ): Promise<OperationalAlertListPage> {
    const page = Math.max(filters.page ?? 1, 1);
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
    const where: Record<string, unknown> = {};
    if (filters.severity) where.severity = filters.severity;
    if (filters.status) where.status = filters.status;
    if (filters.scope) {
      where.rule = { scope: filters.scope };
    }
    // Tenant filter: a company-scoped caller sees GLOBAL alerts + alerts
    // owned by their company; SYSTEM_ADMIN sees everything (no filter).
    if (filters.companyId !== undefined && filters.companyId !== null) {
      where.OR = [{ companyId: null }, { companyId: filters.companyId }];
    }
    const [rows, total] = await Promise.all([
      this.prisma.operationalAlert.findMany({
        where,
        orderBy: [{ observedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.operationalAlert.count({ where }),
    ]);
    return {
      items: rows.map((r) => this.toRecord(r as AlertRow)),
      total,
      page,
      limit,
    };
  }

  async upsertObservation(
    input: AlertUpsertInput,
  ): Promise<{ created: boolean; alert: OperationalAlertRecord }> {
    // Idempotency gate: existing OPEN/ACKNOWLEDGED rows are refreshed in place
    // so repeated evaluation runs do not duplicate observations. RESOLVED rows
    // are left in place and a new OPEN row is opened (the condition re-occurred).
    const existing = await this.prisma.operationalAlert.findFirst({
      where: {
        ruleCode: input.ruleCode,
        entityType: input.entityType,
        entityId: input.entityId,
        status: { in: ['OPEN', 'ACKNOWLEDGED'] },
      },
      orderBy: { observedAt: 'desc' },
    });
    const observedAt = input.observedAt ?? new Date();
    if (existing) {
      const updated = await this.prisma.operationalAlert.update({
        where: { id: existing.id },
        data: {
          severity: input.severity,
          title: input.title,
          message: input.message,
          observedAt,
          metadata: (input.metadata ?? null) as never,
        },
      });
      return { created: false, alert: this.toRecord(updated) };
    }
    const created = await this.prisma.operationalAlert.create({
      data: {
        ruleId: input.ruleId,
        ruleCode: input.ruleCode,
        severity: input.severity,
        entityType: input.entityType,
        entityId: input.entityId,
        title: input.title,
        message: input.message,
        observedAt,
        companyId: (input.companyId ?? null) as never,
        metadata: (input.metadata ?? null) as never,
      },
    });
    return { created: true, alert: this.toRecord(created) };
  }

  async findById(id: string): Promise<OperationalAlertRecord | null> {
    const row = await this.prisma.operationalAlert.findUnique({
      where: { id },
    });
    return row ? this.toRecord(row) : null;
  }

  async acknowledge(
    id: string,
    userId: string,
  ): Promise<OperationalAlertRecord> {
    const exists = await this.prisma.operationalAlert.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!exists) throw new NotFoundError('Alert not found');
    if (exists.status === 'RESOLVED') {
      // Already resolved — no-op
      const row = await this.prisma.operationalAlert.findUnique({
        where: { id },
      });
      return this.toRecord(row);
    }
    const updated = await this.prisma.operationalAlert.update({
      where: { id },
      data: {
        status: 'ACKNOWLEDGED',
        acknowledgedByUserId: userId,
        acknowledgedAt: new Date(),
      },
    });
    return this.toRecord(updated);
  }

  async resolve(id: string): Promise<OperationalAlertRecord> {
    const exists = await this.prisma.operationalAlert.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundError('Alert not found');
    const updated = await this.prisma.operationalAlert.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
      },
    });
    return this.toRecord(updated);
  }

  private toRecord(row: AlertRow): OperationalAlertRecord {
    return {
      ...row,
      metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    };
  }
}
