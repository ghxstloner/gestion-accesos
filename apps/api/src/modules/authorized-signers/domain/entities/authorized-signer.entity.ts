import { randomUUID } from 'crypto';
import { ValidationError } from '../../../../common/domain/errors/domain-error';

export type AuthorizedSignerStatus = 'ACTIVE' | 'INACTIVE' | 'REVOKED';

export interface AuthorizedSignerProps {
  id: string;
  companyId: string;
  signerUserId: string;
  position: string;
  validFrom: Date;
  validUntil: Date | null;
  authorizationDocumentId: string | null;
  signatureFileId: string | null;
  status: AuthorizedSignerStatus;
  revokedAt: Date | null;
  revokedBy: string | null;
  revocationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SignerMutationInput {
  position?: string;
  validFrom?: Date;
  validUntil?: Date | null;
  authorizationDocumentId?: string | null;
  signatureFileId?: string | null;
}

export class CompanyAuthorizedSigner {
  private readonly _id: string;
  private _companyId: string;
  private _signerUserId: string;
  private _position: string;
  private _validFrom: Date;
  private _validUntil: Date | null;
  private _authorizationDocumentId: string | null;
  private _signatureFileId: string | null;
  private _status: AuthorizedSignerStatus;
  private _revokedAt: Date | null;
  private _revokedBy: string | null;
  private _revocationReason: string | null;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: AuthorizedSignerProps) {
    Object.assign(this, props);
    this._id = props.id;
    this._companyId = props.companyId;
    this._signerUserId = props.signerUserId;
    this._position = props.position;
    this._validFrom = props.validFrom;
    this._validUntil = props.validUntil;
    this._authorizationDocumentId = props.authorizationDocumentId;
    this._signatureFileId = props.signatureFileId;
    this._status = props.status;
    this._revokedAt = props.revokedAt;
    this._revokedBy = props.revokedBy;
    this._revocationReason = props.revocationReason;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  static create(input: {
    companyId: string;
    signerUserId: string;
    position: string;
    validFrom: Date;
    validUntil?: Date | null;
    authorizationDocumentId?: string | null;
    signatureFileId?: string | null;
  }): CompanyAuthorizedSigner {
    if (!input.position?.trim())
      throw new ValidationError('position is required');
    if (!input.signerUserId)
      throw new ValidationError('signerUserId is required');
    if (!input.companyId) throw new ValidationError('companyId is required');
    if (input.validUntil && input.validUntil < input.validFrom) {
      throw new ValidationError('validUntil cannot be earlier than validFrom');
    }
    return new CompanyAuthorizedSigner({
      id: randomUUID(),
      companyId: input.companyId,
      signerUserId: input.signerUserId,
      position: input.position.trim(),
      validFrom: input.validFrom,
      validUntil: input.validUntil ?? null,
      authorizationDocumentId: input.authorizationDocumentId ?? null,
      signatureFileId: input.signatureFileId ?? null,
      status: 'ACTIVE',
      revokedAt: null,
      revokedBy: null,
      revocationReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static reconstitute(props: AuthorizedSignerProps): CompanyAuthorizedSigner {
    return new CompanyAuthorizedSigner(props);
  }

  get id(): string {
    return this._id;
  }
  get companyId(): string {
    return this._companyId;
  }
  get signerUserId(): string {
    return this._signerUserId;
  }
  get position(): string {
    return this._position;
  }
  get validFrom(): Date {
    return this._validFrom;
  }
  get validUntil(): Date | null {
    return this._validUntil;
  }
  get authorizationDocumentId(): string | null {
    return this._authorizationDocumentId;
  }
  get signatureFileId(): string | null {
    return this._signatureFileId;
  }
  get status(): AuthorizedSignerStatus {
    return this._status;
  }
  get revokedAt(): Date | null {
    return this._revokedAt;
  }
  get revokedBy(): string | null {
    return this._revokedBy;
  }
  get revocationReason(): string | null {
    return this._revocationReason;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }

  /** Derived status — EXPIRED is calculated rather than stored. */
  get effectiveStatus(): AuthorizedSignerStatus | 'EXPIRED' {
    if (this._status !== 'ACTIVE') return this._status;
    if (this._validUntil && this._validUntil < new Date()) return 'EXPIRED';
    return 'ACTIVE';
  }

  /** A signer that is not currently able to authorize a NEW request. */
  get cannotAuthorize(): boolean {
    return this.effectiveStatus !== 'ACTIVE';
  }

  update(input: SignerMutationInput): void {
    if (input.position !== undefined) {
      if (!input.position.trim())
        throw new ValidationError('position cannot be empty');
      this._position = input.position.trim();
    }
    if (input.validFrom !== undefined) this._validFrom = input.validFrom;
    if (input.validUntil !== undefined) {
      const validUntil = input.validUntil;
      if (validUntil && validUntil < this._validFrom) {
        throw new ValidationError(
          'validUntil cannot be earlier than validFrom',
        );
      }
      this._validUntil = validUntil;
    }
    if (input.authorizationDocumentId !== undefined)
      this._authorizationDocumentId = input.authorizationDocumentId;
    if (input.signatureFileId !== undefined)
      this._signatureFileId = input.signatureFileId;
    this._updatedAt = new Date();
  }

  activate(): void {
    if (this._status === 'ACTIVE') return;
    if (this._status === 'REVOKED') {
      throw new ValidationError(
        'A revoked signer cannot be reactivated; create a new signer instead',
      );
    }
    this._status = 'ACTIVE';
    this._updatedAt = new Date();
  }

  deactivate(): void {
    if (this._status !== 'ACTIVE') return;
    this._status = 'INACTIVE';
    this._updatedAt = new Date();
  }

  revoke(actorUserId: string, reason: string): void {
    if (this._status === 'REVOKED') return;
    if (!reason.trim())
      throw new ValidationError('revocationReason is required');
    this._status = 'REVOKED';
    this._revokedAt = new Date();
    this._revokedBy = actorUserId;
    this._revocationReason = reason.trim();
    this._updatedAt = new Date();
  }

  toProps(): AuthorizedSignerProps {
    return {
      id: this._id,
      companyId: this._companyId,
      signerUserId: this._signerUserId,
      position: this._position,
      validFrom: this._validFrom,
      validUntil: this._validUntil,
      authorizationDocumentId: this._authorizationDocumentId,
      signatureFileId: this._signatureFileId,
      status: this._status,
      revokedAt: this._revokedAt,
      revokedBy: this._revokedBy,
      revocationReason: this._revocationReason,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }
}
