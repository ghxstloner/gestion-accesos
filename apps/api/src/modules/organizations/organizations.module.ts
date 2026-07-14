import { Module } from '@nestjs/common';
import { CompaniesController } from './presentation/controllers/companies.controller';
import { CompanyService } from './application/company.service';
import { COMPANY_REPOSITORY } from './domain/repositories/company.repository.port';
import { CompanyPrismaRepository } from './infrastructure/persistence/repositories/company.repository.prisma';

@Module({
  controllers: [CompaniesController],
  providers: [
    CompanyService,
    { provide: COMPANY_REPOSITORY, useClass: CompanyPrismaRepository },
  ],
  exports: [CompanyService, COMPANY_REPOSITORY],
})
export class OrganizationsModule {}
