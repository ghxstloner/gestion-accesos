import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  IsUUID,
} from 'class-validator';

const NAME_OPTS = {
  type: String,
  maxLength: 100,
} as const;

export class CreatePersonDto {
  @ApiPropertyOptional({
    description:
      'Required for system administrators; ignored for company-scoped users',
  })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiProperty() @IsString() @MinLength(1) @MaxLength(100) firstName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  middleName?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstSurname!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  secondSurname?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  marriedSurname?: string;

  @ApiProperty({
    description:
      'CatalogItem id of identification type (kind=IDENTIFICATION_TYPE)',
  })
  @IsString()
  identificationTypeId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  identificationNumber!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  socialSecurityNumber?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  gender?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  maritalStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  nationality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5)
  bloodType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  mobile?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() residentialAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  physicalCondition?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  position?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  yearsOfService?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  previouslyWorkedAtAirport?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  previousCompanyName?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  previouslyHadCredential?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  reusePreviousPhoto?: boolean;
}

export class UpdatePersonDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) middleName?:
    string | null;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstSurname?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  secondSurname?: string | null;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  marriedSurname?: string | null;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  identificationTypeId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  identificationNumber?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  socialSecurityNumber?: string | null;
  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  birthDate?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) gender?:
    string | null;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  maritalStatus?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) nationality?:
    string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5) bloodType?:
    string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) phone?:
    string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) mobile?:
    string | null;
  @ApiPropertyOptional() @IsOptional() @IsEmail() @MaxLength(255) email?:
    string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() residentialAddress?:
    string | null;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  physicalCondition?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) department?:
    string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) position?:
    string | null;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  yearsOfService?: number | null;
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  previouslyWorkedAtAirport?: boolean;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  previousCompanyName?: string | null;
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  previouslyHadCredential?: boolean;
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  reusePreviousPhoto?: boolean;
}

export class PersonResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() companyId!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty({ nullable: true }) middleName!: string | null;
  @ApiProperty() firstSurname!: string;
  @ApiProperty({ nullable: true }) secondSurname!: string | null;
  @ApiProperty({ nullable: true }) marriedSurname!: string | null;
  @ApiProperty() identificationTypeId!: string;
  @ApiProperty({
    description: 'Code of the identification type (e.g. CEDULA, PASAPORTE)',
  })
  identificationTypeCode?: string;
  @ApiProperty() identificationNumber!: string;
  @ApiProperty({ nullable: true }) socialSecurityNumber!: string | null;
  @ApiProperty({ format: 'date-time', nullable: true }) birthDate!:
    string | null;
  @ApiProperty({ nullable: true }) gender!: string | null;
  @ApiProperty({ nullable: true }) maritalStatus!: string | null;
  @ApiProperty({ nullable: true }) nationality!: string | null;
  @ApiProperty({ nullable: true }) bloodType!: string | null;
  @ApiProperty({ nullable: true }) phone!: string | null;
  @ApiProperty({ nullable: true }) mobile!: string | null;
  @ApiProperty({ nullable: true }) email!: string | null;
  @ApiProperty({ nullable: true }) residentialAddress!: string | null;
  @ApiProperty({ nullable: true }) physicalCondition!: string | null;
  @ApiProperty({ nullable: true }) department!: string | null;
  @ApiProperty({ nullable: true }) position!: string | null;
  @ApiProperty({ nullable: true }) yearsOfService!: number | null;
  @ApiProperty() previouslyWorkedAtAirport!: boolean;
  @ApiProperty({ nullable: true }) previousCompanyName!: string | null;
  @ApiProperty() previouslyHadCredential!: boolean;
  @ApiProperty() reusePreviousPhoto!: boolean;
  @ApiProperty() status!: 'ACTIVE' | 'INACTIVE';
  @ApiProperty({ nullable: true }) createdBy!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;
  @ApiProperty({
    description: 'Computed age from birthDate (years)',
    nullable: true,
  })
  age!: number | null;
  @ApiProperty() fullName!: string;
}
