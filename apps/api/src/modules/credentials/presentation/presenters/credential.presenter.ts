import type {
  CredentialEventRecord,
  CredentialRecord,
  DeliveryRecordInfo,
} from '../../domain/repositories/credential.repository.port';

export interface CredentialResponse {
  id: string;
  credentialNumber: string;
  requestId: string;
  credentialType: string;
  personId: string | null;
  status: string;
  issuedAt: string | null;
  expiresAt: string | null;
  producedAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CredentialEventResponse {
  id: string;
  credentialId: string;
  eventType: string;
  fromStatus: string | null;
  toStatus: string;
  actorUserId: string | null;
  comment: string | null;
  occurredAt: string;
}

export interface DeliveryResponse {
  id: string;
  credentialId: string;
  deliveredByUserId: string;
  receivedByName: string;
  receivedByIdentification: string;
  deliveredAt: string;
  observations: string | null;
  correctedAt: string | null;
  correctionReason: string | null;
}

export class CredentialPresenter {
  static toResponse(c: CredentialRecord): CredentialResponse {
    return {
      id: c.id,
      credentialNumber: c.credentialNumber,
      requestId: c.requestId,
      credentialType: c.credentialType,
      personId: c.personId,
      status: c.status,
      issuedAt: c.issuedAt ? c.issuedAt.toISOString() : null,
      expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
      producedAt: c.producedAt ? c.producedAt.toISOString() : null,
      readyAt: c.readyAt ? c.readyAt.toISOString() : null,
      deliveredAt: c.deliveredAt ? c.deliveredAt.toISOString() : null,
      createdBy: c.createdBy,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  }

  static toList(items: CredentialRecord[]): CredentialResponse[] {
    return items.map((c) => this.toResponse(c));
  }

  static toEvent(e: CredentialEventRecord): CredentialEventResponse {
    return {
      id: e.id,
      credentialId: e.credentialId,
      eventType: e.eventType,
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      actorUserId: e.actorUserId,
      comment: e.comment,
      occurredAt: e.occurredAt.toISOString(),
    };
  }

  static toDelivery(d: DeliveryRecordInfo): DeliveryResponse {
    return {
      id: d.id,
      credentialId: d.credentialId,
      deliveredByUserId: d.deliveredByUserId,
      receivedByName: d.receivedByName,
      receivedByIdentification: d.receivedByIdentification,
      deliveredAt: d.deliveredAt.toISOString(),
      observations: d.observations,
      correctedAt: d.correctedAt ? d.correctedAt.toISOString() : null,
      correctionReason: d.correctionReason,
    };
  }
}
