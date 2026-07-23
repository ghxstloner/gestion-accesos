import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
export enum ReviewTaskTypeDto {
  DOCUMENT_REVIEW = 'DOCUMENT_REVIEW',
  FINAL_APPROVAL = 'FINAL_APPROVAL',
}

export enum ReviewTransitionDto {
  ASSIGN = 'assign',
  UNASSIGN = 'unassign',
  APPROVE_DOCUMENTS = 'approve_documents',
  REJECT_DOCUMENTS = 'reject_documents',
  APPROVE_FINAL = 'approve_final',
  RETURN = 'return',
  REJECT = 'reject',
}

export class CreateReviewTaskDto {
  @ApiProperty()
  @IsUUID()
  requestId!: string;

  @ApiProperty({ enum: ReviewTaskTypeDto })
  @IsEnum(ReviewTaskTypeDto)
  taskType!: ReviewTaskTypeDto;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsString()
  dueAt?: string | null;

  @ApiPropertyOptional({ description: 'Optional role code to seed assignment' })
  @IsOptional()
  @IsString()
  assignedRoleCode?: string | null;
}

export class TransitionReviewTaskDto {
  @ApiProperty({ enum: ReviewTransitionDto })
  @IsEnum(ReviewTransitionDto)
  transition!: ReviewTransitionDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reasonCode?: string | null;
}

export class ListReviewTasksDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  requestId?: string;

  @ApiPropertyOptional({ enum: ReviewTaskTypeDto })
  @IsOptional()
  @IsEnum(ReviewTaskTypeDto)
  taskType?: ReviewTaskTypeDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedToUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedRoleCode?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class AssignReviewTaskDto {
  @ApiPropertyOptional({
    description: 'User ID to assign (defaults to caller)',
  })
  @IsOptional()
  @IsUUID()
  assignedToUserId?: string;
}
