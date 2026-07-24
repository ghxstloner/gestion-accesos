import { Injectable } from '@nestjs/common';
import {
  Prisma,
  type CatalogKind as PrismaCatalogKind,
} from '@prisma/client';
import { PrismaService } from '../../../../../common/infrastructure/prisma/prisma.service';
import {
  CatalogItem,
  CatalogKindName,
} from '../../../domain/entities/catalog-item.entity';
import { CatalogRepositoryPort } from '../../../domain/repositories/catalog.repository.port';
import { BusinessRuleError } from '../../../../../common/domain/errors/domain-error';

type Row = Prisma.CatalogItemGetPayload<Record<string, never>>;

/**
 * Cast a domain `CatalogKindName` (string union) to the Prisma enum used by
 * the catalog_items row. The two unions align 1:1 so no runtime cast is
 * needed; the helper exists to keep the domain boundary explicit.
 */
function toPrismaKind(kind: CatalogKindName): PrismaCatalogKind {
  return kind;
}

@Injectable()
export class CatalogItemMapper {
  toDomain(row: Row): CatalogItem {
    return CatalogItem.reconstitute({
      id: row.id,
      kind: row.kind,
      code: row.code,
      name: row.name,
      description: row.description,
      isActive: row.isActive,
      displayOrder: row.displayOrder,
      parentZoneCode: row.parentZoneCode,
      metadata: row.metadata as Record<string, unknown> | null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  toPersistence(item: CatalogItem): Prisma.CatalogItemUncheckedCreateInput {
    const p = item.toProps();
    return {
      id: p.id,
      kind: toPrismaKind(p.kind),
      code: p.code,
      name: p.name,
      description: p.description,
      isActive: p.isActive,
      displayOrder: p.displayOrder,
      parentZoneCode: p.parentZoneCode,
      metadata:
        p.metadata === null
          ? Prisma.DbNull
          : (JSON.parse(JSON.stringify(p.metadata)) as Prisma.InputJsonValue),
    };
  }
}

@Injectable()
export class CatalogPrismaRepository implements CatalogRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<CatalogItem | null> {
    const row = await this.prisma.catalogItem.findUnique({ where: { id } });
    return row ? new CatalogItemMapper().toDomain(row) : null;
  }

  async findByCode(
    kind: CatalogKindName,
    code: string,
  ): Promise<CatalogItem | null> {
    const row = await this.prisma.catalogItem.findUnique({
      where: { kind_code: { kind: toPrismaKind(kind), code } },
    });
    return row ? new CatalogItemMapper().toDomain(row) : null;
  }

  async findActiveByKind(kind: CatalogKindName): Promise<CatalogItem[]> {
    const rows = await this.prisma.catalogItem.findMany({
      where: { kind: toPrismaKind(kind), isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map((r) => new CatalogItemMapper().toDomain(r));
  }

  async findAllByKind(kind: CatalogKindName): Promise<CatalogItem[]> {
    const rows = await this.prisma.catalogItem.findMany({
      where: { kind: toPrismaKind(kind) },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map((r) => new CatalogItemMapper().toDomain(r));
  }

  async findAll(): Promise<CatalogItem[]> {
    const rows = await this.prisma.catalogItem.findMany({
      orderBy: [{ kind: 'asc' }, { displayOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map((r) => new CatalogItemMapper().toDomain(r));
  }

  async findManyByIds(ids: string[]): Promise<CatalogItem[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.catalogItem.findMany({
      where: { id: { in: ids } },
    });
    return rows.map((r) => new CatalogItemMapper().toDomain(r));
  }

  async save(item: CatalogItem): Promise<CatalogItem> {
    const data = new CatalogItemMapper().toPersistence(item);
    const row = await this.prisma.catalogItem.upsert({
      where: { id: item.id },
      create: data,
      update: {
        name: data.name,
        description: data.description,
        isActive: data.isActive,
        displayOrder: data.displayOrder,
        metadata: data.metadata,
      },
    });
    return new CatalogItemMapper().toDomain(row);
  }

  async existsByCode(kind: CatalogKindName, code: string): Promise<boolean> {
    const count = await this.prisma.catalogItem.count({
      where: { kind: toPrismaKind(kind), code },
    });
    return count > 0;
  }
}

/**
 * Thrown when an aggregate relies on a catalog code/entry that doesn't exist or
 * is inactive. Distinct code from `BusinessRuleError` so we can map 422 cleanly.
 */
export class InactiveCatalogItemError extends BusinessRuleError {
  constructor(kind: string, code: string) {
    super(`Catalog item ${kind}/${code} is not active`);
    Object.setPrototypeOf(this, InactiveCatalogItemError.prototype);
  }
}
