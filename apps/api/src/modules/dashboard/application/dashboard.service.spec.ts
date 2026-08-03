/**
 * DashboardService — single-round-trip aggregate spec covering the 7 KPI
 * indicators under different role scopes plus empty datasets.
 */
import { DashboardService } from './dashboard.service';
import type { ReportsService } from '../../reports/application/reports.service';
import type { AuthenticatedUser } from '../../../common/presentation/decorators/authenticated-user';

function fakeUser(
  roles: string[],
  companyId: string | null = null,
): AuthenticatedUser {
  return {
    userId: 'u1',
    companyId,
    email: 'test@example.test',
    roles,
    permissions: [],
    correlationId: undefined,
  };
}

interface FakeCounts {
  req?: number;
  issuance?: number;
  expiry?: number;
  custody?: number;
  alerts?: number;
  sla?: number;
}

function makeFakePrisma(_counts: FakeCounts) {
  return {
    request: { count: () => Promise.resolve(_counts.req ?? 0) },
    credential: { count: () => Promise.resolve(_counts.issuance ?? 0) },
    custodyRecord: { count: () => Promise.resolve(_counts.custody ?? 0) },
    operationalAlert: { count: () => Promise.resolve(_counts.alerts ?? 0) },
    reviewTask: { count: () => Promise.resolve(_counts.sla ?? 0) },
    auditEvent: { findMany: () => Promise.resolve([]) },
  };
}

describe('DashboardService.summary', () => {
  // ReportsService is only used for recentActivity lookup; we stub its
  // recentAuditForActor implicitly via the auditEvent.findMany fake.
  const fakeReports = {
    recentAuditForActor: () => Promise.resolve([]),
  } as unknown as ReportsService;

  it('SYSTEM_ADMIN scope returns GLOBAL', async () => {
    const svc = new DashboardService(
      makeFakePrisma({}) as unknown as never,
      fakeReports,
    );
    const out = await svc.summary(fakeUser(['SYSTEM_ADMIN']));
    expect(out.scope).toBe('GLOBAL');
    expect(out.pendingRequests).toBe(0);
    expect(out.pendingIssuance).toBe(0);
    expect(out.recentActivity).toEqual([]);
  });

  it('COMPANY_ADMIN scope returns COMPANY', async () => {
    const svc = new DashboardService(
      makeFakePrisma({}) as unknown as never,
      fakeReports,
    );
    const out = await svc.summary(fakeUser(['COMPANY_ADMIN'], 'c1'));
    expect(out.scope).toBe('COMPANY');
  });

  it('returns 0 totals on empty dataset', async () => {
    const svc = new DashboardService(
      makeFakePrisma({}) as unknown as never,
      fakeReports,
    );
    const out = await svc.summary(fakeUser(['SYSTEM_ADMIN']));
    expect(out.pendingRequests).toBe(0);
    expect(out.nearExpiryCredentials).toBe(0);
    expect(out.overdueCustody).toBe(0);
    expect(out.criticalAlerts).toBe(0);
    expect(out.overdueSlaTasks).toBe(0);
  });

  it('includes all 7 indicators with expected keys', async () => {
    const svc = new DashboardService(
      makeFakePrisma({}) as unknown as never,
      fakeReports,
    );
    const out = await svc.summary(fakeUser(['SYSTEM_ADMIN']));
    expect(out).toHaveProperty('pendingRequests');
    expect(out).toHaveProperty('pendingIssuance');
    expect(out).toHaveProperty('nearExpiryCredentials');
    expect(out).toHaveProperty('overdueCustody');
    expect(out).toHaveProperty('criticalAlerts');
    expect(out).toHaveProperty('overdueSlaTasks');
    expect(out).toHaveProperty('recentActivity');
  });

  it('honours overridden nearExpiryDays', async () => {
    const svc = new DashboardService(
      makeFakePrisma({}) as unknown as never,
      fakeReports,
    );
    const out = await svc.summary(fakeUser(['SYSTEM_ADMIN']), {
      nearExpiryDays: 60,
    });
    expect(out.nearExpiryDays).toBe(60);
  });
});
