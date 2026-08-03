import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedUser } from '../../../common/presentation/decorators/authenticated-user';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../common/domain/errors/domain-error';
import { AuditService } from '../../audit/application/audit.service';
import { RequestService } from '../../requests/application/request.service';
import {
  CREDENTIAL_PREFIX,
  type CredentialType,
} from '../domain/credential.constants';
import {
  Credential,
  maskDocumentIdentifier,
  type PhotoInfo,
  type PhotoSource,
} from '../domain/entities/credential.entity';
import { CredentialMapper } from '../infrastructure/persistence/mappers/credential.mapper';
import {
  CREDENTIAL_REPOSITORY,
  type CredentialListFilters,
  type CredentialRepositoryPort,
  type CustodyListFilters,
  type CustodyRecordInfo,
  type DeliveryRecordInfo,
  type FileMetadataRecord,
} from '../domain/repositories/credential.repository.port';

export interface IssueCredentialInput {
  requestId: string;
  credentialType: CredentialType;
  subjectUserId: string | null;
  /** Denormalised holder display name (primary participant snapshot). */
  holderName?: string | null;
  /** Subset of the parent request's approved accessAreas (catalog item ids). */
  authorizedZones?: string[] | null;
  cardCode?: string | null;
  expiresAt?: Date | null;
  issuedAt?: Date | null;
  observations?: string | null;
  comment?: string | null;
}

export interface UploadPhotoInput {
  /** Source of the photograph. CAPTURED (WebRTC) or UPLOADED (file fallback). */
  source: Extract<PhotoSource, 'CAPTURED' | 'UPLOADED'>;
  originalFilename: string;
  mimeType: string;
  size: number;
  bytes: Buffer;
  storageKey: string;
  sha256: string;
  storedFilename: string;
}

export interface DepositCustodyInput {
  credentialId: string;
  holderName?: string | null;
  documentType: string;
  /** Cleartext identifier supplied by the operator; the service masks it. */
  documentIdentifier: string;
  temporaryPermitRef?: string | null;
  expectedReturnAt?: Date | null;
  notes?: string | null;
}

export interface ReturnCustodyInput {
  custodyId: string;
  returnReceivedBy: string;
  returnCondition?: string | null;
  notes?: string | null;
}

@Injectable()
export class CredentialService {
  constructor(
    @Inject(CREDENTIAL_REPOSITORY)
    private readonly credentials: CredentialRepositoryPort,
    private readonly requestService: RequestService,
    private readonly auditService: AuditService,
  ) {}

  assertIssuer(actor: AuthenticatedUser): void {
    if (
      !actor.permissions.includes('issuance.manage') &&
      !actor.roles.includes('SYSTEM_ADMIN')
    ) {
      throw new ForbiddenError('You do not have issuance permissions');
    }
  }

  assertReader(actor: AuthenticatedUser): void {
    if (
      !actor.permissions.includes('issuance.read') &&
      !actor.permissions.includes('issuance.manage') &&
      !actor.roles.includes('SYSTEM_ADMIN')
    ) {
      throw new ForbiddenError('You do not have issuance read permissions');
    }
  }

