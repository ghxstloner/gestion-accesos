/**
 * SGA Phase 3 / Phase 6 — AlertService behaviour spec.
 *
 * The thin application service that sits between the alerts controller and the
 * OperationalAlertRepositoryPort. Covers: list passthrough, permission gating
 * (SYSTEM_ADMIN allowed, COMPANY_USER denied), NotFoundError when an alert id
 * does not exist, and Phase-6 tenant isolation (cross-company access blocked).
 */
/* eslint-disable @typescript-eslint/require-await */
import type { AuthenticatedUser } from '../../../common/presentation/decorators/authenticated-user';
import {
  ForbiddenError,
  NotFoundError,
} from '../../../common/domain/errors/domain-error';
import { AlertService } from './alert.service';
import type {
  OperationalAlertRecord,
  OperationalAlertRepositoryPort,
  OperationalAlertListFilters,
  OperationalAlertListPage,
} from '../domain/repositories/alert.repository.port';

const ADMIN: AuthenticatedUser = {
  userId: 'admin-1',
  companyId: null,
  email: 'admin@example.test',
  roles: ['SYSTEM_ADMIN'],
  permissions: ['alerts.read', 'alerts.acknowledge'],
};

const DELEGATED: AuthenticatedUser = {
  userId: 'ops-1',
  companyId: 'co-1',
  email: 'ops@example.test',
  roles: ['COMPANY_ADMIN'],
  permissions: ['alerts.acknowledge'],
};

const READER: AuthenticatedUser = {
  userId: 'reader-1',
  companyId: 'co-1',
  email: 'reader@example.test',
  roles: ['COMPANY_USER'],
  permissions: ['alerts.read'],
};

