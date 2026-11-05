import { randomUUID } from 'crypto';

export type CompanyStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

/** Fields owned by an external registry (AITSA / Intelisis) sync. */
export interface CompanyExternalData {
  legalName: string;
  tradeName: string | null;
  taxIdentifier: string | null;
  dv: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  mainContactName: string | null;
  externalClientId: string;
  externalSource: string;
  /** Whether the external registry reports the company as active (`Alta`). */
  active: boolean;
}

export interface CompanyProps {
  id: string;
  legalName: string;
  tradeName: string | null;
  taxIdentifier: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  logoUrl: string | null;
  mainContactName: string | null;
  dv: string | null;
  externalClientId: string | null;
  externalSource: string | null;
  externalSyncedAt: Date | null;
  status: CompanyStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class Company {
  private readonly _id: string;
  private _legalName: string;
  private _tradeName: string | null;
  private _taxIdentifier: string | null;
  private _email: string | null;
  private _phone: string | null;
  private _address: string | null;
  private _logoUrl: string | null;
  private _mainContactName: string | null;
  private _dv: string | null;
  private _externalClientId: string | null;
  private _externalSource: string | null;
  private _externalSyncedAt: Date | null;
  private _status: CompanyStatus;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: CompanyProps) {
    this._id = props.id;
    this._legalName = props.legalName;
    this._tradeName = props.tradeName;
    this._taxIdentifier = props.taxIdentifier;
    this._email = props.email;
    this._phone = props.phone;
    this._address = props.address;
    this._logoUrl = props.logoUrl;
    this._mainContactName = props.mainContactName;
    this._dv = props.dv ?? null;
    this._externalClientId = props.externalClientId ?? null;
    this._externalSource = props.externalSource ?? null;
    this._externalSyncedAt = props.externalSyncedAt ?? null;
    this._status = props.status;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  static create(input: {
    legalName: string;
    tradeName?: string | null;
    taxIdentifier?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    logoUrl?: string | null;
    mainContactName?: string | null;
  }): Company {
    if (!input.legalName || input.legalName.trim().length === 0) {
      throw new Error('legalName is required');
    }
    return new Company({
      id: randomUUID(),
      legalName: input.legalName.trim(),
      tradeName: input.tradeName?.trim() || null,
      taxIdentifier: input.taxIdentifier?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      address: input.address?.trim() || null,
      logoUrl: input.logoUrl?.trim() || null,
      mainContactName: input.mainContactName?.trim() || null,
      dv: null,
      externalClientId: null,
      externalSource: null,
      externalSyncedAt: null,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /** Builds a new company from an external registry record. */
  static fromExternal(data: CompanyExternalData, now = new Date()): Company {
    const company = Company.create({
      legalName: data.legalName,
      tradeName: data.tradeName,
      taxIdentifier: data.taxIdentifier,
      email: data.email,
      phone: data.phone,
      address: data.address,
      mainContactName: data.mainContactName,
    });
    company.applyExternal(data, now);
    return company;
  }

  static reconstitute(props: CompanyProps): Company {
    return new Company(props);
  }

  get id(): string {
    return this._id;
  }
  get legalName(): string {
    return this._legalName;
  }
  get tradeName(): string | null {
    return this._tradeName;
  }
  get taxIdentifier(): string | null {
    return this._taxIdentifier;
  }
  get email(): string | null {
    return this._email;
  }
  get phone(): string | null {
    return this._phone;
  }
  get address(): string | null {
    return this._address;
  }
  get logoUrl(): string | null {
    return this._logoUrl;
  }
  get mainContactName(): string | null {
    return this._mainContactName;
  }
  get dv(): string | null {
    return this._dv;
  }
  get externalClientId(): string | null {
    return this._externalClientId;
  }
  get externalSource(): string | null {
    return this._externalSource;
  }
  get externalSyncedAt(): Date | null {
    return this._externalSyncedAt;
  }
  get status(): CompanyStatus {
    return this._status;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }

  update(
    input: Partial<
      Omit<
        CompanyProps,
        | 'id'
        | 'createdAt'
        | 'status'
        | 'dv'
        | 'externalClientId'
        | 'externalSource'
        | 'externalSyncedAt'
      >
    >,
  ): void {
    if (input.legalName !== undefined) {
      if (input.legalName.trim().length === 0)
        throw new Error('legalName cannot be empty');
      this._legalName = input.legalName.trim();
    }
    if (input.tradeName !== undefined)
      this._tradeName = input.tradeName?.trim() || null;
    if (input.taxIdentifier !== undefined)
      this._taxIdentifier = input.taxIdentifier?.trim() || null;
    if (input.email !== undefined) this._email = input.email?.trim() || null;
    if (input.phone !== undefined) this._phone = input.phone?.trim() || null;
    if (input.address !== undefined)
      this._address = input.address?.trim() || null;
    if (input.logoUrl !== undefined)
      this._logoUrl = input.logoUrl?.trim() || null;
    if (input.mainContactName !== undefined)
      this._mainContactName = input.mainContactName?.trim() || null;
    this._updatedAt = new Date();
  }

  /**
   * Overwrites the registry-owned fields with the external record. Local-only
   * fields (logoUrl) are preserved. Status rules:
   *  - external `Baja` -> INACTIVE (the registry is authoritative for
   *    deactivation);
   *  - external `Alta` -> ACTIVE, EXCEPT when the company was SUSPENDED
   *    locally: a suspension is an SGA security decision the registry does not
   *    know about, so it is kept until an operator lifts it.
   */
  applyExternal(data: CompanyExternalData, now = new Date()): void {
    if (!data.legalName || data.legalName.trim().length === 0) {
      throw new Error('legalName is required');
    }
    this._legalName = data.legalName.trim();
    this._tradeName = data.tradeName?.trim() || null;
    this._taxIdentifier = data.taxIdentifier?.trim() || null;
    this._dv = data.dv?.trim() || null;
    this._email = data.email?.trim() || null;
    this._phone = data.phone?.trim() || null;
    this._address = data.address?.trim() || null;
    this._mainContactName = data.mainContactName?.trim() || null;
    this._externalClientId = data.externalClientId.trim();
    this._externalSource = data.externalSource;
    this._externalSyncedAt = now;
    if (!data.active) this._status = 'INACTIVE';
    else if (this._status !== 'SUSPENDED') this._status = 'ACTIVE';
    this._updatedAt = now;
  }

  activate(): void {
    if (this._status === 'ACTIVE') return;
    this._status = 'ACTIVE';
    this._updatedAt = new Date();
  }

  deactivate(): void {
    if (this._status === 'INACTIVE') return;
    this._status = 'INACTIVE';
    this._updatedAt = new Date();
  }

  suspend(): void {
    if (this._status === 'SUSPENDED') return;
    this._status = 'SUSPENDED';
    this._updatedAt = new Date();
  }

  toProps(): CompanyProps {
    return {
      id: this._id,
      legalName: this._legalName,
      tradeName: this._tradeName,
      taxIdentifier: this._taxIdentifier,
      email: this._email,
      phone: this._phone,
      address: this._address,
      logoUrl: this._logoUrl,
      mainContactName: this._mainContactName,
      dv: this._dv,
      externalClientId: this._externalClientId,
      externalSource: this._externalSource,
      externalSyncedAt: this._externalSyncedAt,
      status: this._status,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }
}
