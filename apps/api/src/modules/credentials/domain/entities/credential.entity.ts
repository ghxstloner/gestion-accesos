import { ConflictError } from '../../../../common/domain/errors/domain-error';
import {
  formatCredentialNumber,
  type CredentialStatus,
  type CredentialType,
} from '../credential.constants';

export interface CredentialProps {
  id: string;
  credentialNumber: string;
  requestId: string;
  credentialType: CredentialType;
  personId: string | null;
  status: CredentialStatus;
  issuedAt: Date | null;
  expiresAt: Date | null;
  producedAt: Date | null;
  readyAt: Date | null;
  deliveredAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Credential {
  private constructor(private readonly props: CredentialProps) {}

  static create(input: {
    id?: string;
    requestId: string;
    credentialType: CredentialType;
    personId: string | null;
    createdBy: string;
    sequence: number;
    year?: number;
    expiresAt?: Date | null;
  }): Credential {
    const year = input.year ?? new Date().getFullYear();
    return new Credential({
      id: input.id ?? cryptoRandomId(),
      credentialNumber: formatCredentialNumber(input.credentialType, year, input.sequence),
      requestId: input.requestId,
      credentialType: input.credentialType,
      personId: input.personId,
      status: 'PENDING_PRODUCTION',
      issuedAt: new Date(),
      expiresAt: input.expiresAt ?? null,
      producedAt: null,
      readyAt: null,
      deliveredAt: null,
      createdBy: input.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static reconstitute(props: CredentialProps): Credential {
    return new Credential(props);
  }

  get id() { return this.props.id; }
  get credentialNumber() { return this.props.credentialNumber; }
  get requestId() { return this.props.requestId; }
  get credentialType() { return this.props.credentialType; }
  get personId() { return this.props.personId; }
  get status() { return this.props.status; }
  get issuedAt() { return this.props.issuedAt; }
  get expiresAt() { return this.props.expiresAt; }
  get producedAt() { return this.props.producedAt; }
  get readyAt() { return this.props.readyAt; }
  get deliveredAt() { return this.props.deliveredAt; }
  get createdBy() { return this.props.createdBy; }
  get createdAt() { return this.props.createdAt; }
  get updatedAt() { return this.props.updatedAt; }

  toProps(): CredentialProps {
    return { ...this.props };
  }

  isTerminal(): boolean {
    return (
      this.props.status === 'DELIVERED' ||
      this.props.status === 'CANCELLED' ||
      this.props.status === 'REVOKED' ||
      this.props.status === 'EXPIRED'
    );
  }

  startProduction(): void {
    if (this.props.status !== 'PENDING_PRODUCTION') {
      throw new ConflictError(`Credential ${this.id} cannot start production from ${this.props.status}`);
    }
    this.props.status = 'IN_PRODUCTION';
    this.props.producedAt = new Date();
    this.bump();
  }

  markReady(): void {
    if (this.props.status !== 'IN_PRODUCTION') {
      throw new ConflictError(`Credential ${this.id} cannot be marked ready from ${this.props.status}`);
    }
    this.props.status = 'READY_FOR_DELIVERY';
    this.props.readyAt = new Date();
    this.bump();
  }

  returnToProduction(): void {
    if (this.props.status !== 'READY_FOR_DELIVERY') {
      throw new ConflictError(`Credential ${this.id} cannot return to production from ${this.props.status}`);
    }
    this.props.status = 'IN_PRODUCTION';
    this.props.readyAt = null;
    this.bump();
  }

  suspend(): void {
    if (this.isTerminal()) {
      throw new ConflictError(`Credential ${this.id} is terminal and cannot be suspended`);
    }
    this.props.status = 'SUSPENDED';
    this.bump();
  }

  revoke(): void {
    if (this.props.status === 'REVOKED' || this.props.status === 'CANCELLED') {
      throw new ConflictError(`Credential ${this.id} is already ${this.props.status}`);
    }
    this.props.status = 'REVOKED';
    this.bump();
  }

  cancel(): void {
    if (this.isTerminal()) {
      throw new ConflictError(`Credential ${this.id} is already terminal`);
    }
    this.props.status = 'CANCELLED';
    this.bump();
  }

  markExpired(): void {
    if (this.isTerminal()) {
      throw new ConflictError(`Credential ${this.id} is already terminal`);
    }
    this.props.status = 'EXPIRED';
    this.bump();
  }

  markDelivered(): void {
    if (this.props.status !== 'READY_FOR_DELIVERY') {
      throw new ConflictError(`Credential ${this.id} cannot be delivered from ${this.props.status}`);
    }
    this.props.status = 'DELIVERED';
    this.props.deliveredAt = new Date();
    this.bump();
  }

  reactivate(): void {
    if (this.props.status !== 'SUSPENDED') {
      throw new ConflictError(`Credential ${this.id} is not suspended`);
    }
    // Revert to READY_FOR_DELIVERY if it was at that point, else IN_PRODUCTION.
    this.props.status = this.props.readyAt ? 'READY_FOR_DELIVERY' : 'IN_PRODUCTION';
    this.bump();
  }

  private bump(): void {
    this.props.updatedAt = new Date();
  }
}

function cryptoRandomId(): string {
  // Tiny inline helper to avoid domain importing crypto at module scope.
  // Belts and suspenders — service-level code always overrides this.
  // Using typeof-safe Math.random fallback keeps the domain layer pure.
  const rand = Math.random().toString(16).slice(2) + Date.now().toString(16);
  return `cr-${rand}`;
}
