import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/infrastructure/prisma/prisma.service';
import type { AuthenticatedUser } from '../../../common/presentation/decorators/authenticated-user';
import type { ReportsService } from '../../reports/application/reports.service';

/** Delta defaults for the "near-expiry" indicator on the dashboard. */
export const DASHBOARD_NEAR_EXPIRY_DAYS = 30;

/**
 * Dashboard summary service — single round-trip aggregate covering all
 * 7 indicators (pending requests, pending issuance, near-expiry credentials,
 * overdue custody, open critical alerts, overdue SLA tasks, recent activity).
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService,
  ) {}

  async summary(
    actor: AuthenticatedUser,
    options: { nearExpiryDays?: number } = {},
  ): Promise<DashboardSummary> {
    const isAdmin = actor.roles.includes('SYSTEM_ADMIN');
    const isCompanyAdmin = !isAdmin && actor.companyId !== null;
    const nearExpiryDays = options.nearExpiryDays ?? DASHBOARD_NEAR_EXPIRY_DAYS;

    const requestWhere = isAdmin ? {} : { companyId: actor.companyId };
    const requestExtraWhere =
      isAdmin || !isCompanyAdmin ? {} : { companyId: actor.companyId };

    const [
      pendingRequests,
      pendingIssuance,
      nearExpiry,
      custodyOverdue,
      criticalAlerts,
      slaOverdue,
      recentActivity,
    ] = await Promise.all([
      // 1. Pending requests (review stages)
      this.prisma.request.count({
        where: {
          ...requestWhere,
          status: {
            in: [
              'SUBMITTED',
              'UNDER_DOCUMENT_REVIEW',
              'PENDING_FINAL_APPROVAL',
              'DOCUMENTS_APPROVED',
            ],
          },
        },
      }),
      // 2. Pending issuance (production stages)
      this.prisma.credential.count({
        where: {
          status: {
            in: ['PENDING_PRODUCTION', 'IN_PRODUCTION', 'READY_FOR_DELIVERY'],
          },
          ...(isAdmin ? {} : { request: requestExtraWhere }),
        },
      }),
      // 3. Near-expiry credentials
      this.prisma.credential.count({
        where: {
          expiresAt: {
            gte: new Date(),
            lte: new Date(Date.now() + nearExpiryDays * 86_400_000),
          },
          status: { notIn: ['REVOKED', 'CANCELLED', 'EXPIRED'] },
          ...(isAdmin ? {} : { request: requestExtraWhere }),
        },
      }),
      // 4. Overdue custody records
      this.prisma.custodyRecord.count({
        where: { returnTime: null, expectedReturnAt: { lt: new Date() } },
      }),
      // 5. Open critical alerts
      this.prisma.operationalAlert.count({
        where: {
          severity: 'CRITICAL',
          status: { in: ['OPEN', 'ACKNOWLEDGED'] },
        },
      }),
      // 6. Overdue SLA tasks
      this.prisma.reviewTask.count({
        where: {
          status: { in: ['PENDING', 'ASSIGNED'] },
          dueAt: { lt: new Date() },
        },
      }),
      // 7. Recent operational activity (last 10 audit events)
      this.recentAuditForActor(actor),
    ]);

    return {
      pendingRequests,
      pendingIssuance,
      nearExpiryCredentials: nearExpiry,
      overdueCustody: custodyOverdue,
      criticalAlerts,
      overdueSlaTasks: slaOverdue,
      recentActivity,
      nearExpiryDays,
      scope: isAdmin ? 'GLOBAL' : isCompanyAdmin ? 'COMPANY' : 'OWN',
    };
  }

  /** Recent audit activity, scoped by actor (admin sees all). */
  private async recentAuditForActor(actor: AuthenticatedUser) {
    const where = actor.roles.includes('SYSTEM_ADMIN')
      ? {}
      : { actorCompanyId: actor.companyId };
    const rows = await this.prisma.auditEvent.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      take: 10,
      select: {
        id: true,
        actorUserId: true,
        action: true,
        aggregateType: true,
        aggregateId: true,
        occurredAt: true,
      },
    });
    return rows.map((r) => ({
      ...r,
      occurredAt: r.occurredAt.toISOString(),
    }));
  }
}

export interface DashboardSummary {
  pendingRequests: number;
  pendingIssuance: number;
  nearExpiryCredentials: number;
  overdueCustody: number;
  criticalAlerts: number;
  overdueSlaTasks: number;
  recentActivity: {
    id: string;
    actorUserId: string | null;
    action: string;
    aggregateType: string;
    aggregateId: string | null;
    occurredAt: string;
  }[];
  nearExpiryDays: number;
  scope: 'GLOBAL' | 'COMPANY' | 'OWN';
}
