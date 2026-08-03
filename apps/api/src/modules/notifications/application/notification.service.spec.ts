/**
 * SGA Phase 3 — NotificationService behaviour spec.
 *
 * Covers: send passthrough, listForUser (read/unread filter), countUnread
 * (used by the /notifications/unread-count endpoint for the bell badge),
 * markRead ownership enforcement, markAllRead bulk update.
 */
/* eslint-disable @typescript-eslint/require-await */
import type { AuthenticatedUser } from '../../../common/presentation/decorators/authenticated-user';
import { ForbiddenError } from '../../../common/domain/errors/domain-error';
import { NotificationService } from './notification.service';
import type {
  NotificationPayload,
  NotificationPort,
} from '../domain/notification.port';

const ACTOR: AuthenticatedUser = {
  userId: 'u-1',
  companyId: null,
  email: 'self@example.test',
  roles: ['COMPANY_USER'],
  permissions: [],
};

const ADMIN: AuthenticatedUser = {
  userId: 'admin-1',
  companyId: null,
  email: 'admin@example.test',
  roles: ['SYSTEM_ADMIN'],
  permissions: [],
};

interface FakeNotificationRow {
  id: string;
  userId: string;
  readAt: Date | null;
  title: string;
  message: string;
}

/** Fake NotificationPort — collects sent payloads without persistence. */
class FakeSink implements NotificationPort {
  sent: NotificationPayload[] = [];
  async send(payload: NotificationPayload): Promise<void> {
    this.sent.push(payload);
  }
}

/** Fake PrismaService: only the surfaces NotificationService uses. */
function makeFakePrisma(rows: FakeNotificationRow[]) {
  return {
    notification: {
      async findUnique({ where }: { where: { id: string } }) {
        return rows.find((r) => r.id === where.id) ?? null;
      },
      async findMany({
        where,
      }: {
        where: { userId: string; readAt?: { not: null } | null };
      }) {
        return rows.filter((r) => {
          if (r.userId !== where.userId) return false;
          if (where.readAt === null) return r.readAt === null;
          if (where.readAt && where.readAt.not === null) {
            return r.readAt !== null;
          }
          return true;
        });
      },
      async count({ where }: { where: { userId: string; readAt: null } }) {
        return rows.filter(
          (r) => r.userId === where.userId && r.readAt === null,
        ).length;
      },
      async update({
        where,
        data,
      }: {
        where: { id: string };
        data: { readAt: Date };
      }) {
        const r = rows.find((x) => x.id === where.id);
        if (r) r.readAt = data.readAt;
        return r ?? null;
      },
      async updateMany({
        where,
        data,
      }: {
        where: { userId: string; readAt: null };
        data: { readAt: Date };
      }) {
        let count = 0;
        for (const r of rows) {
          if (r.userId === where.userId && r.readAt === null) {
            r.readAt = data.readAt;
            count++;
          }
        }
        return { count };
      },
    },
  };
}

