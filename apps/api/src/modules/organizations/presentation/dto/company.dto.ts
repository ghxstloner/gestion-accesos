import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateCompanyDto {
  @ApiProperty({ example: 'Copa Airlines, S.A.' })
  @IsString()
  @MaxLength(255)
  legalName: string;

  @ApiPropertyOptional({ example: 'Copa Airlines' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  tradeName?: string;

  @ApiPropertyOptional({ example: 'CPA-155123-2-2010' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  taxIdentifier?: string;

  @ApiPropertyOptional({ example: 'accesos@copaair.com' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ example: '+507 304-2000' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  logoUrl?: string;

  @ApiPropertyOptional({ example: 'Andrés Pino' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  mainContactName?: string;
}

export class UpdateCompanyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  legalName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  tradeName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  taxIdentifier?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  mainContactName?: string;
}

export class CompanyResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  legalName: string;

  @ApiProperty({ nullable: true })
  tradeName: string | null;

  @ApiProperty({ nullable: true })
  taxIdentifier: string | null;

  @ApiProperty({ nullable: true })
  email: string | null;

  @ApiProperty({ nullable: true })
  phone: string | null;

  @ApiProperty({ nullable: true })
  address: string | null;

  @ApiProperty({ nullable: true })
  logoUrl: string | null;

  @ApiProperty({ nullable: true })
  mainContactName: string | null;

  @ApiProperty({ nullable: true, description: 'Dígito verificador del RUC' })
  dv: string | null;

  @ApiProperty({
    nullable: true,
    description: 'Identificador del cliente en Intelisis (AITSA cliente_Id)',
  })
  externalClientId: string | null;

  @ApiProperty({ nullable: true, example: 'AITSA' })
  externalSource: string | null;

  @ApiProperty({ nullable: true })
  externalSyncedAt: Date | null;

  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'] })
  status: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class ExternalCompanySearchQueryDto {
  @ApiPropertyOptional({ example: '28726-117-524' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  ruc?: string;

  @ApiPropertyOptional({ example: 'AMERICAN AIRLINES' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nombre?: string;

  @ApiPropertyOptional({ example: 'C000010' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  clienteId?: string;
}

export class ImportExternalCompanyDto {
  @ApiProperty({ example: 'C000010', description: 'AITSA cliente_Id' })
  @IsString()
  @MaxLength(40)
  clienteId: string;
}

export class SyncExternalCompaniesDto {
  @ApiPropertyOptional({
    example: '2026-01-01',
    description:
      'Fecha de modificación desde (YYYY-MM-DD). Si se omite se usa la última sincronización; sin sincronizaciones previas se trae el padrón completo.',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fechaDesde must be YYYY-MM-DD' })
  fechaDesde?: string;
}

export class ExternalCompanyResponseDto {
  @ApiProperty() clienteId: string;
  @ApiProperty() nombre: string;
  @ApiProperty({ nullable: true }) nombreComercial: string | null;
  @ApiProperty({ nullable: true }) ruc: string | null;
  @ApiProperty({ nullable: true }) dv: string | null;
  @ApiProperty({ nullable: true }) correo: string | null;
  @ApiProperty({ nullable: true }) telefono: string | null;
  @ApiProperty({ nullable: true }) direccion: string | null;
  @ApiProperty({ nullable: true }) contacto: string | null;
  @ApiProperty({ nullable: true, example: 'Alta' }) estado: string | null;
  @ApiProperty({
    nullable: true,
    description: 'Empresa local ya vinculada (por cliente_Id o RUC)',
  })
  importedCompanyId: string | null;
}

export class CompanySyncSummaryDto {
  @ApiProperty({ example: 'AITSA' }) source: string;
  @ApiProperty({ nullable: true }) fechaDesde: string | null;
  @ApiProperty() fetched: number;
  @ApiProperty() created: number;
  @ApiProperty() updated: number;
  @ApiProperty() skipped: number;
  @ApiProperty() errors: Array<{ clienteId: string; message: string }>;
  @ApiProperty() startedAt: Date;
  @ApiProperty() finishedAt: Date;
}
