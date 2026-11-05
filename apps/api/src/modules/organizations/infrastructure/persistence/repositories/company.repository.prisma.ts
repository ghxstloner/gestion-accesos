import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../common/infrastructure/prisma/prisma.service';
import { Company } from '../../../domain/entities/company.entity';
import { CompanyRepositoryPort } from '../../../domain/repositories/company.repository.port';
import { CompanyMapper } from '../mappers/company.mapper';

@Injectable()
export class CompanyPrismaRepository implements CompanyRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Company | null> {
    const row = await this.prisma.company.findUnique({ where: { id } });
    return row ? CompanyMapper.toDomain(row) : null;
  }

  async findByTaxIdentifier(taxIdentifier: string): Promise<Company | null> {
    const row = await this.prisma.company.findUnique({
      where: { taxIdentifier },
    });
    return row ? CompanyMapper.toDomain(row) : null;
  }

  async findByExternalClientId(
    externalClientId: string,
  ): Promise<Company | null> {
    const row = await this.prisma.company.findUnique({
      where: { externalClientId },
    });
    return row ? CompanyMapper.toDomain(row) : null;
  }

  async findLatestExternalSync(source: string): Promise<Date | null> {
    const row = await this.prisma.company.findFirst({
      where: { externalSource: source, externalSyncedAt: { not: null } },
      orderBy: { externalSyncedAt: 'desc' },
      select: { externalSyncedAt: true },
    });
    return row?.externalSyncedAt ?? null;
  }

  async findAll(params?: {
    search?: string;
    status?: string;
    offset?: number;
    limit?: number;
  }): Promise<{ items: Company[]; total: number }> {
    const where: Record<string, unknown> = {};
    if (params?.status) where.status = params.status;
    if (params?.search) {
      where.OR = [
        { legalName: { contains: params.search } },
        { tradeName: { contains: params.search } },
        { taxIdentifier: { contains: params.search } },
        { externalClientId: { contains: params.search } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        skip: params?.offset ?? 0,
        take: params?.limit ?? 50,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.company.count({ where }),
    ]);

    return {
      items: rows.map((row) => CompanyMapper.toDomain(row)),
      total,
    };
  }

  async save(company: Company): Promise<Company> {
    const data = CompanyMapper.toPersistence(company);
    const row = await this.prisma.company.upsert({
      where: { id: company.id },
      create: data,
      update: {
        legalName: data.legalName,
        tradeName: data.tradeName,
        taxIdentifier: data.taxIdentifier,
        email: data.email,
        phone: data.phone,
        address: data.address,
        logoUrl: data.logoUrl,
        mainContactName: data.mainContactName,
        dv: data.dv,
        externalClientId: data.externalClientId,
        externalSource: data.externalSource,
        externalSyncedAt: data.externalSyncedAt,
        status: data.status,
        updatedAt: data.updatedAt,
      },
    });
    return CompanyMapper.toDomain(row);
  }
}
