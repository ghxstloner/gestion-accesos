import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../../../common/presentation/decorators/authenticated-user';
import { ForbiddenError } from '../../../common/domain/errors/domain-error';
import type { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../common/infrastructure/prisma/prisma.service';
import {
  NOTIFICATION_PORT,
  type NotificationPayload,
  type NotificationPort,
} from '../domain/notification.port';

export interface ListNotificationsFilters {
  read?: boolean;
}

@Injectable()
export class NotificationService {
  constructor(
    @Inject(NOTIFICATION_PORT) private readonly sink: NotificationPort,
    private readonly prisma: PrismaService,
  ) {}

  async send(payload: NotificationPayload): Promise<void> {
    await this.sink.send(payload);
  }

  async listForUser(userId: string, filters: ListNotificationsFilters) {
    const where: Prisma.NotificationWhereInput = { userId };
    if (filters.read === true) where.readAt = { not: null };
    if (filters.read === false) where.readAt = null;
    return this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async markRead(actor: AuthenticatedUser, id: string): Promise<void> {
    const row = await this.prisma.notification.findUnique({ where: { id } });
    if (!row) return;
    if (row.userId !== actor.userId && !actor.roles.includes('SYSTEM_ADMIN')) {
      throw new ForbiddenError(
        'You can only mark your own notifications as read',
      );
    }
    await this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(actor: AuthenticatedUser): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId: actor.userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