function alert(
  over: Partial<OperationalAlertRecord> = {},
): OperationalAlertRecord {
  return {
    id: 'a-1',
    ruleId: 'rule-1',
    ruleCode: 'credential.expired',
    severity: 'WARN',
    entityType: 'credential',
    entityId: 'c-1',
    title: 'Test',
    message: 'Test message',
    status: 'OPEN',
    companyId: 'co-1',
    observedAt: new Date(),
    acknowledgedByUserId: null,
    acknowledgedAt: null,
    resolvedAt: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

class FakeRepo implements OperationalAlertRepositoryPort {
  store: OperationalAlertRecord[] = [alert()];

  async list(
    filters: OperationalAlertListFilters,
  ): Promise<OperationalAlertListPage> {
    let items = this.store;
    if (filters.severity) {
      items = items.filter((a) => a.severity === filters.severity);
    }
    if (filters.status) {
      items = items.filter((a) => a.status === filters.status);
    }
    return { items, total: items.length, page: 1, limit: 200 };
  }
  async upsertObservation() {
    return { created: true, alert: alert() };
  }
  async findById(id: string) {
    return this.store.find((a) => a.id === id) ?? null;
  }
  async acknowledge(id: string, userId: string) {
    const r = this.store.find((a) => a.id === id);
    if (r) {
      r.status = 'ACKNOWLEDGED';
      r.acknowledgedByUserId = userId;
      r.acknowledgedAt = new Date();
    }
    return r ?? alert();
  }
  async resolve(id: string) {
    const r = this.store.find((a) => a.id === id);
    if (r) {
      r.status = 'RESOLVED';
      r.resolvedAt = new Date();
    }
    return r ?? alert();
  }
}

describe('AlertService', () => {
  describe('list', () => {
    it('passes the filters through to the repository (no tenant filter for SYSTEM_ADMIN)', async () => {
      const repo = new FakeRepo();
      const svc = new AlertService(repo);
      const page = await svc.list(ADMIN, {
        severity: 'WARN',
        status: 'OPEN',
      });
      expect(page.items).toHaveLength(1);
      expect(page.total).toBe(1);
    });

    it('passes companyId filter through for COMPANY_ADMIN', async () => {
      const repo = new FakeRepo();
      const filterSpy: OperationalAlertListFilters[] = [];
      repo.list = async (filters) => {
        filterSpy.push(filters);
        return { items: [alert()], total: 1, page: 1, limit: 200 };
      };
      const svc = new AlertService(repo);
      await svc.list(DELEGATED, { status: 'OPEN' });
      expect(filterSpy[0].companyId).toBe('co-1');
    });
  });

  describe('acknowledge — permission gating', () => {
    it('allows SYSTEM_ADMIN to acknowledge', async () => {
      const repo = new FakeRepo();
      const svc = new AlertService(repo);
      await expect(svc.acknowledge(ADMIN, 'a-1')).resolves.toBeUndefined();
      expect(repo.store[0].status).toBe('ACKNOWLEDGED');
      expect(repo.store[0].acknowledgedByUserId).toBe('admin-1');
    });

    it('allows a user with alerts.acknowledge to acknowledge', async () => {
      const repo = new FakeRepo();
      const svc = new AlertService(repo);
      await expect(svc.acknowledge(DELEGATED, 'a-1')).resolves.toBeUndefined();
      expect(repo.store[0].status).toBe('ACKNOWLEDGED');
      expect(repo.store[0].acknowledgedByUserId).toBe('ops-1');
    });

    it('rejects a user without the permission or role', async () => {
      const repo = new FakeRepo();
      const svc = new AlertService(repo);
      await expect(svc.acknowledge(READER, 'a-1')).rejects.toBeInstanceOf(
        ForbiddenError,
      );
      expect(repo.store[0].status).toBe('OPEN');
    });

    it('rejects a COMPANY_ADMIN asking for a foreign-tenant alert', async () => {
      const repo = new FakeRepo();
      const svc = new AlertService(repo);
      // DELEGATED belongs to co-1; the alert in store also is co-1, so add a
      // foreign-owned alert and try to touch it.
      repo.store.push(alert({ id: 'a-foreign', companyId: 'co-other' }));
      await expect(
        svc.acknowledge(DELEGATED, 'a-foreign'),
      ).rejects.toBeInstanceOf(NotFoundError);
      // The foreign alert must remain untouched.
      const foreign = repo.store.find((a) => a.id === 'a-foreign');
      expect(foreign?.status).toBe('OPEN');
      expect(foreign?.acknowledgedByUserId).toBeNull();
    });
  });

  describe('resolve — permission gating', () => {
    it('allows SYSTEM_ADMIN', async () => {
      const repo = new FakeRepo();
      const svc = new AlertService(repo);
      await expect(svc.resolve(ADMIN, 'a-1')).resolves.toBeUndefined();
      expect(repo.store[0].status).toBe('RESOLVED');
    });

    it('allows delegated permission', async () => {
      const repo = new FakeRepo();
      const svc = new AlertService(repo);
      await expect(svc.resolve(DELEGATED, 'a-1')).resolves.toBeUndefined();
    });

    it('rejects unauthorized caller', async () => {
      const repo = new FakeRepo();
      const svc = new AlertService(repo);
      await expect(svc.resolve(READER, 'a-1')).rejects.toBeInstanceOf(
        ForbiddenError,
      );
    });
  });

  describe('acknowledge / resolve — unknown alert', () => {
    it('throws NotFoundError when the alert id does not exist (admin)', async () => {
      const repo = new FakeRepo();
      const svc = new AlertService(repo);
      await expect(svc.acknowledge(ADMIN, 'missing')).rejects.toBeInstanceOf(
        NotFoundError,
      );
      await expect(svc.resolve(ADMIN, 'missing')).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it('throws ForbiddenError BEFORE checking existence (so unauthorized users cannot probe ids)', async () => {
      const repo = new FakeRepo();
      const svc = new AlertService(repo);
      await expect(svc.acknowledge(READER, 'missing')).rejects.toBeInstanceOf(
        ForbiddenError,
      );
    });
  });

  describe('tenant isolation (Phase 6)', () => {
    it('findById returns the alert for SYSTEM_ADMIN regardless of company', async () => {
      const repo = new FakeRepo();
      repo.store.push(alert({ id: 'a-foreign', companyId: 'co-other' }));
      const svc = new AlertService(repo);
      await expect(svc.findById(ADMIN, 'a-foreign')).resolves.toMatchObject({
        id: 'a-foreign',
      });
    });

    it('findById hides foreign-company alerts (NotFoundError, not ForbiddenError)', async () => {
      const repo = new FakeRepo();
      repo.store.push(alert({ id: 'a-foreign', companyId: 'co-other' }));
      const svc = new AlertService(repo);
      await expect(svc.findById(DELEGATED, 'a-foreign')).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it('findById still returns GLOBAL (companyId=null) alerts to COMPANY_ADMIN', async () => {
      const repo = new FakeRepo();
      repo.store.push(alert({ id: 'a-global', companyId: null }));
      const svc = new AlertService(repo);
      await expect(svc.findById(DELEGATED, 'a-global')).resolves.toMatchObject({
        id: 'a-global',
        companyId: null,
      });
    });

    it('rejects COMPANY_USER without a company scope at all (no implicit global)', async () => {
      const rootless: AuthenticatedUser = {
        ...READER,
        companyId: null,
        roles: ['COMPANY_USER'],
      };
      const repo = new FakeRepo();
      const svc = new AlertService(repo);
      await expect(svc.list(rootless, {})).rejects.toBeInstanceOf(
        ForbiddenError,
      );
    });
  });
});
