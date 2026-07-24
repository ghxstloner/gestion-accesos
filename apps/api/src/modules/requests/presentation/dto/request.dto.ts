import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export enum RequestParticipantRoleDto {
  PRIMARY = 'PRIMARY',
  BENEFICIARY = 'BENEFICIARY',
}

export enum RequestTransitionDto {
  SUBMIT = 'submit',
  RESUBMIT = 'resubmit',
  CANCEL = 'cancel',
  RETURN = 'return',
  REJECT = 'reject',
  ADVANCE_TO_DOC_REVIEW = 'advance_to_document_review',
  APPROVE_DOCUMENTS = 'approve_documents',
  ADVANCE_TO_FINAL = 'advance_to_final',
  APPROVE_FINAL = 'approve_final',
  START_PRODUCTION = 'start_production',
  MARK_READY = 'mark_ready',
  DELIVER = 'deliver',
}

class ParticipantLinkDto {
  /**
   * Optional User account reference. Manual participants (visitors /
   * contractors without a SGA account) omit it. When present, the application
   * layer may use it to autocomplete snapshots when `autocompleteFromUser=true`.
   */
  @ApiPropertyOptional({
    description: 'ID del User vinculado. Opcional para participantes manuales.',
  })
  @IsOptional()
  @IsString()
  participantUserId?: string;

  /**
   * Snapshot of the beneficiary's full name at the moment the request was
   * created. Required when participantUserId is absent.
   */
  @ApiProperty({ description: 'Nombre completo del beneficiario (snapshot).' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  fullNameSnapshot!: string;

  /**
   * Identification number snapshot (cedula / passport / foreign id).
   * Required when participantUserId is absent.
   */
  @ApiProperty({ description: 'Número de identificación (snapshot).' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  identificationSnapshot!: string;

  @ApiPropertyOptional({
    description: 'Tipo de documento (catálogo IDENTIFICATION_TYPE).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  identificationTypeCode?: string;

  @ApiPropertyOptional({ description: 'Cargo / función (snapshot).' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  positionSnapshot?: string;

  @ApiPropertyOptional({ description: 'Departamento (snapshot).' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  departmentSnapshot?: string;

  @ApiPropertyOptional({ description: 'Empresa u organismo (snapshot).' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  companyNameSnapshot?: string;

  @ApiPropertyOptional({
    description:
      'Si participantUserId está presente y se omite algún snapshot, rellenarlo desde el User referenciado.',
  })
  @IsOptional()
  @IsBoolean()
  autocompleteFromUser?: boolean;

  @ApiProperty({ enum: RequestParticipantRoleDto })
  @IsEnum(RequestParticipantRoleDto)
  role!: RequestParticipantRoleDto;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  personalEmergency?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  usePreviousPhoto?: boolean;
}

class VehicleDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(120) brand!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(120) model!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(50) plateNumber!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  color?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2100)
  year?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
}

class EquipmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  brand?: string;
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  equipmentType!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  serialNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number;
}

class AccessPointLinkDto {
  @ApiProperty() @IsString() accessPointId!: string;
}

class AccessAreaLinkDto {
  @ApiProperty() @IsString() accessAreaId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() justification?: string;
}

export class CreateRequestDto {
  @ApiProperty() @IsString() requestTypeId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  authorizedSignerId?: string;

  @ApiProperty() @IsString() @MinLength(1) @MaxLength(5000) reason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  serviceCompanyName?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @ApiPropertyOptional({ description: 'HH:mm' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  scheduleFrom?: string;

  @ApiPropertyOptional({ description: 'HH:mm' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  scheduleUntil?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() observations?: string;

  @ApiPropertyOptional({ type: ParticipantLinkDto })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ParticipantLinkDto)
  participants?: ParticipantLinkDto[];

  @ApiPropertyOptional({ type: VehicleDto })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => VehicleDto)
  vehicles?: VehicleDto[];

  @ApiPropertyOptional({ type: EquipmentDto })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => EquipmentDto)
  equipment?: EquipmentDto[];

  @ApiPropertyOptional({ type: AccessPointLinkDto })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => AccessPointLinkDto)
  accessPoints?: AccessPointLinkDto[];

  @ApiPropertyOptional({ type: AccessAreaLinkDto })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => AccessAreaLinkDto)
  accessAreas?: AccessAreaLinkDto[];
}

export class UpdateRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  authorizedSignerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  serviceCompanyName?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  scheduleFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  scheduleUntil?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() observations?: string;

  @ApiPropertyOptional({ type: ParticipantLinkDto })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParticipantLinkDto)
  participants?: ParticipantLinkDto[];

  @ApiPropertyOptional({ type: VehicleDto })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VehicleDto)
  vehicles?: VehicleDto[];

  @ApiPropertyOptional({ type: EquipmentDto })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EquipmentDto)
  equipment?: EquipmentDto[];

  @ApiPropertyOptional({ type: AccessPointLinkDto })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AccessPointLinkDto)
  accessPoints?: AccessPointLinkDto[];

  @ApiPropertyOptional({ type: AccessAreaLinkDto })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AccessAreaLinkDto)
  accessAreas?: AccessAreaLinkDto[];
}

export class TransitionRequestDto {
  @ApiProperty({ enum: RequestTransitionDto })
  @IsEnum(RequestTransitionDto)
  transition!: RequestTransitionDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  reasonCode?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() comment?: string;
}