  async issue(
    actor: AuthenticatedUser,
    input: IssueCredentialInput,
  ): Promise<Credential> {
    this.assertIssuer(actor);
    const existing = await this.credentials.findByRequestId(input.requestId);
    if (existing) {
      const existingCred = CredentialMapper.toDomain(existing);
      // Idempotent re-issue: return the existing credential unchanged when the
      // caller supplies the same type AND the credential is still in the
      // pre-issuance / production states (so re-calling issue() is a safe
      // no-op retry). Lets the UI safely retry without creating duplicates.
      // When the prior credential has progressed past READY_FOR_DELIVERY (i.e.
      // DELIVERED, SUSPENDED) or reached a terminal state (REVOKED / CANCELLED
      // / EXPIRED), we instead fall through and create a fresh credential.
      const IDEMPOTENT_STATUSES = new Set([
        'PENDING_PRODUCTION',
        'IN_PRODUCTION',
        'READY_FOR_DELIVERY',
      ]);
      if (IDEMPOTENT_STATUSES.has(existingCred.status)) {
        if (existing.credentialType === input.credentialType) {
          return existingCred;
        }
        throw new ValidationError(
          'A credential of a different type has already been issued for this request',
        );
      }
    }
    // Authorization for cross-company reads is delegated to RequestService.
    const req = await this.requestService.getById(actor, input.requestId);
    if (req.status !== 'APPROVED') {
      throw new ValidationError(
        `Cannot issue credential for request in status ${req.status}`,
      );
    }
    // Validate card code uniqueness when supplied.
    let cardCode = input.cardCode ? input.cardCode.trim() : null;
    if (cardCode) {
      const clash = await this.credentials.findActiveByCardCode(cardCode);
      if (clash) {
        throw new ConflictError(`Card code ${cardCode} is already in use`);
      }
    } else {
      cardCode = null;
    }
    // Validate credential number uniqueness defensively (count is the primary
    // path; this guards against accidental collisions).
    const prefix = CREDENTIAL_PREFIX[input.credentialType];
    const sequence = (await this.credentials.countByPrefixThisYear(prefix)) + 1;
    // Validate authorized zones against the parent request's approved set.
    const requestedZones = input.authorizedZones ?? null;
    const allowedZones = this.resolveApprovedZones(req);
    if (requestedZones) {
      const allowed = new Set(allowedZones);
      for (const zone of requestedZones) {
        if (!allowed.has(zone)) {
          throw new ValidationError(
            `Zone ${zone} is not part of the approved request`,
          );
        }
      }
    }
    const cred = Credential.create({
      id: randomUUID(),
      requestId: input.requestId,
      credentialType: input.credentialType,
      subjectUserId: input.subjectUserId,
      holderName: input.holderName ?? null,
      authorizedZones:
        requestedZones ?? (allowedZones.length ? allowedZones : null),
      cardCode,
      createdBy: actor.userId,
      sequence,
      issuedAt: input.issuedAt ?? null,
      expiresAt: input.expiresAt ?? null,
      observations: input.observations ?? null,
    });
    // Defensive uniqueness check on the generated credential number.
    const existingNumber = await this.credentials.findByCredentialNumber(
      cred.credentialNumber,
    );
    if (existingNumber) {
      throw new ConflictError(
        `Credential number ${cred.credentialNumber} already exists`,
      );
    }
    await this.credentials.save(CredentialMapper.toRecord(cred));
    await this.credentials.saveEvent(
      CredentialMapper.toEventRecord({
        credentialId: cred.id,
        eventType: 'CREATED',
        fromStatus: null,
        toStatus: 'PENDING_PRODUCTION',
        actorUserId: actor.userId,
        comment: input.comment ?? null,
      }),
    );
    await this.audit(actor, 'credential.issue', cred.id, {
      credentialNumber: cred.credentialNumber,
      requestId: cred.requestId,
      cardCode: cred.cardCode,
      credentialType: cred.credentialType,
    });
    return cred;
  }

  async getById(actor: AuthenticatedUser, id: string): Promise<Credential> {
    this.assertReader(actor);
    const record = await this.credentials.findById(id);
    if (!record) throw new NotFoundError('Credential', id);
    return CredentialMapper.toDomain(record);
  }

  async getByRequest(
    actor: AuthenticatedUser,
    requestId: string,
  ): Promise<Credential | null> {
    this.assertReader(actor);
    const record = await this.credentials.findByRequestId(requestId);
    return record ? CredentialMapper.toDomain(record) : null;
  }

  async list(
    actor: AuthenticatedUser,
    filters: CredentialListFilters,
    page: number,
    pageSize: number,
  ) {
    this.assertReader(actor);
    return this.credentials.list({ filters, page, pageSize });
  }

  async listEvents(actor: AuthenticatedUser, credentialId: string) {
    this.assertReader(actor);
    return this.credentials.listEvents(credentialId);
  }