describe('NotificationService', () => {
  describe('send', () => {
    it('forwards the payload to the configured NotificationPort', async () => {
      const sink = new FakeSink();
      const svc = new NotificationService(sink, makeFakePrisma([]) as never);
      await svc.send({
        userId: 'u-2',
        type: 'alert',
        title: 'Hi',
        message: 'Body',
        priority: 'URGENT',
      });
      expect(sink.sent).toHaveLength(1);
      expect(sink.sent[0].title).toBe('Hi');
    });
  });

  describe('listForUser', () => {
    const rows: FakeNotificationRow[] = [
      { id: 'n-1', userId: 'u-1', readAt: null, title: 'a', message: 'm' },
      {
        id: 'n-2',
        userId: 'u-1',
        readAt: new Date(),
        title: 'b',
        message: 'm',
      },
      { id: 'n-3', userId: 'u-2', readAt: null, title: 'c', message: 'm' },
    ];

    it('returns all rows for the user when no filter is passed', async () => {
      const svc = new NotificationService(
        new FakeSink(),
        makeFakePrisma(rows) as never,
      );
      const list = await svc.listForUser('u-1', {});
      expect(list).toHaveLength(2);
    });

    it('filters to unread only when read=false', async () => {
      const svc = new NotificationService(
        new FakeSink(),
        makeFakePrisma(rows) as never,
      );
      const list = await svc.listForUser('u-1', { read: false });
      expect(list.every((r) => r.readAt === null)).toBe(true);
      expect(list.find((r) => r.id === 'n-1')).toBeTruthy();
    });
  });

  describe('countUnread', () => {
    it('returns the number of unread notifications for the user', async () => {
      const rows: FakeNotificationRow[] = [
        { id: 'x1', userId: 'u-1', readAt: null, title: 'a', message: 'm' },
        { id: 'x2', userId: 'u-1', readAt: null, title: 'a', message: 'm' },
        {
          id: 'x3',
          userId: 'u-1',
          readAt: new Date(),
          title: 'a',
          message: 'm',
        },
        { id: 'x4', userId: 'u-2', readAt: null, title: 'a', message: 'm' },
      ];
      const svc = new NotificationService(
        new FakeSink(),
        makeFakePrisma(rows) as never,
      );
      const n = await svc.countUnread('u-1');
      expect(n).toBe(2);
    });

    it('returns 0 when the user has no notifications', async () => {
      const svc = new NotificationService(
        new FakeSink(),
        makeFakePrisma([]) as never,
      );
      const n = await svc.countUnread('absent-user');
      expect(n).toBe(0);
    });
  });

  describe('markRead', () => {
    it('marks the row as read when the actor owns it', async () => {
      const rows: FakeNotificationRow[] = [
        { id: 'n-1', userId: 'u-1', readAt: null, title: 'a', message: 'm' },
      ];
      const svc = new NotificationService(
        new FakeSink(),
        makeFakePrisma(rows) as never,
      );
      await svc.markRead(ACTOR, 'n-1');
      expect(rows[0].readAt).not.toBeNull();
    });

    it('rejects when the actor is neither the owner nor SYSTEM_ADMIN', async () => {
      const rows: FakeNotificationRow[] = [
        {
          id: 'n-1',
          userId: 'someone-else',
          readAt: null,
          title: 'a',
          message: 'm',
        },
      ];
      const svc = new NotificationService(
        new FakeSink(),
        makeFakePrisma(rows) as never,
      );
      await expect(svc.markRead(ACTOR, 'n-1')).rejects.toBeInstanceOf(
        ForbiddenError,
      );
      expect(rows[0].readAt).toBeNull();
    });

    it('marks someone else notification as read when actor is SYSTEM_ADMIN', async () => {
      const rows: FakeNotificationRow[] = [
        {
          id: 'n-1',
          userId: 'other-user',
          readAt: null,
          title: 'a',
          message: 'm',
        },
      ];
      const svc = new NotificationService(
        new FakeSink(),
        makeFakePrisma(rows) as never,
      );
      await svc.markRead(ADMIN, 'n-1');
      expect(rows[0].readAt).not.toBeNull();
    });

    it('is a no-op when the notification does not exist', async () => {
      const svc = new NotificationService(
        new FakeSink(),
        makeFakePrisma([]) as never,
      );
      await expect(svc.markRead(ACTOR, 'missing')).resolves.toBeUndefined();
    });
  });

  describe('markAllRead', () => {
    it('marks only the actor-owned unread rows', async () => {
      const rows: FakeNotificationRow[] = [
        { id: 'n-1', userId: 'u-1', readAt: null, title: 'a', message: 'm' },
        { id: 'n-2', userId: 'u-1', readAt: null, title: 'a', message: 'm' },
        { id: 'n-3', userId: 'u-2', readAt: null, title: 'a', message: 'm' },
      ];
      const svc = new NotificationService(
        new FakeSink(),
        makeFakePrisma(rows) as never,
      );
      await svc.markAllRead(ACTOR);
      expect(rows[0].readAt).not.toBeNull();
      expect(rows[1].readAt).not.toBeNull();
      expect(rows[2].readAt).toBeNull();
    });
  });
});
