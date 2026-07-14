import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export enum DocumentSubjectTypeDto {
  REQUEST = 'REQUEST',
  PERSON = 'PERSON',
}

export enum ReviewDecisionDto {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export class ReviewDocumentDto {
  @ApiProperty({ enum: ReviewDecisionDto })
  @IsEnum(ReviewDecisionDto)
  decision!: ReviewDecisionDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  comment?: string;
}

// Query DTOs
export class ListDocumentsQueryDto {
  @IsOptional() @IsString() requestId?: string;
}

export class ListDocumentsByRequestDto {
  @ApiProperty() @IsString() requestId!: string;
}

export class DocumentRequirementQueryDto {
  @ApiProperty() @IsString() requestTypeId!: string;
}

export class PaginatedDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pageSize?: number;
}