  async transition(
    actor: AuthenticatedUser,
    id: string,
    action:
      | 'start_production'
      | 'mark_ready'
      | 'return_to_production'
      | 'suspend'
      | 'revoke'
      | 'cancel'
      | 'reactivate'
      | 'mark_expired',
    comment?: string | null,
  ): Promise<Credential> {
    this.assertIssuer(actor);
    const cred = await this.getById(actor, id);
    const fromStatus = cred.status;
    switch (action) {
      case 'start_production':
        cred.startProduction();
        await this.credentials.saveEvent(
          CredentialMapper.toEventRecord({
            credentialId: cred.id,
            eventType: 'STARTED_PRODUCTION',
            fromStatus,
            toStatus: cred.status,
            actorUserId: actor.userId,
            comment: comment ?? null,
          }),
        );
        break;
      case 'mark_ready':
        cred.markReady();
        await this.credentials.saveEvent(
          CredentialMapper.toEventRecord({
            credentialId: cred.id,
            eventType: 'MARKED_READY',
            fromStatus,
            toStatus: cred.status,
            actorUserId: actor.userId,
            comment: comment ?? null,
          }),
        );
        break;
      case 'return_to_production':
        cred.returnToProduction();
        await this.credentials.saveEvent(
          CredentialMapper.toEventRecord({
            credentialId: cred.id,
            eventType: 'RETURNED_TO_PRODUCTION',
            fromStatus,
            toStatus: cred.status,
            actorUserId: actor.userId,
            comment: comment ?? null,
          }),
        );
        break;
      case 'suspend':
        cred.suspend();
        await this.credentials.saveEvent(
          CredentialMapper.toEventRecord({
            credentialId: cred.id,
            eventType: 'SUSPENDED',
            fromStatus,
            toStatus: cred.status,
            actorUserId: actor.userId,
            comment: comment ?? null,
          }),
        );
        break;
      case 'revoke':
        cred.revoke();
        await this.credentials.saveEvent(
          CredentialMapper.toEventRecord({
            credentialId: cred.id,
            eventType: 'REVOKED',
            fromStatus,
            toStatus: cred.status,
            actorUserId: actor.userId,
            comment: comment ?? null,
          }),
        );
        break;
      case 'cancel':
        cred.cancel();
        await this.credentials.saveEvent(
          CredentialMapper.toEventRecord({
            credentialId: cred.id,
            eventType: 'CANCELLED',
            fromStatus,
            toStatus: cred.status,
            actorUserId: actor.userId,
            comment: comment ?? null,
          }),
        );
        break;
      case 'reactivate':
        cred.reactivate();
        // No dedicated event type for reactivation; log as MARKED_READY if going back to READY_FOR_DELIVERY, else STARTED_PRODUCTION.
        await this.credentials.saveEvent(
          CredentialMapper.toEventRecord({
            credentialId: cred.id,
            eventType:
              cred.status === 'READY_FOR_DELIVERY'
                ? 'MARKED_READY'
                : 'STARTED_PRODUCTION',
            fromStatus,
            toStatus: cred.status,
            actorUserId: actor.userId,
            comment: comment ?? null,
          }),
        );
        break;
      case 'mark_expired':
        cred.markExpired();
        await this.credentials.saveEvent(
          CredentialMapper.toEventRecord({
            credentialId: cred.id,
            eventType: 'EXPIRED',
            fromStatus,
            toStatus: cred.status,
            actorUserId: actor.userId,
            comment: comment ?? null,
          }),
        );
        break;
    }
    await this.credentials.save(CredentialMapper.toRecord(cred));
    return cred;
  }

  async deliver(
    actor: AuthenticatedUser,
    id: string,
    payload: {
      receivedByName: string;
      receivedByIdentification: string;
      observations?: string | null;
    },
  ): Promise<Credential> {
    this.assertIssuer(actor);
    const cred = await this.getById(actor, id);
    const fromStatus = cred.status;
    cred.markDelivered();
    await this.credentials.save(CredentialMapper.toRecord(cred));
    await this.credentials.saveEvent(
      CredentialMapper.toEventRecord({
        credentialId: cred.id,
        eventType: 'DELIVERED',
        fromStatus,
        toStatus: cred.status,
        actorUserId: actor.userId,
        comment: payload.observations ?? null,
      }),
    );
    const delivery: DeliveryRecordInfo = {
      id: randomUUID(),
      credentialId: cred.id,
      deliveredByUserId: actor.userId,
      receivedByName: payload.receivedByName,
      receivedByIdentification: payload.receivedByIdentification,
      deliveredAt: new Date(),
      observations: payload.observations ?? null,
      correctedAt: null,
      correctionReason: null,
    };
    await this.credentials.saveDelivery(delivery);
    return cred;
  }

  async correctDelivery(
    actor: AuthenticatedUser,
    id: string,
    reason: string,
  ): Promise<Credential> {
    this.assertIssuer(actor);
    const cred = await this.getById(actor, id);
    if (cred.status !== 'DELIVERED') {
      throw new ValidationError('Credential is not delivered');
    }
    await this.credentials.markDeliveryCorrected(cred.id, reason);
    await this.credentials.saveEvent(
      CredentialMapper.toEventRecord({
        credentialId: cred.id,
        eventType: 'CORRECTED_DELIVERY',
        fromStatus: 'DELIVERED',
        toStatus: 'DELIVERED',
        actorUserId: actor.userId,
        comment: reason,
      }),
    );
    return cred;
  }

