import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { CredentialStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../../common/infrastructure/prisma/prisma.service';
import type { Credential } from '../../../domain/entities/credential.entity';
import {
  CREDENTIAL_REPOSITORY,
  type CredentialEventRecord,
  type CredentialListFilters,
  type CredentialListPage,
  type CredentialRecord,
  type CredentialRepositoryPort,
  type CustodyListFilters,
  type CustodyRecordInfo,
  type DeliveryRecordInfo,
  type FileMetadataRecord,
} from '../../../domain/repositories/credential.repository.port';
import { CREDENTIAL_PREFIX } from '../../../domain/credential.constants';

const ACTIVE_CREDENTIAL_STATUSES = new Set<CredentialStatus>([
  'PENDING_PRODUCTION',
  'IN_PRODUCTION',
  'READY_FOR_DELIVERY',
  'DELIVERED',
  'SUSPENDED',
]);

@Injectable()
export class CredentialPrismaRepository implements CredentialRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  private toRecord(row: {
    id: string;
    credentialNumber: string;
    cardCode: string | null;
    requestId: string;
    credentialType: string;
    subjectUserId: string | null;
    holderName: string | null;
    authorizedZones: Prisma.JsonValue | null;
    status: string;
    issuedAt: Date | null;
    expiresAt: Date | null;
    producedAt: Date | null;
    readyAt: Date | null;
    deliveredAt: Date | null;
    observations: string | null;
    photoFileId: string | null;
    photoSource: string | null;
    photoCapturedAt: Date | null;
    photoReusedFromCredentialId: string | null;
    cardMaterialData: string | null;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
  }): CredentialRecord {
    const zones = Array.isArray(row.authorizedZones)
      ? (row.authorizedZones as unknown[]).filter(
          (v): v is string => typeof v === 'string',
        )
      : null;
    return {
      id: row.id,
      credentialNumber: row.credentialNumber,
      cardCode: row.cardCode,
      requestId: row.requestId,
      credentialType: row.credentialType,
      subjectUserId: row.subjectUserId,
      holderName: row.holderName,
      authorizedZones: zones,
      status: row.status,
      issuedAt: row.issuedAt,
      expiresAt: row.expiresAt,
      producedAt: row.producedAt,
      readyAt: row.readyAt,
      deliveredAt: row.deliveredAt,
      observations: row.observations,
      photoFileId: row.photoFileId,
      photoSource: row.photoSource,
      photoCapturedAt: row.photoCapturedAt,
      photoReusedFromCredentialId: row.photoReusedFromCredentialId,
      cardMaterialData: row.cardMaterialData,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
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

  async findActiveByCardCode(
    cardCode: string,
  ): Promise<CredentialRecord | null> {
    const row = await this.prisma.credential.findFirst({
      where: {
        cardCode,
        status: { in: [...ACTIVE_CREDENTIAL_STATUSES] },
      },
      orderBy: { createdAt: 'desc' },
    });
    return row ? this.toRecord(row) : null;
  }

  async findLatestWithPhotoForSubject(
    subjectUserId: string,
  ): Promise<CredentialRecord | null> {
    if (!subjectUserId) return null;
    const row = await this.prisma.credential.findFirst({
      where: {
        subjectUserId,
        photoFileId: { not: null },
      },
      orderBy: { createdAt: 'desc' },
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
    if (inputs.filters.cardCode) where.cardCode = inputs.filters.cardCode;
    if (inputs.filters.credentialNumber)
      where.credentialNumber = inputs.filters.credentialNumber;
    if (inputs.filters.search) {
      where.OR = [
        { credentialNumber: { contains: inputs.filters.search } },
        { cardCode: { contains: inputs.filters.search } },
        { holderName: { contains: inputs.filters.search } },
      ];
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
      cardCode: record.cardCode,
      requestId: record.requestId,
      credentialType:
        record.credentialType as Prisma.CredentialUncheckedCreateInput['credentialType'],
      subjectUserId: record.subjectUserId,
      holderName: record.holderName,
      authorizedZones: record.authorizedZones ?? [],
      status: record.status as Prisma.CredentialUncheckedCreateInput['status'],
      issuedAt: record.issuedAt,
      expiresAt: record.expiresAt,
      producedAt: record.producedAt,
      readyAt: record.readyAt,
      deliveredAt: record.deliveredAt,
      observations: record.observations,
      photoFileId: record.photoFileId,
      photoSource: record.photoSource,
      photoCapturedAt: record.photoCapturedAt,
      photoReusedFromCredentialId: record.photoReusedFromCredentialId,
      cardMaterialData: record.cardMaterialData,
      createdBy: record.createdBy,
    };
    await this.prisma.credential.upsert({
      where: { id: record.id },
      create: data,
      update: {
        cardCode: data.cardCode,
        holderName: data.holderName,
        authorizedZones: data.authorizedZones,
        status: data.status,
        expiresAt: data.expiresAt,
        producedAt: data.producedAt,
        readyAt: data.readyAt,
        deliveredAt: data.deliveredAt,
        observations: data.observations,
        photoFileId: data.photoFileId,
        photoSource: data.photoSource,
        photoCapturedAt: data.photoCapturedAt,
        photoReusedFromCredentialId: data.photoReusedFromCredentialId,
        cardMaterialData: data.cardMaterialData,
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

  // ── Custody ──

  async findCustody(id: string): Promise<CustodyRecordInfo | null> {
    const row = await this.prisma.custodyRecord.findUnique({ where: { id } });
    return row ? this.toCustody(row) : null;
  }

  async findCustodyByCredential(
    credentialId: string,
  ): Promise<CustodyRecordInfo | null> {
    const row = await this.prisma.custodyRecord.findUnique({
      where: { credentialId },
    });
    return row ? this.toCustody(row) : null;
  }

  async listCustody(inputs: {
    filters: CustodyListFilters;
    page: number;
    pageSize: number;
  }): Promise<{ items: CustodyRecordInfo[]; total: number }> {
    const where: Prisma.CustodyRecordWhereInput = {};
    const now = new Date();
    if (inputs.filters.subjectUserId)
      where.subjectUserId = inputs.filters.subjectUserId;
    if (inputs.filters.status === 'RETURNED') {
      where.returnTime = { not: null };
    } else if (inputs.filters.status === 'ACTIVE') {
      where.returnTime = null;
    } else if (inputs.filters.status === 'OVERDUE') {
      where.returnTime = null;
      where.expectedReturnAt = { lt: now };
    }
    if (inputs.filters.search) {
      where.OR = [
        { holderName: { contains: inputs.filters.search } },
        { documentIdentifier: { contains: inputs.filters.search } },
        { temporaryPermitRef: { contains: inputs.filters.search } },
      ];
    }
    const [rows, total] = await Promise.all([
      this.prisma.custodyRecord.findMany({
        where,
        skip: (inputs.page - 1) * inputs.pageSize,
        take: inputs.pageSize,
        orderBy: { depositTime: 'desc' },
      }),
      this.prisma.custodyRecord.count({ where }),
    ]);
    return { items: rows.map((r) => this.toCustody(r)), total };
  }

  async saveCustody(record: CustodyRecordInfo): Promise<void> {
    const data: Prisma.CustodyRecordUncheckedCreateInput = {
      id: record.id,
      credentialId: record.credentialId,
      subjectUserId: record.subjectUserId,
      holderName: record.holderName,
      documentType: record.documentType,
      documentIdentifier: record.documentIdentifier,
      temporaryPermitRef: record.temporaryPermitRef,
      receivedByUserId: record.receivedByUserId,
      depositTime: record.depositTime,
      expectedReturnAt: record.expectedReturnAt,
      depositNotes: record.depositNotes,
      returnTime: record.returnTime,
      returnedByUserId: record.returnedByUserId,
      returnReceivedBy: record.returnReceivedBy,
      returnCondition: record.returnCondition,
      returnNotes: record.returnNotes,
    };
    await this.prisma.custodyRecord.upsert({
      where: { id: record.id },
      create: data,
      update: {
        holderName: data.holderName,
        documentIdentifier: data.documentIdentifier,
        temporaryPermitRef: data.temporaryPermitRef,
        expectedReturnAt: data.expectedReturnAt,
        depositNotes: data.depositNotes,
        returnTime: data.returnTime,
        returnedByUserId: data.returnedByUserId,
        returnReceivedBy: data.returnReceivedBy,
        returnCondition: data.returnCondition,
        returnNotes: data.returnNotes,
      },
    });
  }

  private toCustody(row: {
    id: string;
    credentialId: string;
    subjectUserId: string;
    holderName: string | null;
    documentType: string;
    documentIdentifier: string;
    temporaryPermitRef: string | null;
    receivedByUserId: string;
    depositTime: Date;
    expectedReturnAt: Date | null;
    depositNotes: string | null;
    returnTime: Date | null;
    returnedByUserId: string | null;
    returnReceivedBy: string | null;
    returnCondition: string | null;
    returnNotes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): CustodyRecordInfo {
    return { ...row };
  }

  // ── File metadata helpers (used by photo capture/reuse flows) ──

  async saveFileMetadata(record: FileMetadataRecord): Promise<void> {
    const data: Prisma.FileMetadataUncheckedCreateInput = {
      id: record.id,
      storageKey: record.storageKey,
      originalFilename: record.originalFilename,
      storedFilename: record.storedFilename,
      mimeType: record.mimeType,
      size: BigInt(record.size),
      sha256: record.sha256,
    };
    await this.prisma.fileMetadata.upsert({
      where: { id: record.id },
      create: data,
      update: {
        originalFilename: data.originalFilename,
        storedFilename: data.storedFilename,
        mimeType: data.mimeType,
        size: data.size,
        sha256: data.sha256,
      },
    });
  }

  async findFileMetadata(id: string): Promise<FileMetadataRecord | null> {
    const row = await this.prisma.fileMetadata.findUnique({ where: { id } });
    if (!row) return null;
    return {
      id: row.id,
      storageKey: row.storageKey,
      originalFilename: row.originalFilename,
      storedFilename: row.storedFilename,
      mimeType: row.mimeType,
      size: Number(row.size),
      sha256: row.sha256,
      createdAt: row.createdAt,
    };
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
