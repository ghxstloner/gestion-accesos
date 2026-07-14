import { randomUUID } from 'node:crypto';
import { Credential } from '../../../domain/entities/credential.entity';
import type { CredentialType } from '../../../domain/credential.constants';
import type {
  CredentialEventRecord,
  CredentialRecord,
} from '../../../domain/repositories/credential.repository.port';

export class CredentialMapper {
  static toRecord(c: Credential): CredentialRecord {
    return c.toProps();
  }

  static toDomain(r: CredentialRecord): Credential {
    return Credential.reconstitute({
      id: r.id,
      credentialNumber: r.credentialNumber,
      requestId: r.requestId,
      credentialType: r.credentialType as CredentialType,
      personId: r.personId,
      status: r.status as ReturnType<Credential['toProps']>['status'],
      issuedAt: r.issuedAt,
      expiresAt: r.expiresAt,
      producedAt: r.producedAt,
      readyAt: r.readyAt,
      deliveredAt: r.deliveredAt,
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