  async getDelivery(actor: AuthenticatedUser, id: string) {
    this.assertReader(actor);
    return this.credentials.findDeliveryByCredential(id);
  }

  /**
   * Resolve the set of catalog access-area ids authorised for the request.
   * Uses individually approved areas when present; otherwise falls back to
   * every area attached to an APPROVED request (configurable airports).
   */
  private resolveApprovedZones(req: {
    status: string;
    accessAreas: ReadonlyArray<{
      accessAreaId: string;
      reviewStatus: string;
    }>;
  }): string[] {
    const approved = req.accessAreas.filter(
      (a) => a.reviewStatus === 'APPROVED',
    );
    if (approved.length > 0) {
      return approved.map((a) => a.accessAreaId);
    }
    return req.accessAreas.map((a) => a.accessAreaId);
  }

  private async audit(
    actor: AuthenticatedUser,
    action: string,
    aggregateId: string | null,
    newData?: Record<string, unknown>,
  ): Promise<void> {
    await this.auditService.record({
      actorUserId: actor.userId,
      actorCompanyId: actor.companyId ?? null,
      action,
      aggregateType: 'credential',
      aggregateId,
      newData: newData ?? null,
    });
  }

  // ── Photograph management ──

  /**
   * Persist a freshly captured or uploaded photograph and link it to the
   * credential. Replaces any previous photograph.
   */
  async attachPhoto(
    actor: AuthenticatedUser,
    credentialId: string,
    input: UploadPhotoInput,
  ): Promise<Credential> {
    this.assertIssuer(actor);
    const cred = await this.getById(actor, credentialId);
    // Photographs can only be attached while the credential is still in
    // production (not yet delivered, not terminal).
    if (cred.isTerminal() || cred.status === 'DELIVERED') {
      throw new ValidationError(
        `Cannot attach a photograph to a ${cred.status} credential`,
      );
    }
    const fileId = randomUUID();
    const fileMeta: FileMetadataRecord = {
      id: fileId,
      storageKey: input.storageKey,
      originalFilename: input.originalFilename,
      storedFilename: input.storedFilename,
      mimeType: input.mimeType,
      size: input.size,
      sha256: input.sha256,
      createdAt: new Date(),
    };
    await this.credentials.saveFileMetadata(fileMeta);
    const info: PhotoInfo = {
      fileId,
      source: input.source,
      capturedAt: new Date(),
      reusedFromCredentialId: null,
    };
    cred.attachPhoto(info);
    await this.credentials.save(CredentialMapper.toRecord(cred));
    const eventType =
      input.source === 'CAPTURED' ? 'PHOTO_CAPTURED' : 'PHOTO_UPLOADED';
    await this.credentials.saveEvent(
      CredentialMapper.toEventRecord({
        credentialId: cred.id,
        eventType,
        fromStatus: cred.status,
        toStatus: cred.status,
        actorUserId: actor.userId,
        comment: fileMeta.originalFilename,
      }),
    );
    await this.audit(actor, 'credential.photo.attach', cred.id, {
      source: info.source,
      fileId,
    });
    return cred;
  }

  /**
   * Reuse the photograph from a previous credential of the same subject.
   * Only permitted when an existing photograph exists and the issuer confirms.
   */
  async reusePreviousPhoto(
    actor: AuthenticatedUser,
    credentialId: string,
    confirmed: boolean,
  ): Promise<Credential> {
    this.assertIssuer(actor);
    if (!confirmed) {
      throw new ValidationError(
        'Photo reuse requires explicit issuer confirmation',
      );
    }
    const cred = await this.getById(actor, credentialId);
    if (cred.isTerminal() || cred.status === 'DELIVERED') {
      throw new ValidationError(
        `Cannot attach a photograph to a ${cred.status} credential`,
      );
    }
    if (!cred.subjectUserId) {
      throw new ValidationError(
        'Photo reuse requires the credential to be bound to a subject',
      );
    }
    const source = await this.credentials.findLatestWithPhotoForSubject(
      cred.subjectUserId,
    );
    if (!source || !source.photoFileId || source.id === cred.id) {
      throw new NotFoundError(
        'Reusable photograph for this subject',
        cred.subjectUserId,
      );
    }
    const info: PhotoInfo = {
      fileId: source.photoFileId,
      source: 'REUSED',
      capturedAt: source.photoCapturedAt ?? new Date(),
      reusedFromCredentialId: source.id,
    };
    cred.attachPhoto(info);
    await this.credentials.save(CredentialMapper.toRecord(cred));
    await this.credentials.saveEvent(
      CredentialMapper.toEventRecord({
        credentialId: cred.id,
        eventType: 'PHOTO_REUSED',
        fromStatus: cred.status,
        toStatus: cred.status,
        actorUserId: actor.userId,
        comment: source.id,
      }),
    );
    await this.audit(actor, 'credential.photo.reuse', cred.id, {
      sourceCredentialId: source.id,
      fileId: source.photoFileId,
    });
    return cred;
  }

