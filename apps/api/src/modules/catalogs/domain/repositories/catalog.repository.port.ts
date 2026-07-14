import { CatalogItem, CatalogKindName } from '../entities/catalog-item.entity';

export interface CatalogItemWithRelations {
  item: CatalogItem;
}

export const CATALOG_REPOSITORY = Symbol('CATALOG_REPOSITORY');

export interface CatalogRepositoryPort {
  findById(id: string): Promise<CatalogItem | null>;
  findByCode(kind: CatalogKindName, code: string): Promise<CatalogItem | null>;
  findActiveByKind(kind: CatalogKindName): Promise<CatalogItem[]>;
  findAllByKind(kind: CatalogKindName): Promise<CatalogItem[]>;
  findAll(): Promise<CatalogItem[]>;
  findManyByIds(ids: string[]): Promise<CatalogItem[]>;
  save(item: CatalogItem): Promise<CatalogItem>;
  existsByCode(kind: CatalogKindName, code: string): Promise<boolean>;
}
