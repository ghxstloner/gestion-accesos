import { Injectable } from '@nestjs/common';
import {
  Prisma,
  type AuthorizedSignerStatus as PrismaAuthorizedSignerStatus,
} from '../../../../../generated/prisma/client.js';
import { PrismaService } from '../../../../../common/infrastructure/prisma/prisma.service';
import { CompanyAuthorizedSigner } from '../../../domain/entities/authorized-signer.entity';
import {
  AuthorizedSignerRepositoryPort,
  SignerListParams,
} from '../../../domain/repositories/authorized-signer.repository.port';

type Row = Prisma.CompanyAuthorizedSignerGetPayload<Record<string, never>>;

@Injectable()
export class AuthorizedSignerMapper {
  toDomain(row: Row): CompanyAuthorizedSigner {
    return CompanyAuthorizedSigner.reconstitute({
      id: row.id,
      companyId: row.companyId,
      signerUserId: row.signerUserId,
      position: row.position,
      validFrom: row.validFrom,
      validUntil: row.validUntil,
      authorizationDocumentId: row.authorizationDocumentId,
      signatureFileId: row.signatureFileId,
      status: row.status,
      revokedAt: row.revokedAt,
      revokedBy: row.revokedBy,
      revocationReason: row.revocationReason,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  toPersistence(
    s: CompanyAuthorizedSigner,
  ): Prisma.CompanyAuthorizedSignerUncheckedCreateInput {
    const p = s.toProps();
    return {
      id: p.id,
      companyId: p.companyId,
      signerUserId: p.signerUserId,
      position: p.position,
      validFrom: p.validFrom,
      validUntil: p.validUntil,
      authorizationDocumentId: p.authorizationDocumentId,
      signatureFileId: p.signatureFileId,
      status: p.status,
      revokedAt: p.revokedAt,
      revokedBy: p.revokedBy,
      revocationReason: p.revocationReason,
    };
  }

  toUpdatePayload(
    s: CompanyAuthorizedSigner,
  ): Prisma.CompanyAuthorizedSignerUncheckedUpdateInput {
    const p = s.toProps();
    return {
      position: p.position,
      validFrom: p.validFrom,
      validUntil: p.validUntil,
      authorizationDocumentId: p.authorizationDocumentId,
      signatureFileId: p.signatureFileId,
      status: p.status,
      revokedAt: p.revokedAt,
      revokedBy: p.revokedBy,
      revocationReason: p.revocationReason,
    };
  }
}

@Injectable()
export class AuthorizedSignerPrismaRepository implements AuthorizedSignerRepositoryPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: AuthorizedSignerMapper,
  ) {}

  async findById(id: string): Promise<CompanyAuthorizedSigner | null> {
    const row = await this.prisma.companyAuthorizedSigner.findUnique({
      where: { id },
    });
    return row ? this.mapper.toDomain(row) : null;
  }

  async findAll(
    params: SignerListParams,
  ): Promise<{ items: CompanyAuthorizedSigner[]; total: number }> {
    const where: Prisma.CompanyAuthorizedSignerWhereInput = {};
    if (params.companyId) where.companyId = params.companyId;
    if (params.signerUserId) where.signerUserId = params.signerUserId;
    if (params.status) {
      where.status = params.status as PrismaAuthorizedSignerStatus;
    }
    const offset = params.offset ?? 0;
    const limit = params.limit ?? 50;
    const [rows, total] = await Promise.all([
      this.prisma.companyAuthorizedSigner.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: [{ createdAt: 'desc' }],
      }),
      this.prisma.companyAuthorizedSigner.count({ where }),
    ]);
    return { items: rows.map((r) => this.mapper.toDomain(r)), total };
  }

  async save(
    signer: CompanyAuthorizedSigner,
  ): Promise<CompanyAuthorizedSigner> {
    const row = await this.prisma.companyAuthorizedSigner.upsert({
      where: { id: signer.id },
      create: this.mapper.toPersistence(signer),
      update: this.mapper.toUpdatePayload(signer),
    });
    return this.mapper.toDomain(row);
  }

  async existsForSignerUserActive(
    signerUserId: string,
    excludeId?: string,
  ): Promise<boolean> {
    const where: Prisma.CompanyAuthorizedSignerWhereInput = {
      signerUserId,
      status: 'ACTIVE',
    };
    if (excludeId) where.id = { not: excludeId };
    const count = await this.prisma.companyAuthorizedSigner.count({ where });
    return count > 0;
  }
}
