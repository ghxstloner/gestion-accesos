import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../../../common/presentation/decorators/permissions.decorator';
import { CatalogService } from '../../application/catalog.service';
import {
  CatalogItemResponseDto,
  CatalogsResponseDto,
  CreateCatalogItemDto,
  UpdateCatalogItemDto,
} from '../dto/catalog.dto';

@ApiTags('catalogs')
@Controller('catalogs')
export class CatalogsController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  @ApiOperation({ summary: 'List all catalog groups (one entry per kind)' })
  @ApiResponse({ status: 200, type: CatalogsResponseDto })
  async list(): Promise<CatalogsResponseDto> {
    return this.catalogService.findAllGrouped();
  }

  @Get(':catalog')
  @ApiOperation({ summary: 'List entries of a single catalog kind' })
  @ApiQuery({
    name: 'active',
    required: false,
    type: Boolean,
    description: 'Only active entries',
  })
  async listByKind(
    @Param('catalog') catalog: string,
    @Query('active') active?: string,
  ): Promise<CatalogItemResponseDto[]> {
    return this.catalogService.findByKind(catalog, active === 'true');
  }

  @Post(':catalog')
  @RequirePermissions('catalogs.manage')
  async create(
    @Param('catalog') catalog: string,
    @Body() dto: CreateCatalogItemDto,
  ): Promise<CatalogItemResponseDto> {
    return this.catalogService.create(catalog, dto);
  }

  @Patch(':catalog/:id')
  @RequirePermissions('catalogs.manage')
  async update(
    @Param('catalog') _catalog: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCatalogItemDto,
  ): Promise<CatalogItemResponseDto> {
    return this.catalogService.update(id, dto);
  }

  @Post(':catalog/:id/activate')
  @RequirePermissions('catalogs.manage')
  @HttpCode(204)
  async activate(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.catalogService.activate(id);
  }

  @Post(':catalog/:id/deactivate')
  @RequirePermissions('catalogs.manage')
  @HttpCode(204)
  async deactivate(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.catalogService.deactivate(id);
  }
}
