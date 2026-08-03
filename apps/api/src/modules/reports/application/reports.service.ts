import { Injectable } from '@nestjs/common';
import type { CredentialStatus } from '@prisma/client';
import { PrismaService } from '../../../common/infrastructure/prisma/prisma.service';

/** Common date-range + scope filter for operational reports. */
export interface ReportRange {
  from?: Date;
  to?: Date;
  companyId?: string | null;
}

interface ActorScoped extends ReportRange {
  /** Whether the requesting actor is SYSTEM_ADMIN (sees all). */
  isAdmin: boolean;
  /** COMPANY_ADMIN-scoped fallback when not admin. */
  actorCompanyId: string | null;
}

/**
 * Operational reports service. Every method uses Prisma groupBy / count
 * aggregates pushed down to the DB — we never load full tables into memory.
 */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Requests grouped by status (optionally bounded by date/company). */
  async requestsByStatus(scope: ActorScoped) {
    const rows = await this.prisma.request.groupBy({
      by: ['status'],
      where: this.requestWhere(scope),
      _count: { _all: true },
      orderBy: { _count: { status: 'desc' } },
    });
    return rows.map((r) => ({ status: r.status, count: r._count._all }));
  }

  /** Requests grouped by request type. */
  async requestsByType(scope: ActorScoped) {
    const rows = await this.prisma.request.groupBy({
      by: ['requestTypeId'],
      where: this.requestWhere(scope),
      _count: { _all: true },
    });
    // Hydrate the catalog code/name in a single round-trip.
    const ids = rows.map((r) => r.requestTypeId);
    const items = ids.length
      ? await this.prisma.catalogItem.findMany({ where: { id: { in: ids } } })
      : [];
    const map = new Map(items.map((i) => [i.id, i]));
    return rows.map((r) => ({
      typeId: r.requestTypeId,
      code: map.get(r.requestTypeId)?.code ?? 'unknown',
      name: map.get(r.requestTypeId)?.name ?? 'Desconocido',
      count: r._count._all,
    }));
  }

  /** Requests grouped by company (admin only meaningful). */
  async requestsByCompany(scope: ActorScoped) {
    const rows = await this.prisma.request.groupBy({
      by: ['companyId'],
      where: this.requestWhere(scope),
      _count: { _all: true },
      orderBy: { _count: { companyId: 'desc' } },
      take: 20,
    });
    const ids = rows.map((r) => r.companyId);
    const companies = ids.length
      ? await this.prisma.company.findMany({ where: { id: { in: ids } } })
      : [];
    const map = new Map(companies.map((c) => [c.id, c]));
    return rows.map((r) => ({
      companyId: r.companyId,
      name: map.get(r.companyId)?.legalName ?? 'Desconocida',
      count: r._count._all,
    }));
  }

  /** Average duration (ms) per workflow task type — a proxy for stage time. */
  async averageStageTime(scope: ActorScoped) {
    const where = {
      completedAt: { not: null },
      request: this.requestWhere(scope),
    };
    // Prisma can't _avg Date diff natively; fall back to a small bounded
    // select. Date math is done in-process on a paginated result set.
    const tasks = await this.prisma.reviewTask.findMany({
      where,
      select: { taskType: true, createdAt: true, completedAt: true },
      take: 5_000,
    });
    const buckets = new Map<string, { sum: number; n: number }>();
    for (const t of tasks) {
      if (!t.completedAt) continue;
      const ms = t.completedAt.getTime() - t.createdAt.getTime();
      const b = buckets.get(t.taskType) ?? { sum: 0, n: 0 };
      b.sum += ms;
      b.n += 1;
      buckets.set(t.taskType, b);
    }
    return Array.from(buckets.entries()).map(([taskType, b]) => ({
      taskType,
      avgMs: b.n ? Math.round(b.sum / b.n) : 0,
      count: b.n,
    }));
  }

  /** Returned + rejected requests broken down by rejection reason. */
  async returnedRejectedByReason(scope: ActorScoped) {
    const where = this.requestWhere(scope);
    const [returned, rejected] = await Promise.all([
      this.prisma.request.groupBy({
        by: ['rejectionReasonId'],
        where: { ...where, status: 'RETURNED_FOR_CORRECTION' },
        _count: { _all: true },
      }),
      this.prisma.request.groupBy({
        by: ['rejectionReasonId'],
        where: { ...where, status: 'REJECTED' },
        _count: { _all: true },
      }),
    ]);
    const ids = Array.from(
      new Set(
        [...returned, ...rejected]
          .map((r) => r.rejectionReasonId)
          .filter((v): v is string => Boolean(v)),
      ),
    );
    const items = ids.length
      ? await this.prisma.catalogItem.findMany({ where: { id: { in: ids } } })
      : [];
    const map = new Map(items.map((i) => [i.id, i]));
    const rowFor = (id: string | null) =>
      id && map.has(id)
        ? { id, name: map.get(id).name }
        : { id: null, name: 'Sin motivo especificado' };
    return [
      ...returned.map((r) => ({
        outcome: 'RETURNED' as const,
        reason: rowFor(r.rejectionReasonId),
        count: r._count._all,
      })),
      ...rejected.map((r) => ({
        outcome: 'REJECTED' as const,
        reason: rowFor(r.rejectionReasonId),
        count: r._count._all,
      })),
    ];
  }

  /** Credentials issued / delivered / suspended / revoked / expired / replaced. */
  async credentialsByStatus(scope: ActorScoped) {
    const where = scope.isAdmin
      ? {}
      : { request: { companyId: scope.actorCompanyId ?? undefined } };
    const rows = await this.prisma.credential.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
      orderBy: { _count: { status: 'desc' } },
    });
    return rows.map((r) => ({ status: r.status, count: r._count._all }));
  }

  /** Credentials expiring within `days` from now. */
  async credentialsExpiring(days: number, scope: ActorScoped) {
    const now = new Date();
    const horizon = new Date(now.getTime() + days * 86_400_000);
    const excludedStatuses: CredentialStatus[] = [
      'REVOKED',
      'CANCELLED',
      'EXPIRED',
    ];
    const where = {
      expiresAt: { gte: now, lte: horizon },
      status: { notIn: excludedStatuses },
      ...(scope.isAdmin
        ? {}
        : { request: { companyId: scope.actorCompanyId ?? undefined } }),
    };
    const [items, total] = await Promise.all([
      this.prisma.credential.findMany({
        where,
        orderBy: { expiresAt: 'asc' },
        take: 100,
        select: {
          id: true,
          credentialNumber: true,
          holderName: true,
          expiresAt: true,
          status: true,
        },
      }),
      this.prisma.credential.count({ where }),
    ]);
    return {
      items,
      total,
      horizon,
    };
  }

  /** Active + overdue temporary custody records. */
  async custodyStatus() {
    const now = new Date();
    const whereActive = { returnTime: null };
    const [active, overdue, activeCount, overdueCount] = await Promise.all([
      this.prisma.custodyRecord.findMany({
        where: whereActive,
        orderBy: { depositTime: 'desc' },
        take: 50,
        select: {
          id: true,
          holderName: true,
          depositTime: true,
          expectedReturnAt: true,
        },
      }),
      this.prisma.custodyRecord.findMany({
        where: { returnTime: null, expectedReturnAt: { lt: now } },
        orderBy: { expectedReturnAt: 'asc' },
        take: 50,
        select: {
          id: true,
          holderName: true,
          depositTime: true,
          expectedReturnAt: true,
        },
      }),
      this.prisma.custodyRecord.count({ where: whereActive }),
      this.prisma.custodyRecord.count({
        where: { returnTime: null, expectedReturnAt: { lt: now } },
      }),
    ]);
    return {
      active: { items: active, total: activeCount },
      overdue: { items: overdue, total: overdueCount },
    };
  }

  /** Operational alerts grouped by scope/severity/status. */
  async alertsBreakdown() {
    const [byScope, bySeverity, byStatus] = await Promise.all([
      this.prisma.operationalAlert.groupBy({
        by: ['entityType'],
        _count: { _all: true },
        orderBy: { _count: { entityType: 'desc' } },
      }),
      this.prisma.operationalAlert.groupBy({
        by: ['severity'],
        _count: { _all: true },
        orderBy: { _count: { severity: 'desc' } },
      }),
      this.prisma.operationalAlert.groupBy({
        by: ['status'],
        _count: { _all: true },
        orderBy: { _count: { status: 'desc' } },
      }),
    ]);
    return {
      byScope: byScope.map((r) => ({
        scope: r.entityType,
        count: r._count._all,
      })),
      bySeverity: bySeverity.map((r) => ({
        severity: r.severity,
        count: r._count._all,
      })),
      byStatus: byStatus.map((r) => ({
        status: r.status,
        count: r._count._all,
      })),
    };
  }

  /** SLA compliance for review/workflow tasks (overdue vs total). */
  async slaCompliance() {
    const now = new Date();
    const totalOpen = await this.prisma.reviewTask.count({
      where: { status: { in: ['PENDING', 'ASSIGNED'] } },
    });
    const overdue = await this.prisma.reviewTask.count({
      where: {
        status: { in: ['PENDING', 'ASSIGNED'] },
        dueAt: { lt: now },
      },
    });
    return {
      totalOpen,
      overdue,
      onTime: Math.max(0, totalOpen - overdue),
      compliancePct:
        totalOpen === 0
          ? 100
          : Math.round(((totalOpen - overdue) / totalOpen) * 100),
    };
  }

  /** Issuance + delivery productivity per responsible user. */
  async productivity(scope: ActorScoped) {
    const where = scope.isAdmin ? {} : { createdBy: { not: undefined } };
    // Group credentials by producer (createdBy)
    const produced = await this.prisma.credential.groupBy({
      by: ['createdBy'],
      where,
      _count: { _all: true },
      orderBy: { _count: { createdBy: 'desc' } },
      take: 30,
    });
    const deliveries = await this.prisma.deliveryRecord.groupBy({
      by: ['deliveredByUserId'],
      _count: { _all: true },
      orderBy: { _count: { deliveredByUserId: 'desc' } },
      take: 30,
    });
    const ids = Array.from(
      new Set([
        ...produced.map((r) => r.createdBy),
        ...deliveries.map((r) => r.deliveredByUserId),
      ]),
    );
    const users = ids.length
      ? await this.prisma.user.findMany({ where: { id: { in: ids } } })
      : [];
    const map = new Map(users.map((u) => [u.id, u]));
    const deliveryMap = new Map(
      deliveries.map((d) => [d.deliveredByUserId, d._count._all]),
    );
    return produced.map((p) => ({
      userId: p.createdBy,
      name: map.get(p.createdBy)
        ? `${map.get(p.createdBy).firstName} ${map.get(p.createdBy).lastName}`
        : 'Desconocido',
      produced: p._count._all,
      delivered: deliveryMap.get(p.createdBy) ?? 0,
    }));
  }

  private requestWhere(scope: ActorScoped) {
    const where: Record<string, unknown> = {};
    if (scope.from || scope.to) {
      where.createdAt = {
        ...(scope.from && { gte: scope.from }),
        ...(scope.to && { lte: scope.to }),
      };
    }
    if (!scope.isAdmin && scope.actorCompanyId) {
      where.companyId = scope.actorCompanyId;
    } else if (scope.companyId) {
      where.companyId = scope.companyId;
    }
    return where;
  }
}
