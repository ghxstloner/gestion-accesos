import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListAlertsDto {
  @ApiPropertyOptional({
    enum: ['CREDENTIAL', 'CUSTODY', 'WORKFLOW', 'REVIEW', 'JOB'],
  })
  @IsOptional()
  @IsEnum(['CREDENTIAL', 'CUSTODY', 'WORKFLOW', 'REVIEW', 'JOB'])
  scope?: 'CREDENTIAL' | 'CUSTODY' | 'WORKFLOW' | 'REVIEW' | 'JOB';

  @ApiPropertyOptional({ enum: ['INFO', 'WARN', 'CRITICAL'] })
  @IsOptional()
  @IsEnum(['INFO', 'WARN', 'CRITICAL'])
  severity?: 'INFO' | 'WARN' | 'CRITICAL';

  @ApiPropertyOptional({ enum: ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'] })
  @IsOptional()
  @IsEnum(['OPEN', 'ACKNOWLEDGED', 'RESOLVED'])
  status?: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 200, default: 50 })
  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
