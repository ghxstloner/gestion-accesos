import type {
  Prisma,
  Company as PrismaCompany,
} from '../../../../../generated/prisma/client';
import { Company } from '../../../domain/entities/company.entity';

type CompanyRow = PrismaCompany;

export class CompanyMapper {
  static toDomain(row: CompanyRow): Company {
    return Company.reconstitute({
      id: row.id,
      legalName: row.legalName,
      tradeName: row.tradeName,
      taxIdentifier: row.taxIdentifier,
      email: row.email,
      phone: row.phone,
      address: row.address,
      logoUrl: row.logoUrl,
      mainContactName: row.mainContactName,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  static toPersistence(company: Company): Prisma.CompanyUncheckedCreateInput {
    const props = company.toProps();
    return {
      id: props.id,
      legalName: props.legalName,
      tradeName: props.tradeName,
      taxIdentifier: props.taxIdentifier,
      email: props.email,
      phone: props.phone,
      address: props.address,
      logoUrl: props.logoUrl,
      mainContactName: props.mainContactName,
      status: props.status,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    };
  }
}
