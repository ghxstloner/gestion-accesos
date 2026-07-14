import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CompanyService } from '../../application/company.service';
import { CompanyPresenter } from '../presenters/company.presenter';
import {
  CreateCompanyDto,
  UpdateCompanyDto,
  CompanyResponseDto,
} from '../dto/company.dto';
import { CurrentUser } from '../../../../common/presentation/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../../common/presentation/decorators/authenticated-user';
import { RequirePermissions } from '../../../../common/presentation/decorators/permissions.decorator';

@ApiTags('Companies')
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companyService: CompanyService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('companies.manage')
  @ApiOperation({ summary: 'Create a company' })
  async create(@Body() dto: CreateCompanyDto): Promise<CompanyResponseDto> {
    const company = await this.companyService.create(dto);
    return CompanyPresenter.toResponse(company);
  }

  @Get()
  @RequirePermissions('companies.read')
  @ApiOperation({ summary: 'List companies' })
  async findAll(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<{
    items: CompanyResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const result = await this.companyService.findAll({
      search,
      status,
      page,
      limit,
    });
    return {
      items: result.items.map(CompanyPresenter.toResponse),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  @Get(':id')
  @RequirePermissions('companies.read')
  @ApiOperation({ summary: 'Get a company by id' })
  async findById(@Param('id') id: string): Promise<CompanyResponseDto> {
    const company = await this.companyService.findById(id);
    return CompanyPresenter.toResponse(company);
  }

  @Patch(':id')
  @RequirePermissions('companies.manage')
  @ApiOperation({ summary: 'Update a company' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCompanyDto,
  ): Promise<CompanyResponseDto> {
    const company = await this.companyService.update(id, dto);
    return CompanyPresenter.toResponse(company);
  }

  @Post(':id/activate')
  @RequirePermissions('companies.manage')
  @ApiOperation({ summary: 'Activate a company' })
  async activate(@Param('id') id: string): Promise<CompanyResponseDto> {
    const company = await this.companyService.activate(id);
    return CompanyPresenter.toResponse(company);
  }

  @Post(':id/deactivate')
  @RequirePermissions('companies.manage')
  @ApiOperation({ summary: 'Deactivate a company' })
  async deactivate(@Param('id') id: string): Promise<CompanyResponseDto> {
    const company = await this.companyService.deactivate(id);
    return CompanyPresenter.toResponse(company);
  }

  @Post(':id/suspend')
  @RequirePermissions('companies.manage')
  @ApiOperation({ summary: 'Suspend a company' })
  async suspend(@Param('id') id: string): Promise<CompanyResponseDto> {
    const company = await this.companyService.suspend(id);
    return CompanyPresenter.toResponse(company);
  }
}
