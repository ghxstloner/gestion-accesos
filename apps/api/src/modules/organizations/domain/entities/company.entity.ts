import { randomUUID } from 'crypto';

export type CompanyStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

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
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
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
    input: Partial<Omit<CompanyProps, 'id' | 'createdAt' | 'status'>>,
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
      status: this._status,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }
}
