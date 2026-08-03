/**
 * SGA Phase 3 — AlertService behaviour spec.
 *
 * The thin application service that sits between the alerts controller and the
 * OperationalAlertRepositoryPort. Covers: list passthrough, permission gating
 * (SYSTEM_ADMIN allowed, COMPACT_USER denied), and NotFoundError when an
 * alert id does not exist.
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
    it('passes the filters through to the repository', async () => {
      const repo = new FakeRepo();
      const svc = new AlertService(repo);
      const page = await svc.list({ severity: 'WARN', status: 'OPEN' });
      expect(page.items).toHaveLength(1);
      expect(page.total).toBe(1);
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
});
