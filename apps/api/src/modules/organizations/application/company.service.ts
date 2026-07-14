import { Injectable, Inject } from '@nestjs/common';
import {
  CompanyRepositoryPort,
  COMPANY_REPOSITORY,
} from '../domain/repositories/company.repository.port';
import { Company } from '../domain/entities/company.entity';
import {
  ConflictError,
  NotFoundError,
} from '../../../common/domain/errors/domain-error';
import {
  CreateCompanyDto,
  UpdateCompanyDto,
} from '../presentation/dto/company.dto';

@Injectable()
export class CompanyService {
  constructor(
    @Inject(COMPANY_REPOSITORY)
    private readonly companyRepo: CompanyRepositoryPort,
  ) {}

  async create(dto: CreateCompanyDto): Promise<Company> {
    if (dto.taxIdentifier) {
      const existing = await this.companyRepo.findByTaxIdentifier(
        dto.taxIdentifier,
      );
      if (existing)
        throw new ConflictError(
          'A company with this tax identifier already exists',
        );
    }
    const company = Company.create(dto);
    return this.companyRepo.save(company);
  }

  async findById(id: string): Promise<Company> {
    const company = await this.companyRepo.findById(id);
    if (!company) throw new NotFoundError('Company', id);
    return company;
  }

  async findAll(params: {
    search?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    items: Company[];
    total: number;
    page: number;
    limit: number;
  }> {
    const limit = Math.min(params.limit ?? 50, 200);
    const offset = ((params.page ?? 1) - 1) * limit;
    const result = await this.companyRepo.findAll({
      search: params.search,
      status: params.status,
      offset,
      limit,
    });
    return { ...result, page: params.page ?? 1, limit };
  }

  async update(id: string, dto: UpdateCompanyDto): Promise<Company> {
    const company = await this.findById(id);
    if (dto.taxIdentifier && dto.taxIdentifier !== company.taxIdentifier) {
      const existing = await this.companyRepo.findByTaxIdentifier(
        dto.taxIdentifier,
      );
      if (existing && existing.id !== id) {
        throw new ConflictError(
          'A company with this tax identifier already exists',
        );
      }
    }
    company.update(dto);
    return this.companyRepo.save(company);
  }

  async activate(id: string): Promise<Company> {
    const company = await this.findById(id);
    company.activate();
    return this.companyRepo.save(company);
  }

  async deactivate(id: string): Promise<Company> {
    const company = await this.findById(id);
    company.deactivate();
    return this.companyRepo.save(company);
  }

  async suspend(id: string): Promise<Company> {
    const company = await this.findById(id);
    company.suspend();
    return this.companyRepo.save(company);
  }
}
