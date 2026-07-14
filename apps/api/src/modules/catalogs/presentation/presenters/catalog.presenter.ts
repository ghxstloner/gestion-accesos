import { CatalogItem } from '../../domain/entities/catalog-item.entity';
import { CatalogItemResponseDto } from '../dto/catalog.dto';

export class CatalogPresenter {
  static toResponse(item: CatalogItem): CatalogItemResponseDto {
    const p = item.toProps();
    return {
      id: p.id,
      kind: p.kind,
      code: p.code,
      name: p.name,
      description: p.description,
      isActive: p.isActive,
      displayOrder: p.displayOrder,
      parentZoneCode: p.parentZoneCode,
      metadata: p.metadata,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }
}
