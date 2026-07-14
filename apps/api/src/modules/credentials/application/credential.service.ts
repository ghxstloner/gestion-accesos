import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedUser } from '../../../common/presentation/decorators/authenticated-user';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../common/domain/errors/domain-error';
import { RequestService } from '../../requests/application/request.service';
import {
  CREDENTIAL_PREFIX,
  type CredentialType,
} from '../domain/credential.constants';
import { Credential } from '../domain/entities/credential.entity';
import { CredentialMapper } from '../infrastructure/persistence/mappers/credential.mapper';
import {
  CREDENTIAL_REPOSITORY,
  type CredentialListFilters,
  type CredentialRepositoryPort,
  type DeliveryRecordInfo,
} from '../domain/repositories/credential.repository.port';

export interface IssueCredentialInput {
  requestId: string;
  credentialType: CredentialType;
  personId: string | null;
  expiresAt?: Date | null;
  comment?: string | null;
}

@Injectable()
export class CredentialService {
  constructor(
    @Inject(CREDENTIAL_REPOSITORY) private readonly credentials: CredentialRepositoryPort,
    private readonly requestService: RequestService,
  ) {}

  private assertIssuer(actor: AuthenticatedUser): void {
    if (!actor.permissions.includes('issuance.manage') && !actor.roles.includes('SYSTEM_ADMIN')) {
      throw new ForbiddenError('You do not have issuance permissions');
    }
  }

  async issue(actor: AuthenticatedUser, input: IssueCredentialInput): Promise<Credential> {
    this.assertIssuer(actor);
    const existing = await this.credentials.findByRequestId(input.requestId);
    if (existing) {
      throw new ValidationError('A credential has already been issued for this request');
    }
    // Verify the request is approved
    const req = await this.requestService.getById(actor, input.requestId);
    if (req.status !== 'APPROVED') {
      throw new ValidationError(`Cannot issue credential for request in status ${req.status}`);
    }
    const prefix = CREDENTIAL_PREFIX[input.credentialType];
    const sequence = (await this.credentials.countByPrefixThisYear(prefix)) + 1;
    const cred = Credential.create({
      id: randomUUID(),
      requestId: input.requestId,
      credentialType: input.credentialType,
      personId: input.personId,
      createdBy: actor.userId,
      sequence,
      expiresAt: input.expiresAt ?? null,
    });
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
    return cred;
  }

  async getById(actor: AuthenticatedUser, id: string): Promise<Credential> {
    const record = await this.credentials.findById(id);
    if (!record) throw new NotFoundError('Credential', id);
    return CredentialMapper.toDomain(record);
  }

  async getByRequest(actor: AuthenticatedUser, requestId: string): Promise<Credential | null> {
    const record = await this.credentials.findByRequestId(requestId);
    return record ? CredentialMapper.toDomain(record) : null;
  }

  async list(actor: AuthenticatedUser, filters: CredentialListFilters, page: number, pageSize: number) {
    this.assertIssuer(actor);
    return this.credentials.list({ filters, page, pageSize });
  }

  async listEvents(actor: AuthenticatedUser, credentialId: string) {
    this.assertIssuer(actor);
    return this.credentials.listEvents(credentialId);
  }

  async transition(
    actor: AuthenticatedUser,
    id: string,
    action: 'start_production' | 'mark_ready' | 'return_to_production' | 'suspend' | 'revoke' | 'cancel' | 'reactivate' | 'mark_expired',
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
            eventType: cred.status === 'READY_FOR_DELIVERY' ? 'MARKED_READY' : 'STARTED_PRODUCTION',
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
    payload: { receivedByName: string; receivedByIdentification: string; observations?: string | null },
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

  async correctDelivery(actor: AuthenticatedUser, id: string, reason: string): Promise<Credential> {
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
    this.assertIssuer(actor);
    return this.credentials.findDeliveryByCredential(id);
  }
}
