import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/infrastructure/prisma/prisma.service';
import {
  NOTIFICATION_PORT,
  type NotificationPayload,
  type NotificationPort,
} from '../domain/notification.port';

/**
 * Default in-app persister. Writes the row synchronously.
 * Real-time delivery (email/push/websocket) can be plugged by overriding
 * this provider downstream.
 */
@Injectable()
export class InAppNotificationAdapter implements NotificationPort {
  private readonly logger = new Logger(InAppNotificationAdapter.name);

  constructor(private readonly prisma: PrismaService) {}

  async send(payload: NotificationPayload): Promise<void> {
    try {
      const data: Prisma.NotificationUncheckedCreateInput = {
        id: randomUUID(),
        userId: payload.userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        entityType: payload.entityType ?? null,
        entityId: payload.entityId ?? null,
      };
      await this.prisma.notification.create({ data });
    } catch (err) {
      // Best-effort: notifications must NEVER break the calling flow.
      this.logger.error(
        `Failed to persist notification for user ${payload.userId}: ${(err as Error).message}`,
      );
    }
  }
}

export const NOTIFICATION_PROVIDER = {
  provide: NOTIFICATION_PORT,
  useClass: InAppNotificationAdapter,
};
