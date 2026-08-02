import type {
  CredentialEventRecord,
  CredentialRecord,
  CustodyRecordInfo,
  DeliveryRecordInfo,
} from '../../domain/repositories/credential.repository.port';

export interface CredentialResponse {
  id: string;
  credentialNumber: string;
  cardCode: string | null;
  requestId: string;
  credentialType: string;
  subjectUserId: string | null;
  holderName: string | null;
  authorizedZones: string[];
  status: string;
  issuedAt: string | null;
  expiresAt: string | null;
  producedAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
  observations: string | null;
  photoFileId: string | null;
  photoSource: string | null;
  photoCapturedAt: string | null;
  photoReusedFromCredentialId: string | null;
  cardMaterialData: string | null;
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
      cardCode: c.cardCode,
      requestId: c.requestId,
      credentialType: c.credentialType,
      subjectUserId: c.subjectUserId,
      holderName: c.holderName,
      authorizedZones: c.authorizedZones ?? [],
      status: c.status,
      issuedAt: c.issuedAt ? c.issuedAt.toISOString() : null,
      expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
      producedAt: c.producedAt ? c.producedAt.toISOString() : null,
      readyAt: c.readyAt ? c.readyAt.toISOString() : null,
      deliveredAt: c.deliveredAt ? c.deliveredAt.toISOString() : null,
      observations: c.observations,
      photoFileId: c.photoFileId,
      photoSource: c.photoSource,
      photoCapturedAt: c.photoCapturedAt
        ? c.photoCapturedAt.toISOString()
        : null,
      photoReusedFromCredentialId: c.photoReusedFromCredentialId,
      cardMaterialData: c.cardMaterialData,
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

export interface CustodyResponse {
  id: string;
  credentialId: string;
  subjectUserId: string;
  holderName: string | null;
  documentType: string;
  documentIdentifier: string;
  temporaryPermitRef: string | null;
  receivedByUserId: string;
  depositTime: string;
  expectedReturnAt: string | null;
  depositNotes: string | null;
  returnTime: string | null;
  returnedByUserId: string | null;
  returnReceivedBy: string | null;
  returnCondition: string | null;
  returnNotes: string | null;
  status: 'ACTIVE' | 'RETURNED' | 'OVERDUE';
  createdAt: string;
  updatedAt: string;
}

export class CustodyPresenter {
  static toResponse(
    record: CustodyRecordInfo,
    status: 'ACTIVE' | 'RETURNED' | 'OVERDUE',
  ): CustodyResponse {
    return {
      id: record.id,
      credentialId: record.credentialId,
      subjectUserId: record.subjectUserId,
      holderName: record.holderName,
      documentType: record.documentType,
      documentIdentifier: record.documentIdentifier,
      temporaryPermitRef: record.temporaryPermitRef,
      receivedByUserId: record.receivedByUserId,
      depositTime: record.depositTime.toISOString(),
      expectedReturnAt: record.expectedReturnAt
        ? record.expectedReturnAt.toISOString()
        : null,
      depositNotes: record.depositNotes,
      returnTime: record.returnTime ? record.returnTime.toISOString() : null,
      returnedByUserId: record.returnedByUserId,
      returnReceivedBy: record.returnReceivedBy,
      returnCondition: record.returnCondition,
      returnNotes: record.returnNotes,
      status,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
