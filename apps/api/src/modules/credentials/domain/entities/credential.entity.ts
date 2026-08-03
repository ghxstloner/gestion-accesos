import {
  ConflictError,
  ValidationError,
} from '../../../../common/domain/errors/domain-error';
import {
  formatCredentialNumber,
  type CredentialStatus,
  type CredentialType,
} from '../credential.constants';

/**
 * Provenance of the photograph attached to a credential.
 * - CAPTURED  = taken via WebRTC in the issuance workspace.
 * - UPLOADED   = file uploaded manually by the issuer as a fallback.
 * - REUSED     = copied from a previous credential of the same subject.
 */
export type PhotoSource = 'CAPTURED' | 'UPLOADED' | 'REUSED';

export interface PhotoInfo {
  fileId: string;
  source: PhotoSource;
  capturedAt: Date;
  reusedFromCredentialId: string | null;
}

export interface CredentialProps {
  id: string;
  credentialNumber: string;
  cardCode: string | null;
  requestId: string;
  /** Original credential this one replaces; null for primary issuance. */
  replacesCredentialId: string | null;
  credentialType: CredentialType;
  subjectUserId: string | null;
  holderName: string | null;
  authorizedZones: string[] | null;
  status: CredentialStatus;
  issuedAt: Date | null;
  expiresAt: Date | null;
  producedAt: Date | null;
  readyAt: Date | null;
  deliveredAt: Date | null;
  observations: string | null;
  photo: PhotoInfo | null;
  photoFileId: string | null;
  photoSource: string | null;
  photoCapturedAt: Date | null;
  photoReusedFromCredentialId: string | null;
  cardMaterialData: string | null;
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
    subjectUserId: string | null;
    holderName?: string | null;
    authorizedZones?: string[] | null;
    cardCode?: string | null;
    createdBy: string;
    sequence: number;
    year?: number;
    expiresAt?: Date | null;
    issuedAt?: Date | null;
    observations?: string | null;
  }): Credential {
    const year = input.year ?? new Date().getFullYear();
    const issuedAt = input.issuedAt ?? new Date();
    const expiresAt = input.expiresAt ?? null;
    if (expiresAt && expiresAt <= issuedAt) {
      throw new ValidationError(
        'Credential expiration must be after the issue date',
      );
    }
    const photoFileId = null;
    /* eslint-disable @typescript-eslint/no-unsafe-assignment */
    return new Credential({
      id: input.id ?? cryptoRandomId(),
      credentialNumber: formatCredentialNumber(
        input.credentialType,
        year,
        input.sequence,
      ),
      cardCode: input.cardCode ? input.cardCode.trim() : null,
      requestId: input.requestId,
      replacesCredentialId: null,
      credentialType: input.credentialType,
      subjectUserId: input.subjectUserId,
      holderName: input.holderName ? input.holderName.trim() : null,
      authorizedZones: input.authorizedZones
        ? [...input.authorizedZones]
        : null,
      status: 'PENDING_PRODUCTION',
      issuedAt,
      expiresAt,
      producedAt: null,
      readyAt: null,
      deliveredAt: null,
      observations: input.observations ?? null,
      photo: null,
      photoFileId,
      photoSource: null,
      photoCapturedAt: null,
      photoReusedFromCredentialId: null,
      cardMaterialData: null,
      createdBy: input.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    /* eslint-enable @typescript-eslint/no-unsafe-assignment */
  }

  static reconstitute(props: CredentialProps): Credential {
    return new Credential(props);
  }

  get id() {
    return this.props.id;
  }
  get credentialNumber() {
    return this.props.credentialNumber;
  }
  get cardCode() {
    return this.props.cardCode;
  }
  get requestId() {
    return this.props.requestId;
  }
  get replacesCredentialId() {
    return this.props.replacesCredentialId;
  }
  get credentialType() {
    return this.props.credentialType;
  }
  get subjectUserId() {
    return this.props.subjectUserId;
  }
  get holderName() {
    return this.props.holderName;
  }
  get authorizedZones(): readonly string[] {
    return this.props.authorizedZones ?? [];
  }
  get status() {
    return this.props.status;
  }
  get issuedAt() {
    return this.props.issuedAt;
  }
  get expiresAt() {
    return this.props.expiresAt;
  }
  get producedAt() {
    return this.props.producedAt;
  }
  get readyAt() {
    return this.props.readyAt;
  }
  get deliveredAt() {
    return this.props.deliveredAt;
  }
  get observations() {
    return this.props.observations;
  }
  get photo() {
    return this.props.photo;
  }
  get cardMaterialData() {
    return this.props.cardMaterialData;
  }
  get createdBy() {
    return this.props.createdBy;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get updatedAt() {
    return this.props.updatedAt;
  }

  toProps(): CredentialProps {
    return {
      ...this.props,
      authorizedZones: this.props.authorizedZones
        ? [...this.props.authorizedZones]
        : null,
      photo: this.props.photo ? { ...this.props.photo } : null,
    };
  }

  /**
   * Terminal = permanently immutable (no further lifecycle transitions).
   * Delivered credentials are NOT terminal: they can still be suspended,
   * revoked, cancelled, replaced or marked expired.
   */
  isTerminal(): boolean {
    return (
      this.props.status === 'CANCELLED' ||
      this.props.status === 'REVOKED' ||
      this.props.status === 'EXPIRED'
    );
  }

  isIssued(): boolean {
    return this.props.status !== 'PENDING_PRODUCTION';
  }

  /**
   * Attach or replace the photograph backing this credential. Updates the
   * photo-related fields persisted in the credentials row.
   */
  attachPhoto(info: PhotoInfo): void {
    const prevFileId = this.props.photoFileId;
    this.props.photo = { ...info };
    this.props.photoFileId = info.fileId;
    this.props.photoSource = info.source;
    this.props.photoCapturedAt = info.capturedAt;
    this.props.photoReusedFromCredentialId = info.reusedFromCredentialId;
    void prevFileId;
    this.bump();
  }

  setCardMaterialData(value: string | null): void {
    this.props.cardMaterialData = value;
    this.bump();
  }

  /**
   * Plan a replacement credential (loss / damage). Produces a brand-new
   * Credential aggregate carrying the supplied sequence. The caller must
   * persist it separately and transition the original to a terminal state.
   * Photo is carried forward when set.
   */
  planReplacement(input: {
    id: string;
    sequence: number;
    year?: number;
    cardCode?: string | null;
    reason?: string | null;
  }): Credential {
    const replacement = Credential.create({
      id: input.id,
      requestId: this.props.requestId,
      credentialType: this.props.credentialType,
      subjectUserId: this.props.subjectUserId,
      holderName: this.props.holderName,
      authorizedZones: this.props.authorizedZones,
      cardCode: input.cardCode ?? null,
      createdBy: this.props.createdBy,
      sequence: input.sequence,
      year: input.year,
      expiresAt: this.props.expiresAt,
      observations: input.reason ?? this.props.observations,
    });
    replacement.props.replacesCredentialId = this.props.id;
    if (this.props.photo) {
      replacement.attachPhoto({
        fileId: this.props.photo.fileId,
        source: 'REUSED',
        capturedAt: this.props.photo.capturedAt,
        reusedFromCredentialId: this.props.id,
      });
    }
    return replacement;
  }

  startProduction(): void {
    if (this.props.status !== 'PENDING_PRODUCTION') {
      throw new ConflictError(
        `Credential ${this.id} cannot start production from ${this.props.status}`,
      );
    }
    this.props.status = 'IN_PRODUCTION';
    this.props.producedAt = new Date();
    this.bump();
  }

  markReady(): void {
    if (this.props.status !== 'IN_PRODUCTION') {
      throw new ConflictError(
        `Credential ${this.id} cannot be marked ready from ${this.props.status}`,
      );
    }
    this.props.status = 'READY_FOR_DELIVERY';
    this.props.readyAt = new Date();
    this.bump();
  }

  returnToProduction(): void {
    if (this.props.status !== 'READY_FOR_DELIVERY') {
      throw new ConflictError(
        `Credential ${this.id} cannot return to production from ${this.props.status}`,
      );
    }
    this.props.status = 'IN_PRODUCTION';
    this.props.readyAt = null;
    this.bump();
  }

  suspend(): void {
    if (this.isTerminal()) {
      throw new ConflictError(
        `Credential ${this.id} is terminal and cannot be suspended`,
      );
    }
    if (this.props.status === 'SUSPENDED') {
      throw new ConflictError(`Credential ${this.id} is already suspended`);
    }
    this.props.status = 'SUSPENDED';
    this.bump();
  }

  revoke(): void {
    if (this.props.status === 'REVOKED' || this.props.status === 'CANCELLED') {
      throw new ConflictError(
        `Credential ${this.id} is already ${this.props.status}`,
      );
    }
    this.props.status = 'REVOKED';
    this.bump();
  }

  cancel(): void {
    if (this.props.status === 'CANCELLED') {
      throw new ConflictError(`Credential ${this.id} is already cancelled`);
    }
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
      throw new ConflictError(
        `Credential ${this.id} cannot be delivered from ${this.props.status}`,
      );
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
    this.props.status = this.props.readyAt
      ? 'READY_FOR_DELIVERY'
      : 'IN_PRODUCTION';
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

/** Mask a document identifier for display/storage (keep first chars + suffix). */
export function maskDocumentIdentifier(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length <= 4) return trimmed;
  if (trimmed.length <= 8) {
    return `${'*'.repeat(trimmed.length - 2)}${trimmed.slice(-2)}`;
  }
  return `${trimmed.slice(0, 2)}${'*'.repeat(Math.min(trimmed.length - 4, 8))}${trimmed.slice(-2)}`;
}
