import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
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

  @ApiPropertyOptional({
    description: 'Subject User ID the credential is bound to',
  })
  @IsOptional()
  @IsUUID()
  subjectUserId?: string | null;

  @ApiPropertyOptional({
    description: 'Holder display name printed on the credential',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  holderName?: string | null;

  @ApiPropertyOptional({
    description:
      'Authorized zone catalog item ids; must be a subset of the request approvable areas',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  authorizedZones?: string[] | null;

  @ApiPropertyOptional({
    description: 'Card / badge code printed or encoded on the credential',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  cardCode?: string | null;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Issue date (defaults to now)',
  })
  @IsOptional()
  @IsDateString()
  issuedAt?: string | null;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Expiration date (must be after issuedAt)',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observations?: string | null;

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
  subjectUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cardCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  credentialNumber?: string;

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

export class ReusePhotoDto {
  @ApiProperty({
    description:
      'Explicit issuer confirmation that the previous photo should be reused',
  })
  @IsString()
  confirm!: 'CONFIRM';
}

export class ReplaceCredentialDto {
  @ApiProperty()
  @IsString()
  reason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  cardCode?: string | null;
}

export enum PhotoSourceDto {
  CAPTURED = 'CAPTURED',
  UPLOADED = 'UPLOADED',
}

export class DepositCustodyDto {
  @ApiProperty()
  @IsUUID()
  credentialId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  holderName?: string | null;

  @ApiProperty()
  @IsString()
  @MaxLength(50)
  documentType!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  documentIdentifier!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  temporaryPermitRef?: string | null;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  expectedReturnAt?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class ReturnCustodyDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  returnReceivedBy!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  returnCondition?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class ListCustodyDto {
  @ApiPropertyOptional({ enum: ['ACTIVE', 'RETURNED', 'OVERDUE'] })
  @IsOptional()
  @IsString()
  status?: 'ACTIVE' | 'RETURNED' | 'OVERDUE';

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  subjectUserId?: string;

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
