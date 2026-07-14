import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCatalogItemDto {
  @ApiProperty({
    example: 'CEDULA',
    description: 'Stable uppercase code (immutable after creation)',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  code!: string;

  @ApiProperty({ example: 'Cédula' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @ApiPropertyOptional({
    description: 'Required for ACCESS_AREA — the parent zone code',
  })
  @IsOptional()
  @IsString()
  parentZoneCode?: string;

  @ApiPropertyOptional({ description: 'Arbitrary JSON metadata' })
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class UpdateCatalogItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  displayOrder?: number;
}

export class CatalogItemResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() kind!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() displayOrder!: number;
  @ApiProperty({ type: String, nullable: true }) parentZoneCode!: string | null;
  @ApiProperty({ type: Object, nullable: true }) metadata!: Record<
    string,
    unknown
  > | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;
}

export class CatalogGroupDto {
  @ApiProperty() kind!: string;
  @ApiProperty({ type: [CatalogItemResponseDto] })
  items!: CatalogItemResponseDto[];
}

export class CatalogsResponseDto {
  @ApiProperty({ type: [CatalogGroupDto] }) groups!: CatalogGroupDto[];
}
