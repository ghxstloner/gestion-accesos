import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '../../../../../generated/prisma/client';
import { PrismaService } from '../../../../../common/infrastructure/prisma/prisma.service';
import type { Credential } from '../../../domain/entities/credential.entity';
import {
  CREDENTIAL_REPOSITORY,
  type CredentialEventRecord,
  type CredentialListFilters,
  type CredentialListPage,
  type CredentialRecord,
  type CredentialRepositoryPort,
  type DeliveryRecordInfo,
} from '../../../domain/repositories/credential.repository.port';
import { CREDENTIAL_PREFIX } from '../../../domain/credential.constants';

@Injectable()
export class CredentialPrismaRepository implements CredentialRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  private toRecord(row: {
    id: string;
    credentialNumber: string;
    requestId: string;
    credentialType: string;
    subjectUserId: string | null;
    status: string;
    issuedAt: Date | null;
    expiresAt: Date | null;
    producedAt: Date | null;
    readyAt: Date | null;
    deliveredAt: Date | null;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
  }): CredentialRecord {
    return { ...row };
  }

  async findById(id: string): Promise<CredentialRecord | null> {
    const row = await this.prisma.credential.findUnique({ where: { id } });
    return row ? this.toRecord(row) : null;
  }

  async findByRequestId(requestId: string): Promise<CredentialRecord | null> {
    const row = await this.prisma.credential.findUnique({
      where: { requestId },
    });
    return row ? this.toRecord(row) : null;
  }

  async findByCredentialNumber(
    credentialNumber: string,
  ): Promise<CredentialRecord | null> {
    const row = await this.prisma.credential.findUnique({
      where: { credentialNumber },
    });
    return row ? this.toRecord(row) : null;
  }

  async list(inputs: {
    filters: CredentialListFilters;
    page: number;
    pageSize: number;
  }): Promise<CredentialListPage> {
    const where: Prisma.CredentialWhereInput = {};
    if (inputs.filters.status)
      where.status = inputs.filters
        .status as Prisma.CredentialWhereInput['status'];
    if (inputs.filters.credentialType)
      where.credentialType = inputs.filters
        .credentialType as Prisma.CredentialWhereInput['credentialType'];
    if (inputs.filters.requestId) where.requestId = inputs.filters.requestId;
    if (inputs.filters.subjectUserId)
      where.subjectUserId = inputs.filters.subjectUserId;
    if (inputs.filters.search) {
      where.credentialNumber = { contains: inputs.filters.search };
    }
    const [items, total] = await Promise.all([
      this.prisma.credential.findMany({
        where,
        skip: (inputs.page - 1) * inputs.pageSize,
        take: inputs.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.credential.count({ where }),
    ]);
    return {
      items: items.map((r) => this.toRecord(r)),
      total,
      page: inputs.page,
      pageSize: inputs.pageSize,
    };
  }

  async save(record: CredentialRecord): Promise<void> {
    const data: Prisma.CredentialUncheckedCreateInput = {
      id: record.id,
      credentialNumber: record.credentialNumber,
      requestId: record.requestId,
      credentialType:
        record.credentialType as Prisma.CredentialUncheckedCreateInput['credentialType'],
      subjectUserId: record.subjectUserId,
      status: record.status as Prisma.CredentialUncheckedCreateInput['status'],
      issuedAt: record.issuedAt,
      expiresAt: record.expiresAt,
      producedAt: record.producedAt,
      readyAt: record.readyAt,
      deliveredAt: record.deliveredAt,
      createdBy: record.createdBy,
    };
    await this.prisma.credential.upsert({
      where: { id: record.id },
      create: data,
      update: {
        status: data.status,
        expiresAt: data.expiresAt,
        producedAt: data.producedAt,
        readyAt: data.readyAt,
        deliveredAt: data.deliveredAt,
      },
    });
  }

  async countByPrefixThisYear(prefix: string): Promise<number> {
    const year = new Date().getFullYear();
    const pattern = `${prefix}-${year}-`;
    return this.prisma.credential.count({
      where: { credentialNumber: { startsWith: pattern } },
    });
  }

  async listEvents(credentialId: string): Promise<CredentialEventRecord[]> {
    const rows = await this.prisma.credentialEvent.findMany({
      where: { credentialId },
      orderBy: { occurredAt: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      credentialId: r.credentialId,
      eventType: r.eventType,
      fromStatus: r.fromStatus,
      toStatus: r.toStatus,
      actorUserId: r.actorUserId,
      comment: r.comment,
      occurredAt: r.occurredAt,
    }));
  }

  async saveEvent(event: CredentialEventRecord): Promise<void> {
    const data: Prisma.CredentialEventUncheckedCreateInput = {
      id: event.id,
      credentialId: event.credentialId,
      eventType:
        event.eventType as Prisma.CredentialEventUncheckedCreateInput['eventType'],
      fromStatus:
        event.fromStatus as Prisma.CredentialEventUncheckedCreateInput['fromStatus'],
      toStatus:
        event.toStatus as Prisma.CredentialEventUncheckedCreateInput['toStatus'],
      actorUserId: event.actorUserId,
      comment: event.comment,
    };
    await this.prisma.credentialEvent.create({ data });
  }

  async findDeliveryByCredential(
    credentialId: string,
  ): Promise<DeliveryRecordInfo | null> {
    const row = await this.prisma.deliveryRecord.findUnique({
      where: { credentialId },
    });
    if (!row) return null;
    return {
      id: row.id,
      credentialId: row.credentialId,
      deliveredByUserId: row.deliveredByUserId,
      receivedByName: row.receivedByName,
      receivedByIdentification: row.receivedByIdentification,
      deliveredAt: row.deliveredAt,
      observations: row.observations,
      correctedAt: row.correctedAt,
      correctionReason: row.correctionReason,
    };
  }

  async saveDelivery(record: DeliveryRecordInfo): Promise<void> {
    const data: Prisma.DeliveryRecordUncheckedCreateInput = {
      id: record.id,
      credentialId: record.credentialId,
      deliveredByUserId: record.deliveredByUserId,
      receivedByName: record.receivedByName,
      receivedByIdentification: record.receivedByIdentification,
      deliveredAt: record.deliveredAt,
      observations: record.observations,
      correctedAt: record.correctedAt,
      correctionReason: record.correctionReason,
    };
    await this.prisma.deliveryRecord.upsert({
      where: { credentialId: record.credentialId },
      create: data,
      update: {
        deliveredByUserId: data.deliveredByUserId,
        receivedByName: data.receivedByName,
        receivedByIdentification: data.receivedByIdentification,
        deliveredAt: data.deliveredAt,
        observations: data.observations,
      },
    });
  }

  async markDeliveryCorrected(
    credentialId: string,
    reason: string,
  ): Promise<void> {
    await this.prisma.deliveryRecord.update({
      where: { credentialId },
      data: { correctedAt: new Date(), correctionReason: reason },
    });
  }

  // Keep eslint happy
  /** @internal */
  static _prefixes(): typeof CREDENTIAL_PREFIX {
    return CREDENTIAL_PREFIX;
  }
}

export const CREDENTIAL_REPOSITORY_PROVIDER = {
  provide: CREDENTIAL_REPOSITORY,
  useClass: CredentialPrismaRepository,
};

export type { Credential };
export { randomUUID as _randomUUID };
