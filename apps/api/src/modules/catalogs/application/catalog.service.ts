import { Injectable, Inject } from '@nestjs/common';
import {
  CatalogRepositoryPort,
  CATALOG_REPOSITORY,
} from '../domain/repositories/catalog.repository.port';
import {
  CatalogItem,
  CatalogKindName,
} from '../domain/entities/catalog-item.entity';
import {
  CATALOG_CODES_BY_KIND,
  CATALOG_SEEDS,
  CatalogKindCode,
} from '../domain/catalog-seeds';
import {
  BusinessRuleError,
  ConflictError,
  NotFoundError,
} from '../../../common/domain/errors/domain-error';
import {
  CatalogItemResponseDto,
  CatalogGroupDto,
  CatalogsResponseDto,
  CreateCatalogItemDto,
  UpdateCatalogItemDto,
} from '../presentation/dto/catalog.dto';
import { CatalogPresenter } from '../presentation/presenters/catalog.presenter';

const VALID_KINDS = new Set<CatalogKindCode>([
  'REQUEST_TYPE',
  'IDENTIFICATION_TYPE',
  'DOCUMENT_TYPE',
  'ACCESS_POINT',
  'SECURITY_ZONE',
  'ACCESS_AREA',
  'REJECTION_REASON',
  'GENDER',
  'MARITAL_STATUS',
  'BLOOD_TYPE',
  'NATIONALITY',
]);

function asKind(name: string): CatalogKindName {
  if (!VALID_KINDS.has(name as CatalogKindCode)) {
    throw new NotFoundError('Catalog kind', name);
  }
  return name as CatalogKindName;
}

@Injectable()
export class CatalogService {
  constructor(
    @Inject(CATALOG_REPOSITORY) private readonly repo: CatalogRepositoryPort,
  ) {}

  async findAllGrouped(): Promise<CatalogsResponseDto> {
    await this.ensureSeeded();
    const groups = [...VALID_KINDS];
    const result: CatalogGroupDto[] = [];
    for (const kind of groups) {
      const items = await this.repo.findAllByKind(kind);
      result.push({
        kind,
        items: items.map((i) => CatalogPresenter.toResponse(i)),
      });
    }
    return { groups: result };
  }

  async findByKind(
    kindName: string,
    onlyActive = false,
  ): Promise<CatalogItemResponseDto[]> {
    const kind = asKind(kindName);
    await this.ensureSeeded(kind);
    const items = onlyActive
      ? await this.repo.findActiveByKind(kind)
      : await this.repo.findAllByKind(kind);
    return items.map((i) => CatalogPresenter.toResponse(i));
  }

  /** Makes essential reference values available even on a fresh database. */
  private async ensureSeeded(onlyKind?: CatalogKindCode): Promise<void> {
    const groups = CATALOG_SEEDS.filter(
      (group) => !onlyKind || group.kind === onlyKind,
    );
    for (const group of groups) {
      for (const [displayOrder, entry] of group.entries.entries()) {
        if (await this.repo.existsByCode(group.kind, entry.code)) continue;
        await this.repo.save(
          CatalogItem.create({
            kind: group.kind,
            code: entry.code,
            name: entry.name,
            description: entry.description ?? null,
            displayOrder,
            parentZoneCode: entry.parentZoneCode,
            metadata: entry.metadata,
          }),
        );
      }
    }
  }

  async findById(id: string): Promise<CatalogItemResponseDto> {
    const item = await this.repo.findById(id);
    if (!item) throw new NotFoundError('CatalogItem', id);
    return CatalogPresenter.toResponse(item);
  }

  async create(
    kindName: string,
    dto: CreateCatalogItemDto,
  ): Promise<CatalogItemResponseDto> {
    const kind = asKind(kindName);
    const exists = await this.repo.existsByCode(kind, dto.code.toUpperCase());
    if (exists)
      throw new ConflictError(
        `Catalog item ${dto.code} already exists in ${kind}`,
      );

    const item = CatalogItem.create({
      kind,
      code: dto.code,
      name: dto.name,
      description: dto.description ?? null,
      displayOrder: dto.displayOrder,
      parentZoneCode: dto.parentZoneCode,
      metadata: dto.metadata,
    });
    const saved = await this.repo.save(item);
    return CatalogPresenter.toResponse(saved);
  }

  async update(
    id: string,
    dto: UpdateCatalogItemDto,
  ): Promise<CatalogItemResponseDto> {
    const item = await this.repo.findById(id);
    if (!item) throw new NotFoundError('CatalogItem', id);
    item.update({
      name: dto.name,
      description: dto.description,
      displayOrder: dto.displayOrder,
    });
    const saved = await this.repo.save(item);
    return CatalogPresenter.toResponse(saved);
  }

  async activate(id: string): Promise<CatalogItemResponseDto> {
    const item = await this.repo.findById(id);
    if (!item) throw new NotFoundError('CatalogItem', id);
    item.activate();
    const saved = await this.repo.save(item);
    return CatalogPresenter.toResponse(saved);
  }

  async deactivate(id: string): Promise<CatalogItemResponseDto> {
    const item = await this.repo.findById(id);
    if (!item) throw new NotFoundError('CatalogItem', id);
    if (item.isEssential(CATALOG_CODES_BY_KIND[item.kind])) {
      throw new BusinessRuleError(
        'Essential catalog codes cannot be deactivated. They are referenced by historical snapshots.',
      );
    }
    item.deactivate();
    const saved = await this.repo.save(item);
    return CatalogPresenter.toResponse(saved);
  }
}
