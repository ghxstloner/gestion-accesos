import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  Matches,
} from 'class-validator';
import { DocumentType } from '../../../../generated/prisma/index.js';

export class LoginDto {
  @ApiProperty({ enum: DocumentType, example: 'PASSPORT' })
  @IsEnum(DocumentType)
  documentType!: DocumentType;

  @ApiProperty({ example: '5849827' })
  @IsString()
  @MinLength(1)
  documentNumber!: string;

  @ApiProperty({ example: 'Demo1234!' })
  @IsString()
  @MinLength(1)
  password!: string;
}

export class RequestPasswordRecoveryDto {
  @ApiProperty({ enum: DocumentType, example: 'PASSPORT' })
  @IsEnum(DocumentType)
  documentType!: DocumentType;

  @ApiProperty({ example: '5849827' })
  @IsString()
  @MinLength(1)
  documentNumber!: string;
}

export class VerifyPasswordRecoveryCodeDto {
  @ApiProperty({ enum: DocumentType, example: 'PASSPORT' })
  @IsEnum(DocumentType)
  documentType!: DocumentType;

  @ApiProperty({ example: '5849827' })
  @IsString()
  documentNumber!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @MinLength(6)
  code!: string;
}

export class ResetPasswordWithTokenDto {
  @ApiProperty()
  @IsString()
  recoveryToken!: string;

  @ApiProperty({ example: 'NewPass123!' })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/, {
    message:
      'La contraseña debe tener al menos 8 caracteres, una mayúscula y un carácter especial',
  })
  newPassword!: string;

  @ApiProperty({ example: 'NewPass123!' })
  @IsString()
  newPasswordConfirmation!: string;
}

export class CreateUserDto {
  @ApiProperty({ enum: DocumentType, example: 'NATIONAL_ID' })
  @IsEnum(DocumentType)
  documentType!: DocumentType;

  @ApiProperty({ example: '8-123-456' })
  @IsString()
  documentNumber!: string;

  @ApiProperty()
  @IsString()
  firstName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  middleName?: string;

  @ApiProperty()
  @IsString()
  lastName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  secondLastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  position?: string;

  @ApiPropertyOptional({ type: [String], example: ['APPLICANT'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleCodes?: string[];

  @ApiPropertyOptional({
    description:
      'Optional initial password; a temporary one is generated if omitted',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  additionalPermissions?: string[];
}

export class UpdateUserRolesDto {
  @ApiProperty({ type: [String], example: ['APPLICANT'] })
  @IsArray()
  @IsString({ each: true })
  roleCodes!: string[];
}

export class UpdateUserPermissionsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  permissionCodes!: string[];
}

export class ResetPasswordDto {
  @ApiPropertyOptional({
    description:
      'Optional new password; a temporary one is generated if omitted',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/, {
    message:
      'La contraseña debe tener al menos 8 caracteres, una mayúscula y un carácter especial',
  })
  newPassword?: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  department?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  position?: string | null;
}

export class ChangeOwnPasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/, {
    message:
      'La contraseña debe tener al menos 8 caracteres, una mayúscula y un carácter especial',
  })
  newPassword!: string;
}

export class UserResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: DocumentType })
  documentType!: DocumentType;

  @ApiProperty()
  documentNumber!: string;

  @ApiProperty({ nullable: true })
  companyId!: string | null;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty({ nullable: true })
  email!: string | null;

  @ApiProperty({
    enum: ['ACTIVE', 'INACTIVE', 'BLOCKED', 'PENDING_ACTIVATION'],
  })
  status!: string;

  @ApiProperty({ type: [String] })
  roles!: string[];

  @ApiProperty({ type: [String] })
  permissions!: string[];

  @ApiPropertyOptional({ type: [String] })
  additionalPermissions?: string[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ nullable: true })
  photoUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  lastAccessAt?: Date | null;

  @ApiPropertyOptional()
  mustChangePassword?: boolean;

  @ApiPropertyOptional({
    description: 'Only returned when a temporary password was just generated',
  })
  temporaryPassword?: string;
}

export class AuthResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  user!: UserResponseDto;
}
