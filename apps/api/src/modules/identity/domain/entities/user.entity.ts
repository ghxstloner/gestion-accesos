import { randomUUID } from 'crypto';

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED';

export interface UserProps {
  id: string;
  companyId: string | null;
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  passwordChangedAt: Date;
  mustChangePassword: boolean;
  photoUrl: string | null;
  status: UserStatus;
  lastAccessAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class User {
  private readonly _id: string;
  private _companyId: string | null;
  private _firstName: string;
  private _lastName: string;
  private _email: string;
  private _passwordHash: string;
  private _passwordChangedAt: Date;
  private _mustChangePassword: boolean;
  private _photoUrl: string | null;
  private _status: UserStatus;
  private _lastAccessAt: Date | null;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: UserProps) {
    this._id = props.id;
    this._companyId = props.companyId;
    this._firstName = props.firstName;
    this._lastName = props.lastName;
    this._email = props.email;
    this._passwordHash = props.passwordHash;
    this._passwordChangedAt = props.passwordChangedAt;
    this._mustChangePassword = props.mustChangePassword;
    this._photoUrl = props.photoUrl;
    this._status = props.status;
    this._lastAccessAt = props.lastAccessAt;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  static create(input: {
    companyId?: string | null;
    firstName: string;
    lastName: string;
    email: string;
    passwordHash: string;
    mustChangePassword?: boolean;
    photoUrl?: string | null;
  }): User {
    if (!input.firstName.trim()) throw new Error('firstName is required');
    if (!input.lastName.trim()) throw new Error('lastName is required');
    return new User({
      id: randomUUID(),
      companyId: input.companyId ?? null,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: User.normalizeEmail(input.email),
      passwordHash: input.passwordHash,
      passwordChangedAt: new Date(),
      mustChangePassword: input.mustChangePassword ?? false,
      photoUrl: input.photoUrl ?? null,
      status: 'ACTIVE',
      lastAccessAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static reconstitute(props: UserProps): User {
    return new User(props);
  }

  static normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  get id(): string {
    return this._id;
  }
  get companyId(): string | null {
    return this._companyId;
  }
  get firstName(): string {
    return this._firstName;
  }
  get lastName(): string {
    return this._lastName;
  }
  get email(): string {
    return this._email;
  }
  get passwordHash(): string {
    return this._passwordHash;
  }
  get passwordChangedAt(): Date {
    return this._passwordChangedAt;
  }
  get passwordExpiresAt(): Date {
    const expiration = new Date(this._passwordChangedAt);
    expiration.setMonth(expiration.getMonth() + 6);
    return expiration;
  }
  get passwordExpired(): boolean {
    return this.passwordExpiresAt <= new Date();
  }
  get mustChangePassword(): boolean {
    return this._mustChangePassword;
  }
  get photoUrl(): string | null {
    return this._photoUrl;
  }
  get status(): UserStatus {
    return this._status;
  }
  get lastAccessAt(): Date | null {
    return this._lastAccessAt;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }
  get fullName(): string {
    return `${this._firstName} ${this._lastName}`;
  }

  get canAuthenticate(): boolean {
    return this._status === 'ACTIVE';
  }

  update(input: {
    firstName?: string;
    lastName?: string;
    email?: string;
    companyId?: string | null;
  }): void {
    if (input.firstName !== undefined) {
      if (!input.firstName.trim()) throw new Error('firstName cannot be empty');
      this._firstName = input.firstName.trim();
    }
    if (input.lastName !== undefined) {
      if (!input.lastName.trim()) throw new Error('lastName cannot be empty');
      this._lastName = input.lastName.trim();
    }
    if (input.email !== undefined)
      this._email = User.normalizeEmail(input.email);
    if (input.companyId !== undefined) this._companyId = input.companyId;
    this._updatedAt = new Date();
  }

  setPasswordHash(hash: string, mustChangePassword = false): void {
    this._passwordHash = hash;
    this._passwordChangedAt = new Date();
    this._mustChangePassword = mustChangePassword;
    this._updatedAt = new Date();
  }

  setPhotoUrl(photoUrl: string): void {
    this._photoUrl = photoUrl;
    this._updatedAt = new Date();
  }

  activate(): void {
    this._status = 'ACTIVE';
    this._updatedAt = new Date();
  }
  block(): void {
    this._status = 'BLOCKED';
    this._updatedAt = new Date();
  }
  deactivate(): void {
    this._status = 'INACTIVE';
    this._updatedAt = new Date();
  }

  recordAccess(): void {
    this._lastAccessAt = new Date();
    this._updatedAt = new Date();
  }

  toProps(): UserProps {
    return {
      id: this._id,
      companyId: this._companyId,
      firstName: this._firstName,
      lastName: this._lastName,
      email: this._email,
      passwordHash: this._passwordHash,
      passwordChangedAt: this._passwordChangedAt,
      mustChangePassword: this._mustChangePassword,
      photoUrl: this._photoUrl,
      status: this._status,
      lastAccessAt: this._lastAccessAt,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }
}
