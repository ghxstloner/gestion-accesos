import { Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/presentation/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../common/presentation/decorators/authenticated-user';
import { NotificationService } from '../application/notification.service';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'List current user notifications' })
  async list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query('read') read?: string,
  ) {
    const parsed =
      read === undefined ? undefined : read === 'true' ? true : false;
    const rows = await this.notificationService.listForUser(actor.userId, {
      read: parsed,
    });
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      message: r.message,
      entityType: r.entityType,
      entityId: r.entityId,
      readAt: r.readAt ? r.readAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  @Post(':id/read')
  @HttpCode(204)
  @ApiOperation({ summary: 'Mark one notification as read' })
  async markRead(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    await this.notificationService.markRead(actor, id);
  }

  @Post('read-all')
  @HttpCode(204)
  @ApiOperation({ summary: 'Mark all current user notifications as read' })
  async markAllRead(@CurrentUser() actor: AuthenticatedUser) {
    await this.notificationService.markAllRead(actor);
  }
}
