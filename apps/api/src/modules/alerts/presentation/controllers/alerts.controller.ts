import { Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
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
  @Throttle({ medium: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'List operational alerts (filterable + paginated)' })
  async list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListAlertsDto,
  ) {
    const page = await this.alertService.list(actor, {
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
        // companyId is exposed so the UI can surface tenant scope: null =
        // GLOBAL system-level alert (visible to all callers with read perms).
        companyId: a.companyId,
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

  @Get(':id')
  @RequirePermissions('alerts.read')
  @Throttle({ medium: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Get a single operational alert' })
  async detail(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const a = await this.alertService.findById(actor, id);
    return {
      id: a.id,
      ruleCode: a.ruleCode,
      severity: a.severity,
      entityType: a.entityType,
      entityId: a.entityId,
      title: a.title,
      message: a.message,
      status: a.status,
      companyId: a.companyId,
      observedAt: a.observedAt.toISOString(),
      acknowledgedByUserId: a.acknowledgedByUserId,
      acknowledgedAt: a.acknowledgedAt ? a.acknowledgedAt.toISOString() : null,
      resolvedAt: a.resolvedAt ? a.resolvedAt.toISOString() : null,
      metadata: a.metadata,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    };
  }

  @Post(':id/acknowledge')
  @HttpCode(204)
  @RequirePermissions('alerts.acknowledge')
  @Throttle({ medium: { ttl: 60_000, limit: 30 } })
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
  @Throttle({ medium: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Resolve an operational alert' })
  async resolve(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.alertService.resolve(actor, id);
  }
}
