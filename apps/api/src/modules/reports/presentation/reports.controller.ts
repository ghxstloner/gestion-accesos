import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { CurrentUser } from '../../../common/presentation/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/presentation/decorators/authenticated-user';
import { RequirePermissions } from '../../../common/presentation/decorators/permissions.decorator';
import { ReportsService } from '../application/reports.service';

class ReportRangeDto {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsString() companyId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) days?: number;
}

/**
 * Operational reports API. All endpoints honour actor scope:
 * SYSTEM_ADMIN sees everything; COMPANY_ADMIN is auto-scoped to their
 * company regardless of the `companyId` filter they pass.
 */
@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  private scope(actor: AuthenticatedUser, q: ReportRangeDto) {
    const isAdmin = actor.roles.includes('SYSTEM_ADMIN');
    return {
      isAdmin,
      actorCompanyId: actor.companyId,
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
      companyId: isAdmin ? q.companyId : actor.companyId,
    };
  }

  @Get('requests/by-status')
  @RequirePermissions('requests.read.all', 'requests.read.company')
  @ApiOperation({ summary: 'Requests grouped by status' })
  async reqByStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() q: ReportRangeDto,
  ) {
    return this.reports.requestsByStatus(this.scope(actor, q));
  }

  @Get('requests/by-type')
  @RequirePermissions('requests.read.all', 'requests.read.company')
  @ApiOperation({ summary: 'Requests grouped by type' })
  async reqByType(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() q: ReportRangeDto,
  ) {
    return this.reports.requestsByType(this.scope(actor, q));
  }

  @Get('requests/by-company')
  @RequirePermissions('requests.read.all')
  @ApiOperation({ summary: 'Requests grouped by company (admin only)' })
  async reqByCompany(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() q: ReportRangeDto,
  ) {
    return this.reports.requestsByCompany(this.scope(actor, q));
  }

  @Get('stage/average-time')
  @RequirePermissions('requests.read.all', 'requests.read.company')
  @ApiOperation({ summary: 'Average time per workflow/review stage' })
  async avgStage(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() q: ReportRangeDto,
  ) {
    return this.reports.averageStageTime(this.scope(actor, q));
  }

  @Get('requests/returned-rejected')
  @RequirePermissions('requests.read.all', 'requests.read.company')
  @ApiOperation({ summary: 'Returned & rejected requests by reason' })
  async returned(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() q: ReportRangeDto,
  ) {
    return this.reports.returnedRejectedByReason(this.scope(actor, q));
  }

  @Get('credentials/by-status')
  @RequirePermissions('issuance.read')
  @ApiOperation({ summary: 'Credentials by status' })
  async credByStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() q: ReportRangeDto,
  ) {
    return this.reports.credentialsByStatus(this.scope(actor, q));
  }

  @Get('credentials/expiring')
  @RequirePermissions('issuance.read')
  @ApiOperation({ summary: 'Credentials expiring within a period' })
  async credExpiring(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() q: ReportRangeDto,
  ) {
    return this.reports.credentialsExpiring(q.days ?? 30, this.scope(actor, q));
  }

  @Get('custody/status')
  @RequirePermissions('issuance.read')
  @ApiOperation({ summary: 'Active and overdue custody records' })
  async custody() {
    return this.reports.custodyStatus();
  }

  @Get('alerts/breakdown')
  @RequirePermissions('alerts.read')
  @ApiOperation({ summary: 'Alerts by scope / severity / status' })
  async alerts() {
    return this.reports.alertsBreakdown();
  }

  @Get('sla/compliance')
  @RequirePermissions('requests.read.all', 'requests.read.company')
  @ApiOperation({ summary: 'Workflow/review SLA compliance' })
  async sla() {
    return this.reports.slaCompliance();
  }

  @Get('productivity')
  @RequirePermissions('issuance.read')
  @ApiOperation({ summary: 'Issuance + delivery productivity by user' })
  async productivity(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() q: ReportRangeDto,
  ) {
    return this.reports.productivity(this.scope(actor, q));
  }
}
