import { Module } from '@nestjs/common';
import { CompaniesController } from './presentation/controllers/companies.controller';
import { CompanyService } from './application/company.service';
import { CompanySyncService } from './application/company-sync.service';
import { CompanySyncScheduler } from './application/company-sync.scheduler';
import { EXTERNAL_COMPANY_REGISTRY } from './domain/external-company-registry.port';
import { AitsaCompaniesClient } from './infrastructure/aitsa/aitsa-companies.client';
import { COMPANY_REPOSITORY } from './domain/repositories/company.repository.port';
import { CompanyPrismaRepository } from './infrastructure/persistence/repositories/company.repository.prisma';

@Module({
  controllers: [CompaniesController],
  providers: [
    CompanyService,
    CompanySyncService,
    CompanySyncScheduler,
    { provide: COMPANY_REPOSITORY, useClass: CompanyPrismaRepository },
    { provide: EXTERNAL_COMPANY_REGISTRY, useClass: AitsaCompaniesClient },
  ],
  exports: [CompanyService, CompanySyncService, COMPANY_REPOSITORY],
})
export class OrganizationsModule {}
