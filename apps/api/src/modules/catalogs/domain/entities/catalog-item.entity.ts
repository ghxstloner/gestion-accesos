import { randomUUID } from 'crypto';
import {
  BusinessRuleError,
  ValidationError,
} from '../../../../common/domain/errors/domain-error';

export type CatalogKindName =
  | 'REQUEST_TYPE'
  | 'IDENTIFICATION_TYPE'
  | 'DOCUMENT_TYPE'
  | 'ACCESS_POINT'
  | 'SECURITY_ZONE'
  | 'ACCESS_AREA'
  | 'REJECTION_REASON';

export interface CatalogItemProps {
  id: string;
  kind: CatalogKindName;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  displayOrder: number;
  parentZoneCode: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * CatalogItem is a value-rich entity (its `code` is the stable business identity,
 * while `id` is the technical PK). Deactivating is allowed; deletion of essential
 * flow codes is forbidden by the domain rule (enforced in the service layer via
 * CATALOG_CODES_BY_KIND).
 */
export class CatalogItem {
  private readonly _id: string;
  private readonly _kind: CatalogKindName;
  private readonly _code: string;
  private _name: string;
  private _description: string | null;
  private _isActive: boolean;
  private _displayOrder: number;
  private _parentZoneCode: string | null;
  private _metadata: Record<string, unknown> | null;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: CatalogItemProps) {
    this._id = props.id;
    this._kind = props.kind;
    this._code = props.code;
    this._name = props.name;
    this._description = props.description;
    this._isActive = props.isActive;
    this._displayOrder = props.displayOrder;
    this._parentZoneCode = props.parentZoneCode;
    this._metadata = props.metadata;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  static create(input: {
    kind: CatalogKindName;
    code: string;
    name: string;
    description?: string | null;
    displayOrder?: number;
    parentZoneCode?: string | null;
    metadata?: Record<string, unknown> | null;
  }): CatalogItem {
    const code = input.code.trim().toUpperCase();
    if (!code) throw new ValidationError('code is required');
    if (!/^[A-Z0-9_-]{1,80}$/.test(code)) {
      throw new ValidationError(
        'code must be uppercase letters, digits, _ or -',
      );
    }
    if (!input.name.trim()) throw new ValidationError('name is required');
    if (input.kind === 'ACCESS_AREA' && !input.parentZoneCode) {
      throw new ValidationError('ACCESS_AREA requires parentZoneCode');
    }
    if (input.kind !== 'ACCESS_AREA' && input.parentZoneCode) {
      throw new ValidationError('parentZoneCode is only valid for ACCESS_AREA');
    }
    return new CatalogItem({
      id: randomUUID(),
      kind: input.kind,
      code,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      isActive: true,
      displayOrder: input.displayOrder ?? 0,
      parentZoneCode: input.parentZoneCode?.toUpperCase() || null,
      metadata: input.metadata ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static reconstitute(props: CatalogItemProps): CatalogItem {
    return new CatalogItem(props);
  }

  get id(): string {
    return this._id;
  }
  get kind(): CatalogKindName {
    return this._kind;
  }
  get code(): string {
    return this._code;
  }
  get name(): string {
    return this._name;
  }
  get description(): string | null {
    return this._description;
  }
  get isActive(): boolean {
    return this._isActive;
  }
  get displayOrder(): number {
    return this._displayOrder;
  }
  get parentZoneCode(): string | null {
    return this._parentZoneCode;
  }
  get metadata(): Record<string, unknown> | null {
    return this._metadata;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }

  isEssential(codesByKind: readonly string[]): boolean {
    return codesByKind.includes(this._code);
  }

  update(input: {
    name?: string;
    description?: string | null;
    displayOrder?: number;
  }): void {
    if (input.name !== undefined) {
      if (!input.name.trim()) throw new ValidationError('name cannot be empty');
      this._name = input.name.trim();
    }
    if (input.description !== undefined) {
      this._description = input.description?.trim() || null;
    }
    if (input.displayOrder !== undefined) {
      this._displayOrder = input.displayOrder;
    }
    this._updatedAt = new Date();
  }

  activate(): void {
    if (this._isActive)
      throw new BusinessRuleError('Catalog item is already active');
    this._isActive = true;
    this._updatedAt = new Date();
  }

  deactivate(): void {
    if (!this._isActive)
      throw new BusinessRuleError('Catalog item is already inactive');
    this._isActive = false;
    this._updatedAt = new Date();
  }

  /** Code, kind and parentZoneCode are immutable once persisted — they are
   * referenced by historical snapshots. */
  toProps(): CatalogItemProps {
    return {
      id: this._id,
      kind: this._kind,
      code: this._code,
      name: this._name,
      description: this._description,
      isActive: this._isActive,
      displayOrder: this._displayOrder,
      parentZoneCode: this._parentZoneCode,
      metadata: this._metadata,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }
}
