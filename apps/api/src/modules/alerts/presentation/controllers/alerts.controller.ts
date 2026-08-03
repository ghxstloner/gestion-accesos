import { Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../../../common/presentation/decorators/permissions.decorator';
import { CurrentUser } from '../../../../common/presentation/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../../common/presentation/decorators/authenticated-user';
import { AlertService } from '../../application/alert.service';
import { ListAlertsDto } from '../dto/list-alerts.dto';

@ApiTags('alerts')
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertService: AlertService) {}

  @Get()
  @RequirePermissions('alerts.read')
  @ApiOperation({ summary: 'List operational alerts (filterable + paginated)' })
  async list(@Query() query: ListAlertsDto) {
    const page = await this.alertService.list({
      scope: query.scope,
      severity: query.severity,
      status: query.status,
      page: query.page,
      limit: query.limit,
    });
    return {
      items: page.items.map((a) => ({
        id: a.id,
        ruleCode: a.ruleCode,
        severity: a.severity,
        entityType: a.entityType,
        entityId: a.entityId,
        title: a.title,
        message: a.message,
        status: a.status,
        observedAt: a.observedAt.toISOString(),
        acknowledgedByUserId: a.acknowledgedByUserId,
        acknowledgedAt: a.acknowledgedAt
          ? a.acknowledgedAt.toISOString()
          : null,
        resolvedAt: a.resolvedAt ? a.resolvedAt.toISOString() : null,
        metadata: a.metadata,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      })),
      total: page.total,
      page: page.page,
      limit: page.limit,
    };
  }

  @Post(':id/acknowledge')
  @HttpCode(204)
  @RequirePermissions('alerts.acknowledge')
  @ApiOperation({ summary: 'Acknowledge an operational alert' })
  async acknowledge(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.alertService.acknowledge(actor, id);
  }

  @Post(':id/resolve')
  @HttpCode(204)
  @RequirePermissions('alerts.acknowledge')
  @ApiOperation({ summary: 'Resolve an operational alert' })
  async resolve(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.alertService.resolve(actor, id);
  }
}
