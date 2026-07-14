import { Module } from '@nestjs/common';
import { CatalogsController } from './presentation/controllers/catalogs.controller';
import { CatalogService } from './application/catalog.service';
import { CATALOG_REPOSITORY } from './domain/repositories/catalog.repository.port';
import { CatalogPrismaRepository } from './infrastructure/persistence/repositories/catalog-item.repository.prisma';

@Module({
  controllers: [CatalogsController],
  providers: [
    CatalogService,
    { provide: CATALOG_REPOSITORY, useClass: CatalogPrismaRepository },
  ],
  exports: [CatalogService, CATALOG_REPOSITORY],
})
export class CatalogsModule {}
