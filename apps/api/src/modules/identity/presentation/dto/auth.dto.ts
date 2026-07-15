import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  Matches,
} from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'r.mendez@aac.aero' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(1)
  password: string;
}

export class CreateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional({
    description: 'If omitted, a secure temporary password is generated',
  })
  @IsOptional()
  @IsString()
  firstName: string;

  @ApiProperty()
  @IsString()
  lastName: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/, {
    message:
      'La contraseña debe tener al menos 8 caracteres, una mayúscula y un carácter especial',
  })
  password?: string;

  @ApiPropertyOptional({ type: [String], example: ['APPLICANT'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleCodes?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  additionalPermissions?: string[];
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
}

export class UpdateUserRolesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  roleCodes: string[];
}

export class UpdateUserPermissionsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  permissionCodes: string[];
}

export class ResetPasswordDto {
  @ApiPropertyOptional({
    description: 'If omitted, a secure temporary password is generated',
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

export class ChangeOwnPasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/, {
    message:
      'La contraseña debe tener al menos 8 caracteres, una mayúscula y un carácter especial',
  })
  newPassword: string;
}

export class UserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ nullable: true })
  companyId: string | null;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE', 'BLOCKED'] })
  status: string;

  @ApiProperty({ type: [String] })
  roles: string[];

  @ApiProperty({ type: [String] })
  permissions: string[];

  @ApiProperty({ type: [String] })
  additionalPermissions: string[];

  @ApiProperty({ nullable: true })
  lastAccessAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ nullable: true })
  photoUrl: string | null;

  @ApiProperty()
  mustChangePassword: boolean;

  @ApiPropertyOptional({
    description:
      'Returned only immediately after generating a temporary password',
  })
  temporaryPassword?: string;
}

export class SessionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ nullable: true })
  userAgent: string | null;

  @ApiProperty({ nullable: true })
  ipAddress: string | null;

  @ApiProperty()
  expiresAt: Date;

  @ApiProperty()
  createdAt: Date;
}

export class AuthResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  user: UserResponseDto;
}