  async findReusablePhoto(
    actor: AuthenticatedUser,
    credentialId: string,
  ): Promise<{
    credentialId: string;
    fileId: string;
    capturedAt: Date;
  } | null> {
    this.assertReader(actor);
    const cred = await this.getById(actor, credentialId);
    if (!cred.subjectUserId) return null;
    const source = await this.credentials.findLatestWithPhotoForSubject(
      cred.subjectUserId,
    );
    if (!source || !source.photoFileId || source.id === cred.id) return null;
    return {
      credentialId: source.id,
      fileId: source.photoFileId,
      capturedAt: source.photoCapturedAt ?? source.createdAt,
    };
  }

  async getFileMetadata(
    actor: AuthenticatedUser,
    fileId: string,
  ): Promise<FileMetadataRecord | null> {
    this.assertReader(actor);
    return this.credentials.findFileMetadata(fileId);
  }

  // ── Replacement ──

  async replace(
    actor: AuthenticatedUser,
    id: string,
    payload: { reason: string; cardCode?: string | null },
  ): Promise<{ original: Credential; replacement: Credential }> {
    this.assertIssuer(actor);
    if (!payload.reason || !payload.reason.trim()) {
      throw new ValidationError(
        'A reason is required for credential replacement',
      );
    }
    const original = await this.getById(actor, id);
    if (original.isTerminal()) {
      throw new ConflictError(
        `Cannot replace a terminal credential ${original.status}`,
      );
    }
    let cardCode = payload.cardCode ? payload.cardCode.trim() : null;
    if (cardCode) {
      const clash = await this.credentials.findActiveByCardCode(cardCode);
      if (clash && clash.id !== original.id) {
        throw new ConflictError(`Card code ${cardCode} is already in use`);
      }
    } else if (original.cardCode) {
      // Inherit a new code from the original — we never reuse the literal
      // value because the original will be revoked (still flagged unique).
      cardCode = null;
    }
    const prefix = CREDENTIAL_PREFIX[original.credentialType];
    const sequence = (await this.credentials.countByPrefixThisYear(prefix)) + 1;
    const replacement = original.planReplacement({
      id: randomUUID(),
      sequence,
      cardCode,
      reason: payload.reason,
    });
    const dup = await this.credentials.findByCredentialNumber(
      replacement.credentialNumber,
    );
    if (dup) {
      throw new ConflictError(
        `Credential number ${replacement.credentialNumber} already exists`,
      );
    }
    const fromStatus = original.status;
    original.revoke();
    await this.credentials.save(CredentialMapper.toRecord(original));
    await this.credentials.save(CredentialMapper.toRecord(replacement));
    await this.credentials.saveEvent(
      CredentialMapper.toEventRecord({
        credentialId: original.id,
        eventType: 'REPLACED',
        fromStatus,
        toStatus: original.status,
        actorUserId: actor.userId,
        comment: payload.reason,
      }),
    );
    await this.credentials.saveEvent(
      CredentialMapper.toEventRecord({
        credentialId: replacement.id,
        eventType: 'CREATED',
        fromStatus: null,
        toStatus: replacement.status,
        actorUserId: actor.userId,
        comment: `Replacement of ${original.credentialNumber}`,
      }),
    );
    await this.audit(actor, 'credential.replace', original.id, {
      reason: payload.reason,
      replacementId: replacement.id,
      replacementNumber: replacement.credentialNumber,
    });
    return { original, replacement };
  }

  // ── Custody ──

  async listCustody(
    actor: AuthenticatedUser,
    filters: CustodyListFilters,
    page: number,
    pageSize: number,
  ) {
    this.assertReader(actor);
    return this.credentials.listCustody({ filters, page, pageSize });
  }

