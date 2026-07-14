import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export enum CredentialTypeDto {
  PERMANENT_CARD = 'PERMANENT_CARD',
  TEMPORARY_PERSON_PASS = 'TEMPORARY_PERSON_PASS',
  TEMPORARY_VEHICLE_PASS = 'TEMPORARY_VEHICLE_PASS',
  TEMPORARY_EQUIPMENT_PASS = 'TEMPORARY_EQUIPMENT_PASS',
}

export enum CredentialTransitionDto {
  START_PRODUCTION = 'start_production',
  MARK_READY = 'mark_ready',
  RETURN_TO_PRODUCTION = 'return_to_production',
  DELIVER = 'deliver',
  SUSPEND = 'suspend',
  REVOKE = 'revoke',
  CANCEL = 'cancel',
  REACTIVATE = 'reactivate',
  MARK_EXPIRED = 'mark_expired',
  CORRECT_DELIVERY = 'correct_delivery',
}

export class IssueCredentialDto {
  @ApiProperty()
  @IsUUID()
  requestId!: string;

  @ApiProperty({ enum: CredentialTypeDto })
  @IsEnum(CredentialTypeDto)
  credentialType!: CredentialTypeDto;

  @ApiPropertyOptional({ description: 'Person ID the credential is bound to' })
  @IsOptional()
  @IsUUID()
  personId?: string | null;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string | null;
}

export class TransitionCredentialDto {
  @ApiProperty({ enum: CredentialTransitionDto })
  @IsEnum(CredentialTransitionDto)
  transition!: CredentialTransitionDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string | null;
}

export class DeliverCredentialDto {
  @ApiProperty()
  @IsString()
  receivedByName!: string;

  @ApiProperty()
  @IsString()
  receivedByIdentification!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observations?: string | null;
}

export class CorrectDeliveryDto {
  @ApiProperty()
  @IsString()
  reason!: string;
}

export class ListCredentialsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ enum: CredentialTypeDto })
  @IsOptional()
  @IsEnum(CredentialTypeDto)
  credentialType?: CredentialTypeDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  requestId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  personId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

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
