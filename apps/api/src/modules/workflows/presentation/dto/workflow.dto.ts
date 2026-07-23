import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

// ─── Definitions ───

export class CreateWorkflowDefinitionDto {
  @ApiProperty({ description: 'Unique snake_case key (3-100 chars [a-z0-9_])' })
  @IsString()
  @MaxLength(100)
  key!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({
    enum: ['NEW_PERSONNEL', 'TEMPORARY_PERSONNEL', 'VEHICLE', 'EQUIPMENT'],
  })
  @IsOptional()
  @IsString()
  requestType?: string | null;
}

export class UpdateWorkflowDefinitionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;
}

export class WorkflowDefinitionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() key!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true }) description!: string | null;
  @ApiProperty({
    nullable: true,
    enum: ['NEW_PERSONNEL', 'TEMPORARY_PERSONNEL', 'VEHICLE', 'EQUIPMENT'],
  })
  requestType!: string | null;
  @ApiProperty({ enum: ['DRAFT', 'PUBLISHED', 'RETIRED'] }) status!: string;
  @ApiProperty() createdByUserId!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;
}

// ─── Versions ───

export class WorkflowGraphDto {
  @ApiProperty({ description: 'schemaVersion (currently 1)' })
  @IsInt()
  @Min(1)
  schemaVersion!: number;

  @ApiProperty({ type: 'array', isArray: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowNodeDto)
  nodes!: WorkflowNodeDto[];

  @ApiProperty({ type: 'array', isArray: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowEdgeDto)
  edges!: WorkflowEdgeDto[];
}

export class WorkflowNodeDto {
  @ApiProperty() @IsString() key!: string;
  @ApiProperty({ enum: ['START', 'END', 'HUMAN_TASK', 'SYSTEM', 'DECISION'] })
  @IsString()
  type!: string;

  @ApiProperty() @IsString() name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'For HUMAN_TASK nodes: who can claim' })
  @IsOptional()
  @IsObject()
  assignment?: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      'Node-type-specific config (outcomes for HUMAN_TASK, systemAction for SYSTEM, etc.)',
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class WorkflowEdgeDto {
  @ApiProperty() @IsString() from!: string;
  @ApiProperty() @IsString() to!: string;
  @ApiProperty({
    description:
      'Action that triggers this edge (BEGIN for START, COMPLETE for SYSTEM/DECISION, an outcome for HUMAN_TASK)',
  })
  @IsString()
  action!: string;

  @ApiPropertyOptional({
    description: 'Structured condition DSL (no JS allowed)',
  })
  @IsOptional()
  @IsObject()
  condition?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Higher priority wins when multiple edges match. Default 0.',
  })
  @IsOptional()
  @IsInt()
  priority?: number;
}

export class CreateWorkflowVersionDto {
  @ApiProperty({ type: WorkflowGraphDto })
  @ValidateNested()
  @Type(() => WorkflowGraphDto)
  definitionJson!: WorkflowGraphDto;
}

export class UpdateWorkflowVersionDto extends CreateWorkflowVersionDto {}

export class WorkflowVersionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() workflowDefinitionId!: string;
  @ApiProperty() versionNumber!: number;
  @ApiProperty({ enum: ['DRAFT', 'PUBLISHED', 'RETIRED'] }) status!: string;
  @ApiProperty() schemaVersion!: number;
  @ApiProperty({ type: WorkflowGraphDto }) definitionJson!: unknown;
  @ApiProperty() checksum!: string;
  @ApiProperty() createdByUserId!: string;
  @ApiProperty({ nullable: true }) publishedByUserId!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ format: 'date-time', nullable: true })
  publishedAt!: Date | null;
}

export class StartWorkflowInputDto {
  @ApiProperty() @IsString() requestId!: string;

  @ApiPropertyOptional({
    description: 'Optional extra context to seed the EvaluationContext',
  })
  @IsOptional()
  @IsObject()
  contextPatch?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Optional idempotency key for replay-safe start',
  })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class WorkflowInstanceResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() requestId!: string;
  @ApiProperty() workflowVersionId!: string;
  @ApiProperty({ enum: ['ACTIVE', 'COMPLETED', 'CANCELLED', 'FAILED'] })
  status!: string;
  @ApiProperty({ type: Object }) contextJson!: unknown;
  @ApiProperty({ format: 'date-time' }) startedAt!: string;
  @ApiProperty({ format: 'date-time', nullable: true }) completedAt!:
    string | null;
  @ApiProperty({ format: 'date-time', nullable: true }) cancelledAt!:
    string | null;
  @ApiProperty() lockVersion!: number;
  @ApiProperty({ nullable: true }) currentNodeKey!: string | null;
  @ApiProperty() autoTransitionCount!: number;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class CompleteTaskDto {
  @ApiProperty({
    enum: [
      'APPROVE',
      'REJECT',
      'RETURN_FOR_CORRECTION',
      'RESUBMIT',
      'CANCEL',
      'COMPLETE',
    ],
  })
  @IsString()
  outcome!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  comment?: string | null;

  @ApiPropertyOptional({ description: 'Optional idempotency key' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class WorkflowTaskResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() workflowInstanceId!: string;
  @ApiProperty() nodeInstanceId!: string;
  @ApiProperty({
    enum: ['PENDING', 'CLAIMED', 'COMPLETED', 'CANCELLED', 'EXPIRED'],
  })
  status!: string;
  @ApiProperty({ enum: ['ROLE', 'USER'] }) assignmentType!: string;
  @ApiProperty({ nullable: true }) assignedUserId!: string | null;
  @ApiProperty({ nullable: true }) assignedRoleCode!: string | null;
  @ApiProperty({ nullable: true }) assignedCompanyId!: string | null;
  @ApiProperty({ nullable: true }) claimedByUserId!: string | null;
  @ApiProperty({ nullable: true }) outcome!: string | null;
  @ApiProperty({ nullable: true }) comment!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}
