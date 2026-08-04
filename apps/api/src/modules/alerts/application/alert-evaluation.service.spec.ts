/**
 * SGA Phase 3 — AlertEvaluationService behaviour spec.
 *
 * Covers: rule→job mapping, threshold plumbing, idempotent upsert
 * (no duplicate notifications), retry-safety (a failing rule does NOT poison
 * the batch), lease acquisition (skip when not acquired), notification dispatch
 * only when created=true, unknown-rule graceful skip. Uses in-memory fakes for
 * the three repository ports and for NotificationService — no DB.
 */
/* eslint-disable @typescript-eslint/require-await */
import { AlertEvaluationService } from './alert-evaluation.service';
import type {
  AlertRuleRecord,
  AlertRuleRepositoryPort,
  OperationalAlertRecord,
  OperationalAlertRepositoryPort,
  ScheduledJobRecord,
  ScheduledJobRepositoryPort,
  AlertUpsertInput,
  OperationalAlertListPage,
} from '../domain/repositories/alert.repository.port';
import type { NotificationPayload } from '../../notifications/domain/notification.port';

// ── Helpers / fakes ────────────────────────────────────────────────────────

function rule(over: Partial<AlertRuleRecord> = {}): AlertRuleRecord {
  return {
    id: 'rule-' + (over.code ?? 'x'),
    code: 'credential.near_expiry',
    name: 'Test rule',
    description: null,
    scope: 'CREDENTIAL',
    thresholdDays: 30,
    severity: 'INFO',
    enabled: true,
    lastRunAt: null,
    lastResultJson: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

class FakeRules implements AlertRuleRepositoryPort {
  store: AlertRuleRecord[] = [];
  runs: Array<{ code: string; at: Date; result: unknown }> = [];

  async findAll() {
    return this.store;
  }
  async findByCode(code: string) {
    return this.store.find((r) => r.code === code) ?? null;
  }
  async seedDefaults() {
    return 0;
  }
  async registerRun(code: string, at: Date, result: unknown) {
    this.runs.push({ code, at, result });
  }
}

class FakeAlerts implements OperationalAlertRepositoryPort {
  store: OperationalAlertRecord[] = [];
  /** Force upsertObservation to throw for a given ruleCode — used to exercise
   *  retry-safety. */
  throwingFor: Set<string> = new Set();

  async list(): Promise<OperationalAlertListPage> {
    return {
      items: [...this.store],
      total: this.store.length,
      page: 1,
      limit: 200,
    };
  }
  async upsertObservation(
    input: AlertUpsertInput,
  ): Promise<{ created: boolean; alert: OperationalAlertRecord }> {
    if (this.throwingFor.has(input.ruleCode)) {
      throw new Error('boom-' + input.ruleCode);
    }
    const existing = this.store.find(
      (a) =>
        a.ruleCode === input.ruleCode &&
        a.entityType === input.entityType &&
        a.entityId === input.entityId &&
        a.status !== 'RESOLVED',
    );
    if (existing) {
      existing.observedAt = input.observedAt ?? new Date();
      existing.title = input.title;
      existing.message = input.message;
      return { created: false, alert: existing };
    }
    const rec: OperationalAlertRecord = {
      id: 'alert-' + (this.store.length + 1),
      ruleId: input.ruleId,
      ruleCode: input.ruleCode,
      entityType: input.entityType,
      entityId: input.entityId,
      title: input.title,
      message: input.message,
      severity: input.severity,
      status: 'OPEN',
      companyId: input.companyId ?? null,
      observedAt: input.observedAt ?? new Date(),
      acknowledgedByUserId: null,
      acknowledgedAt: null,
      resolvedAt: null,
      metadata: input.metadata ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.store.push(rec);
    return { created: true, alert: rec };
  }
  async findById(id: string) {
    return this.store.find((a) => a.id === id) ?? null;
  }
  async acknowledge() {
    return {} as OperationalAlertRecord;
  }
  async resolve() {
    return {} as OperationalAlertRecord;
  }
}

class FakeJobs implements ScheduledJobRepositoryPort {
  acquire = true;
  store: ScheduledJobRecord[] = [];
  marks: Array<{ code: string; result: 'SUCCESS' | 'FAILED'; err?: string }> =
    [];

  async findByCode() {
    return null;
  }
  async tryStart() {
    return { acquired: this.acquire, record: null };
  }
  async markSuccess(code: string) {
    this.marks.push({ code, result: 'SUCCESS' });
  }
  async markFailed(code: string, error: string) {
    this.marks.push({ code, result: 'FAILED', err: error });
  }
}

class FakeNotifications {
  sent: NotificationPayload[] = [];
  async send(payload: NotificationPayload) {
    this.sent.push(payload);
  }
}

// Faker for the PrismaService — exposes typed subsets of the model delegates
// used by the service's finders.
function makeFakePrisma(opts: {
  credentials?: Array<{
    id: string;
    credentialNumber: string;
    holderName: string | null;
    expiresAt: Date | null;
    status: string;
  }>;
  custody?: Array<{
    id: string;
    credentialId: string;
    holderName: string | null;
    expectedReturnAt: Date | null;
    returnTime: Date | null;
  }>;
  reviewTasks?: Array<{
    id: string;
    taskType: string;
    status: string;
    createdAt: Date;
  }>;
  scheduledJobs?: Array<{
    id: string;
    code: string;
    lastError: string | null;
    lastRunAt: Date | null;
    lastStatus: string | null;
  }>;
  admins?: Array<{ id: string }>;
}) {
  return {
    credential: {
      async findMany({ where }: { where: Record<string, unknown> }) {
        let rows = opts.credentials ?? [];
        if (where?.expiresAt) {
          const cond = where.expiresAt as {
            gte?: Date;
            lte?: Date;
            lt?: Date;
          };
          rows = rows.filter((c) => {
            const e = c.expiresAt?.getTime() ?? 0;
            if (cond.gte && (!e || e < cond.gte.getTime())) return false;
            if (cond.lte && (!e || e > cond.lte.getTime())) return false;
            if (cond.lt && (!e || e >= cond.lt.getTime())) return false;
            return true;
          });
        }
        if (where?.status && (where.status as { notIn?: string[] }).notIn) {
          const banned = new Set((where.status as { notIn: string[] }).notIn);
          rows = rows.filter((c) => !banned.has(c.status));
        }
        return rows;
      },
    },
    custodyRecord: {
      async findMany({ where }: { where: Record<string, unknown> }) {
        let rows = opts.custody ?? [];
        if (where?.returnTime === null) {
          rows = rows.filter((c) => c.returnTime === null);
        }
        if (where?.expectedReturnAt) {
          const cond = where.expectedReturnAt as { lt?: Date };
          rows = rows.filter(
            (c) =>
              c.expectedReturnAt !== null &&
              cond.lt !== undefined &&
              c.expectedReturnAt.getTime() < cond.lt.getTime(),
          );
        }
        return rows;
      },
    },
    reviewTask: {
      async findMany({ where }: { where: Record<string, unknown> }) {
        let rows = opts.reviewTasks ?? [];
        if (where?.createdAt) {
          const cond = where.createdAt as { lt?: Date };
          rows = rows.filter(
            (t) =>
              cond.lt !== undefined &&
              t.createdAt.getTime() < cond.lt.getTime(),
          );
        }
        if (where?.status) {
          const cond = where.status as { in?: string[] };
          rows = rows.filter(
            (t) => cond.in === undefined || cond.in.includes(t.status),
          );
        }
        return rows;
      },
    },
    scheduledJob: {
      async findMany({ where }: { where: Record<string, unknown> }) {
        const rows = opts.scheduledJobs ?? [];
        if (where?.lastStatus) {
          return rows.filter((j) => j.lastStatus === where.lastStatus);
        }
        return rows;
      },
    },
    user: {
      async findMany() {
        return opts.admins ?? [];
      },
    },
  };
}

type PrismaLike = ReturnType<typeof makeFakePrisma>;

function makeService(
  rules: FakeRules,
  alerts: FakeAlerts,
  jobs: FakeJobs,
  notifications: FakeNotifications,
  prisma: PrismaLike,
) {
  return new AlertEvaluationService(
    rules,
    alerts,
    jobs,
    prisma as never,
    notifications as never,
  );
}

const now = new Date();
const days = (n: number) => new Date(now.getTime() + n * 86400_000);

// ── Tests ──────────────────────────────────────────────────────────────────

describe('AlertEvaluationService', () => {
  describe('seedDefaults', () => {
    it('delegates to the repository seed port', async () => {
      const rules = new FakeRules();
      const seedInput = [{ ...rule(), id: undefined }] as never;
      rules.seedDefaults = async () => 7;
      const svc = makeService(
        rules,
        new FakeAlerts(),
        new FakeJobs(),
        new FakeNotifications(),
        makeFakePrisma({}),
      );
      await expect(svc.seedDefaults(seedInput)).resolves.toBe(7);
    });
  });

  describe('runJob — lease acquisition', () => {
    it('skips the run when the lease cannot be acquired and emits no alerts', async () => {
      const rules = new FakeRules();
      rules.store = [rule({ code: 'credential.near_expiry' })];
      const alerts = new FakeAlerts();
      const jobs = new FakeJobs();
      jobs.acquire = false;
      const notifications = new FakeNotifications();
      const svc = makeService(
        rules,
        alerts,
        jobs,
        notifications,
        makeFakePrisma({}),
      );

      const summary = await svc.runJob('alerts.evaluate_credentials');

      expect(summary.skipped).toBe(true);
      expect(summary.rulesEvaluated).toBe(0);
      expect(summary.alertsCreated).toBe(0);
      expect(alerts.store).toHaveLength(0);
      expect(notifications.sent).toHaveLength(0);
      expect(jobs.marks).toHaveLength(0); // No SUCCESS/FAILED when skipped
    });
  });

  describe('evaluateOne — threshold plumbing', () => {
    it('honours the configured thresholdDays for near-expiry rules', async () => {
      const rules = new FakeRules();
      const credRule = rule({
        code: 'credential.near_expiry',
        scope: 'CREDENTIAL',
        thresholdDays: 15,
      });
      const svc = makeService(
        rules,
        new FakeAlerts(),
        new FakeJobs(),
        new FakeNotifications(),
        makeFakePrisma({
          credentials: [
            {
              id: 'c-1',
              credentialNumber: 'CAR-1',
              holderName: 'Alice',
              // 10 days out — inside the 15-day window
              expiresAt: days(10),
              status: 'ACTIVE',
            },
            {
              id: 'c-2',
              credentialNumber: 'CAR-2',
              holderName: 'Bob',
              // 40 days out — outside the 15-day window
              expiresAt: days(40),
              status: 'ACTIVE',
            },
          ],
        }),
      );

      const count = await svc.evaluateOne(credRule, 'cid-test');
      expect(count).toBe(1); // only Alice's credential qualifies
    });

    it('uses 30-day default when thresholdDays is null', async () => {
      const rules = new FakeRules();
      const credRule = rule({
        code: 'credential.near_expiry',
        thresholdDays: null,
      });
      const svc = makeService(
        rules,
        new FakeAlerts(),
        new FakeJobs(),
        new FakeNotifications(),
        makeFakePrisma({
          credentials: [
            {
              id: 'c-1',
              credentialNumber: 'CAR-1',
              holderName: 'A',
              expiresAt: days(25),
              status: 'ACTIVE',
            },
            {
              id: 'c-2',
              credentialNumber: 'CAR-2',
              holderName: 'B',
              expiresAt: days(50),
              status: 'ACTIVE',
            },
          ],
        }),
      );
      const count = await svc.evaluateOne(credRule, 'cid-test');
      expect(count).toBe(1);
    });
  });

  describe('evaluateOne — idempotency', () => {
    it('does not double-dispatch notifications when the same rule fires twice on the same entity', async () => {
      const alerts = new FakeAlerts();
      const notifications = new FakeNotifications();
      const credRule = rule({ code: 'credential.near_expiry' });
      const svc = makeService(
        new FakeRules(),
        alerts,
        new FakeJobs(),
        notifications,
        makeFakePrisma({
          credentials: [
            {
              id: 'c-1',
              credentialNumber: 'CAR-1',
              holderName: 'A',
              expiresAt: days(5),
              status: 'ACTIVE',
            },
          ],
          admins: [{ id: 'admin-1' }],
        }),
      );

      const first = await svc.evaluateOne(credRule, 'cid-1');
      const second = await svc.evaluateOne(credRule, 'cid-2');

      // First run creates 1 alert; second run is upsert (no new alert)
      expect(first).toBe(1);
      expect(second).toBe(0);
      // Only ONE notification was dispatched (only when created=true)
      expect(notifications.sent).toHaveLength(1);
      // And the store has a single row
      expect(alerts.store).toHaveLength(1);
    });
  });

  describe('runJob — retry safety', () => {
    it('records FAILED on the job when a rule throws but does NOT abort the whole batch', async () => {
      const rules = new FakeRules();
      rules.store = [
        rule({ code: 'credential.near_expiry', scope: 'CREDENTIAL' }),
        rule({ code: 'credential.expired', scope: 'CREDENTIAL' }),
      ];
      const alerts = new FakeAlerts();
      // Force the rule that actually finds observations to throw, so we can
      // verify the failing rule is captured but doesn't abort the whole run.
      alerts.throwingFor.add('credential.expired');
      const jobs = new FakeJobs();
      const svc = makeService(
        rules,
        alerts,
        jobs,
        new FakeNotifications(),
        makeFakePrisma({
          credentials: [
            {
              id: 'c-1',
              credentialNumber: 'CAR-1',
              holderName: 'A',
              expiresAt: days(-3),
              status: 'ACTIVE',
            },
          ],
        }),
      );

      const summary = await svc.runJob('alerts.evaluate_credentials');

      // credential.expired threw (so 0 alerts created); credential.near_expiry
      // found no rows (Alice is already past the near window), so 0 too.
      expect(summary.alertsCreated).toBe(0);
      expect(jobs.marks).toHaveLength(1);
      expect(jobs.marks[0].result).toBe('FAILED');
      expect(jobs.marks[0].err).toContain('credential.expired');
      expect(jobs.marks[0].err).toContain('boom');
    });
  });

  describe('runJob — rule filtering per job code', () => {
    it('only evaluates CREDENTIAL rules when running the credentials job', async () => {
      const rules = new FakeRules();
      rules.store = [
        rule({
          id: 'r-cred',
          code: 'credential.near_expiry',
          scope: 'CREDENTIAL',
        }),
        rule({
          id: 'r-cust',
          code: 'custody.overdue',
          scope: 'CUSTODY',
        }),
      ];
      const alerts = new FakeAlerts();
      const jobs = new FakeJobs();
      const svc = makeService(
        rules,
        alerts,
        jobs,
        new FakeNotifications(),
        makeFakePrisma({
          credentials: [
            {
              id: 'c-1',
              credentialNumber: 'CAR-1',
              holderName: 'A',
              expiresAt: days(5),
              status: 'ACTIVE',
            },
          ],
          custody: [
            {
              id: 'cust-1',
              credentialId: 'c-2',
              holderName: 'C',
              expectedReturnAt: days(-2),
              returnTime: null,
            },
          ],
        }),
      );

      const summary = await svc.runJob('alerts.evaluate_credentials');

      expect(summary.rulesEvaluated).toBe(1);
      // The custody row did NOT generate an alert because the wrong rule class ran.
      const onlyCred = alerts.store.every(
        (a) => a.ruleCode === 'credential.near_expiry',
      );
      expect(onlyCred).toBe(true);
      expect(alerts.store.some((a) => a.ruleCode === 'custody.overdue')).toBe(
        false,
      );
    });

    it('evaluates WORKFLOW and REVIEW rules for the workflows job', async () => {
      const rules = new FakeRules();
      rules.store = [
        rule({
          id: 'r-wf',
          code: 'workflow.sla_overdue',
          scope: 'WORKFLOW',
          thresholdDays: 5,
        }),
      ];
      const jobs = new FakeJobs();
      const svc = makeService(
        rules,
        new FakeAlerts(),
        jobs,
        new FakeNotifications(),
        makeFakePrisma({
          reviewTasks: [
            {
              id: 'rt-1',
              taskType: 'DOCUMENTARY',
              status: 'PENDING',
              createdAt: days(-10),
            },
          ],
        }),
      );

      const summary = await svc.runJob('alerts.evaluate_workflows');
      expect(summary.rulesEvaluated).toBe(1);
      expect(summary.alertsCreated).toBe(1);
    });
  });

  describe('evaluateOne — unknown rules', () => {
    it('returns 0 and emits no alerts for an unmapped rule code', async () => {
      const svc = makeService(
        new FakeRules(),
        new FakeAlerts(),
        new FakeJobs(),
        new FakeNotifications(),
        makeFakePrisma({}),
      );
      const unknown = rule({
        code: 'unknown.future_rule',
        scope: 'CREDENTIAL',
      });
      const count = await svc.evaluateOne(unknown, 'cid-x');
      expect(count).toBe(0);
    });
  });

  describe('evaluateOne — disabled rules', () => {
    it('does not produce alerts for disabled rules when run via runJob', async () => {
      const rules = new FakeRules();
      rules.store = [
        rule({
          code: 'credential.near_expiry',
          scope: 'CREDENTIAL',
          enabled: false,
        }),
      ];
      const alerts = new FakeAlerts();
      const svc = makeService(
        rules,
        alerts,
        new FakeJobs(),
        new FakeNotifications(),
        makeFakePrisma({
          credentials: [
            {
              id: 'c-1',
              credentialNumber: 'CAR-1',
              holderName: 'A',
              expiresAt: days(5),
              status: 'ACTIVE',
            },
          ],
        }),
      );

      const summary = await svc.runJob('alerts.evaluate_credentials');
      expect(summary.rulesEvaluated).toBe(0);
      expect(alerts.store).toHaveLength(0);
    });
  });

  describe('runJob — logs + marks SUCCESS on healthy runs', () => {
    it('marks the job SUCCESS when all rules completed without throwing', async () => {
      const rules = new FakeRules();
      rules.store = [
        rule({ code: 'credential.near_expiry', scope: 'CREDENTIAL' }),
      ];
      const jobs = new FakeJobs();
      const svc = makeService(
        rules,
        new FakeAlerts(),
        jobs,
        new FakeNotifications(),
        makeFakePrisma({
          credentials: [],
        }),
      );

      await svc.runJob('alerts.evaluate_credentials');
      expect(jobs.marks).toEqual([
        { code: 'alerts.evaluate_credentials', result: 'SUCCESS' },
      ]);
    });
  });
});
