import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateAuthorizedSignerDto {
  @ApiProperty() @IsUUID() signerUserId!: string;

  @ApiProperty() @IsString() @MinLength(1) @MaxLength(120) position!: string;

  @ApiProperty({ format: 'date-time' }) @IsDateString() validFrom!: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  authorizationDocumentId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() signatureFileId?: string;
}

export class UpdateAuthorizedSignerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  position?: string;
  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  validFrom?: string;
  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  validUntil?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() authorizationDocumentId?:
    string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() signatureFileId?:
    string | null;
}

export class RevokeSignerDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(500) reason!: string;
}

export class AuthorizedSignerResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() companyId!: string;
  @ApiProperty() signerUserId!: string;
  @ApiProperty() position!: string;
  @ApiProperty({ format: 'date-time' }) validFrom!: Date;
  @ApiProperty({ format: 'date-time', nullable: true })
  validUntil!: Date | null;
  @ApiProperty({ nullable: true }) authorizationDocumentId!: string | null;
  @ApiProperty({ nullable: true }) signatureFileId!: string | null;
  @ApiProperty({
    description:
      'Stored status (ACTIVE, INACTIVE, REVOKED). See `effectiveStatus` for derived EXPIRED state.',
  })
  status!: 'ACTIVE' | 'INACTIVE' | 'REVOKED';
  @ApiProperty({
    description:
      'Derived state including the EXPIRED case when validUntil has passed.',
  })
  effectiveStatus!: string;
  @ApiProperty({ format: 'date-time', nullable: true }) revokedAt!: Date | null;
  @ApiProperty({ nullable: true }) revokedBy!: string | null;
  @ApiProperty({ nullable: true }) revocationReason!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;
}
