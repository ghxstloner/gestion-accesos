import { Module } from '@nestjs/common';
import { NotificationService } from './application/notification.service';
import { NotificationsController } from './presentation/notifications.controller';
import { NOTIFICATION_PROVIDER } from './infrastructure/in-app-notification.adapter';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationService, NOTIFICATION_PROVIDER],
  exports: [NotificationService, NOTIFICATION_PROVIDER],
})
export class NotificationsModule {}
