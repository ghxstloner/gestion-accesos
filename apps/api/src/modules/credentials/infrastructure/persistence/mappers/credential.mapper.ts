import { randomUUID } from 'node:crypto';
import {
  Credential,
  type PhotoInfo,
  type PhotoSource,
} from '../../../domain/entities/credential.entity';
import type { CredentialType } from '../../../domain/credential.constants';
import type {
  CredentialEventRecord,
  CredentialRecord,
} from '../../../domain/repositories/credential.repository.port';

export class CredentialMapper {
  static toRecord(c: Credential): CredentialRecord {
    const props = c.toProps();
    return {
      id: props.id,
      credentialNumber: props.credentialNumber,
      cardCode: props.cardCode,
      requestId: props.requestId,
      replacesCredentialId: props.replacesCredentialId,
      credentialType: props.credentialType,
      subjectUserId: props.subjectUserId,
      holderName: props.holderName,
      authorizedZones: props.authorizedZones,
      status: props.status,
      issuedAt: props.issuedAt,
      expiresAt: props.expiresAt,
      producedAt: props.producedAt,
      readyAt: props.readyAt,
      deliveredAt: props.deliveredAt,
      observations: props.observations,
      photoFileId: props.photo ? props.photo.fileId : props.photoFileId,
      photoSource: props.photo ? props.photo.source : props.photoSource,
      photoCapturedAt: props.photo
        ? props.photo.capturedAt
        : props.photoCapturedAt,
      photoReusedFromCredentialId: props.photo
        ? props.photo.reusedFromCredentialId
        : props.photoReusedFromCredentialId,
      cardMaterialData: props.cardMaterialData,
      createdBy: props.createdBy,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    };
  }

  static toDomain(r: CredentialRecord): Credential {
    const photo: PhotoInfo | null = r.photoFileId
      ? {
          fileId: r.photoFileId,
          source: (r.photoSource ?? 'UPLOADED') as PhotoSource,
          capturedAt: r.photoCapturedAt ?? new Date(),
          reusedFromCredentialId: r.photoReusedFromCredentialId,
        }
      : null;
    return Credential.reconstitute({
      id: r.id,
      credentialNumber: r.credentialNumber,
      cardCode: r.cardCode,
      requestId: r.requestId,
      replacesCredentialId: r.replacesCredentialId,
      credentialType: r.credentialType as CredentialType,
      subjectUserId: r.subjectUserId,
      holderName: r.holderName,
      authorizedZones: r.authorizedZones,
      status: r.status as ReturnType<Credential['toProps']>['status'],
      issuedAt: r.issuedAt,
      expiresAt: r.expiresAt,
      producedAt: r.producedAt,
      readyAt: r.readyAt,
      deliveredAt: r.deliveredAt,
      observations: r.observations,
      photo,
      photoFileId: r.photoFileId,
      photoSource: r.photoSource,
      photoCapturedAt: r.photoCapturedAt,
      photoReusedFromCredentialId: r.photoReusedFromCredentialId,
      cardMaterialData: r.cardMaterialData,
      createdBy: r.createdBy,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    });
  }

  static toEventRecord(input: {
    credentialId: string;
    eventType: CredentialEventRecord['eventType'];
    fromStatus: string | null;
    toStatus: string;
    actorUserId: string | null;
    comment?: string | null;
  }): CredentialEventRecord {
    return {
      id: randomUUID(),
      credentialId: input.credentialId,
      eventType: input.eventType,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      actorUserId: input.actorUserId,
      comment: input.comment ?? null,
      occurredAt: new Date(),
    };
  }
}