  async getCustody(actor: AuthenticatedUser, id: string) {
    this.assertReader(actor);
    const record = await this.credentials.findCustody(id);
    if (!record) throw new NotFoundError('CustodyRecord', id);
    return record;
  }

  async getCustodyByCredential(actor: AuthenticatedUser, credentialId: string) {
    this.assertReader(actor);
    return this.credentials.findCustodyByCredential(credentialId);
  }

  async depositCustody(
    actor: AuthenticatedUser,
    input: DepositCustodyInput,
  ): Promise<CustodyRecordInfo> {
    this.assertIssuer(actor);
    if (!input.documentIdentifier.trim()) {
      throw new ValidationError('Document identifier is required');
    }
    if (!input.documentType.trim()) {
      throw new ValidationError('Document type is required');
    }
    const cred = await this.getById(actor, input.credentialId);
    if (!cred.subjectUserId) {
      throw new ValidationError(
        'Credential must be bound to a subject before depositing custody',
      );
    }
    const existing = await this.credentials.findCustodyByCredential(cred.id);
    if (existing && !existing.returnTime) {
      throw new ConflictError(
        'An active custody record already exists for this credential',
      );
    }
    const now = new Date();
    const record: CustodyRecordInfo = {
      id: randomUUID(),
      credentialId: cred.id,
      subjectUserId: cred.subjectUserId,
      holderName: input.holderName ?? cred.holderName ?? null,
      documentType: input.documentType.trim(),
      documentIdentifier: maskDocumentIdentifier(input.documentIdentifier),
      temporaryPermitRef: input.temporaryPermitRef?.trim() || null,
      receivedByUserId: actor.userId,
      depositTime: now,
      expectedReturnAt: input.expectedReturnAt ?? null,
      depositNotes: input.notes ?? null,
      returnTime: null,
      returnedByUserId: null,
      returnReceivedBy: null,
      returnCondition: null,
      returnNotes: null,
      createdAt: now,
      updatedAt: now,
    };
    await this.credentials.saveCustody(record);
    await this.credentials.saveEvent(
      CredentialMapper.toEventRecord({
        credentialId: cred.id,
        eventType: 'CUSTODY_DEPOSITED',
        fromStatus: cred.status,
        toStatus: cred.status,
        actorUserId: actor.userId,
        comment: record.documentType,
      }),
    );
    await this.audit(actor, 'custody.deposit', record.id, {
      credentialId: cred.id,
      expectedReturnAt: record.expectedReturnAt
        ? record.expectedReturnAt.toISOString()
        : null,
    });
    return record;
  }

  async returnCustody(
    actor: AuthenticatedUser,
    input: ReturnCustodyInput,
  ): Promise<CustodyRecordInfo> {
    this.assertIssuer(actor);
    if (!input.returnReceivedBy.trim()) {
      throw new ValidationError('Return received-by name is required');
    }
    const record = await this.credentials.findCustody(input.custodyId);
    if (!record) throw new NotFoundError('CustodyRecord', input.custodyId);
    if (record.returnTime) {
      throw new ConflictError('Custody record was already returned');
    }
    const now = new Date();
    const updated: CustodyRecordInfo = {
      ...record,
      returnTime: now,
      returnedByUserId: actor.userId,
      returnReceivedBy: input.returnReceivedBy.trim(),
      returnCondition: input.returnCondition?.trim() || null,
      returnNotes: input.notes ?? null,
      updatedAt: now,
    };
    await this.credentials.saveCustody(updated);
    await this.credentials.saveEvent(
      CredentialMapper.toEventRecord({
        credentialId: record.credentialId,
        eventType: 'CUSTODY_RETURNED',
        fromStatus: null,
        toStatus: null,
        actorUserId: actor.userId,
        comment: input.returnCondition ?? null,
      }),
    );
    await this.audit(actor, 'custody.return', record.id, {
      credentialId: record.credentialId,
      condition: updated.returnCondition,
    });
    return updated;
  }

  /**
   * Compute whether a custody record is overdue based on its expected return
   * date and current time. Pure helper exposed so the UI/controller can render
   * dynamic status without storing it.
   */
  computeCustodyStatus(
    record: CustodyRecordInfo,
  ): 'ACTIVE' | 'RETURNED' | 'OVERDUE' {
    if (record.returnTime) return 'RETURNED';
    if (record.expectedReturnAt && record.expectedReturnAt < new Date()) {
      return 'OVERDUE';
    }
    return 'ACTIVE';
  }
}
