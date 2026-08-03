import {
  Controller,
  Get,
  Header,
  Param,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Response } from 'express';
import { Readable } from 'node:stream';
import { RequirePermissions } from '../../../common/presentation/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/presentation/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/presentation/decorators/authenticated-user';
import { AuditService } from '../application/audit.service';

class ListAuditDto {
  @IsOptional() @IsString() aggregateType?: string;
  @IsOptional() @IsString() aggregateId?: string;
  @IsOptional() @IsString() actorUserId?: string;
  @IsOptional() @IsString() action?: string;
  @IsOptional() @IsString() aggregateTypeFilter?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

class AuditQueryDto {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsString() actorUserId?: string;
  @IsOptional() @IsString() actorCompanyId?: string;
  @IsOptional() @IsString() action?: string;
  @IsOptional() @IsString() aggregateType?: string;
  @IsOptional() @IsString() aggregateId?: string;
  @IsOptional() @IsString() correlationId?: string;
  @IsOptional()
  @IsEnum(['SUCCESS', 'FAILURE'])
  result?: 'SUCCESS' | 'FAILURE';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

/**
 * Audit query controllers. All endpoints are read-only and append-only:
 * the API never mutates or deletes audit records. SYSTEM_ADMIN sees all
 * events; COMPANY_ADMIN is restricted to events on their own company.
 */
@ApiTags('audit')
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermissions('audit.read')
  @ApiOperation({ summary: 'List audit events (simple filters)' })
  async list(@Query() q: ListAuditDto) {
    return this.auditService.list({
      aggregateType: q.aggregateType,
      aggregateId: q.aggregateId,
      actorUserId: q.actorUserId,
      action: q.action,
      page: q.page ?? 1,
      pageSize: q.pageSize ?? 20,
    });
  }

  @Get('query')
  @RequirePermissions('audit.read')
  @ApiOperation({ summary: 'Query audit events with advanced filters' })
  async query(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() q: AuditQueryDto,
  ) {
    return this.auditService.query({
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
      actorUserId: q.actorUserId,
      // COMPANY_ADMIN is restricted to their own company regardless of input.
      actorCompanyId: actor.roles.includes('SYSTEM_ADMIN')
        ? q.actorCompanyId
        : actor.companyId,
      action: q.action,
      aggregateType: q.aggregateType,
      aggregateId: q.aggregateId,
      correlationId: q.correlationId,
      result: q.result,
      page: q.page ?? 1,
      pageSize: q.pageSize ?? 20,
    });
  }

  @Get('export')
  @RequirePermissions('audit.read')
  @ApiOperation({ summary: 'Export filtered audit events as CSV' })
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportCsv(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() q: AuditQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    // Auditable: the export action itself is recorded for traceability.
    await this.auditService.record({
      actorUserId: actor.userId,
      actorCompanyId: actor.companyId,
      action: 'audit.export.csv',
      aggregateType: 'audit',
      correlationId: actor.correlationId ?? undefined,
      metadata: {
        filters: {
          from: q.from,
          to: q.to,
          actorUserId: q.actorUserId,
          action: q.action,
          aggregateType: q.aggregateType,
          correlationId: q.correlationId,
        },
      },
    });
    const csv = await this.auditService.exportCsv({
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
      actorUserId: q.actorUserId,
      actorCompanyId: actor.roles.includes('SYSTEM_ADMIN')
        ? q.actorCompanyId
        : actor.companyId,
      action: q.action,
      aggregateType: q.aggregateType,
      aggregateId: q.aggregateId,
      correlationId: q.correlationId,
      result: q.result,
      page: 1,
      pageSize: 10_000,
    });
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="audit-${stamp}.csv"`,
    );
    return new StreamableFile(Readable.from([csv]));
  }

  @Get(':id')
  @RequirePermissions('audit.read')
  @ApiOperation({ summary: 'Audit event detail (prev/new diff)' })
  async detail(@Param('id') id: string) {
    const row = await this.auditService.detail(id);
    return row ?? { error: 'Not found' };
  }
}
