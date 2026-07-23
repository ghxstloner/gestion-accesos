import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { RequirePermissions } from '../../../common/presentation/decorators/permissions.decorator';
import { AuditService } from '../application/audit.service';

class ListAuditDto {
  @IsOptional() @IsString() aggregateType?: string;
  @IsOptional() @IsString() aggregateId?: string;
  @IsOptional() @IsString() actorUserId?: string;
  @IsOptional() @IsString() action?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

@ApiTags('audit')
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermissions('audit.read')
  @ApiOperation({ summary: 'List audit events' })
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
}
