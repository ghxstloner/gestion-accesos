import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { CurrentUser } from '../../../common/presentation/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/presentation/decorators/authenticated-user';
import { DashboardService } from '../application/dashboard.service';

class DashboardDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) nearExpiryDays?: number;
}

/**
 * Dashboard aggregate endpoint — produces a single payload containing all
 * 7 KPI indicators, scoped to the requesting actor's permissions.
 */
@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Aggregate dashboard indicators for current user' })
  async summary(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() q: DashboardDto,
  ) {
    return this.dashboard.summary(actor, {
      nearExpiryDays: q.nearExpiryDays,
    });
  }
}
