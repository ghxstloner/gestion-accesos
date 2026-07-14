import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../../generated/prisma/client.js';
import { PrismaService } from '../../../../../common/infrastructure/prisma/prisma.service';
import { Person, PersonProps } from '../../../domain/entities/person.entity';
import {
  PersonListParams,
  PersonRepositoryPort,
} from '../../../domain/repositories/person.repository.port';

type Row = Prisma.PersonGetPayload<{}>;

@Injectable()
export class PersonMapper {
  toDomain(row: Row): Person {
    return Person.reconstitute(this.toProps(row));
  }

  toProps(row: Row): PersonProps {
    return {
      id: row.id,
      companyId: row.companyId,
      firstName: row.firstName,
      middleName: row.middleName,
      firstSurname: row.firstSurname,
      secondSurname: row.secondSurname,
      marriedSurname: row.marriedSurname,
      identificationTypeId: row.identificationTypeId,
      identificationNumber: row.identificationNumber,
      socialSecurityNumber: row.socialSecurityNumber,
      birthDate: row.birthDate,
      gender: row.gender,
      maritalStatus: row.maritalStatus,
      nationality: row.nationality,
      bloodType: row.bloodType,
      phone: row.phone,
      mobile: row.mobile,
      email: row.email,
      residentialAddress: row.residentialAddress,
      physicalCondition: row.physicalCondition,
      department: row.department,
      position: row.position,
      yearsOfService: row.yearsOfService,
      previouslyWorkedAtAirport: row.previouslyWorkedAtAirport,
      previousCompanyName: row.previousCompanyName,
      previouslyHadCredential: row.previouslyHadCredential,
      reusePreviousPhoto: row.reusePreviousPhoto,
      status: row.status,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  toPersistence(person: Person): Prisma.PersonUncheckedCreateInput {
    const p = person.toProps();
    return {
      id: p.id,
      companyId: p.companyId,
      firstName: p.firstName,
      middleName: p.middleName,
      firstSurname: p.firstSurname,
      secondSurname: p.secondSurname,
      marriedSurname: p.marriedSurname,
      identificationTypeId: p.identificationTypeId,
      identificationNumber: p.identificationNumber,
      socialSecurityNumber: p.socialSecurityNumber,
      birthDate: p.birthDate,
      gender: p.gender,
      maritalStatus: p.maritalStatus,
      nationality: p.nationality,
      bloodType: p.bloodType,
      phone: p.phone,
      mobile: p.mobile,
      email: p.email,
      residentialAddress: p.residentialAddress,
      physicalCondition: p.physicalCondition,
      department: p.department,
      position: p.position,
      yearsOfService: p.yearsOfService,
      previouslyWorkedAtAirport: p.previouslyWorkedAtAirport,
      previousCompanyName: p.previousCompanyName,
      previouslyHadCredential: p.previouslyHadCredential,
      reusePreviousPhoto: p.reusePreviousPhoto,
      status: p.status,
      createdBy: p.createdBy,
    };
  }

  toUpdatePayload(person: Person): Prisma.PersonUncheckedUpdateInput {
    const p = person.toProps();
    return {
      firstName: p.firstName,
      middleName: p.middleName,
      firstSurname: p.firstSurname,
      secondSurname: p.secondSurname,
      marriedSurname: p.marriedSurname,
      identificationTypeId: p.identificationTypeId,
      identificationNumber: p.identificationNumber,
      socialSecurityNumber: p.socialSecurityNumber,
      birthDate: p.birthDate,
      gender: p.gender,
      maritalStatus: p.maritalStatus,
      nationality: p.nationality,
      bloodType: p.bloodType,
      phone: p.phone,
      mobile: p.mobile,
      email: p.email,
      residentialAddress: p.residentialAddress,
      physicalCondition: p.physicalCondition,
      department: p.department,
      position: p.position,
      yearsOfService: p.yearsOfService,
      previouslyWorkedAtAirport: p.previouslyWorkedAtAirport,
      previousCompanyName: p.previousCompanyName,
      previouslyHadCredential: p.previouslyHadCredential,
      reusePreviousPhoto: p.reusePreviousPhoto,
      status: p.status,
    };
  }
}

@Injectable()
export class PersonPrismaRepository implements PersonRepositoryPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: PersonMapper,
  ) {}

  async findById(id: string): Promise<Person | null> {
    const row = await this.prisma.person.findUnique({ where: { id } });
    return row ? this.mapper.toDomain(row) : null;
  }

  async findByCompanyAndIdentification(
    companyId: string,
    identificationTypeId: string,
    identificationNumber: string,
  ): Promise<Person | null> {
    const row = await this.prisma.person.findUnique({
      where: {
        identificationTypeId_identificationNumber: {
          identificationTypeId,
          identificationNumber,
        },
      },
    });
    if (!row) return null;
    if (row.companyId !== companyId) return null;
    return this.mapper.toDomain(row);
  }

  async findAll(
    params: PersonListParams,
  ): Promise<{ items: Person[]; total: number }> {
    const where: Prisma.PersonWhereInput = {};
    if (params.companyId) where.companyId = params.companyId;
    if (params.status) where.status = params.status as any;
    if (params.identificationTypeId)
      where.identificationTypeId = params.identificationTypeId;
    if (params.search) {
      const s = params.search;
      where.OR = [
        { firstName: { contains: s } },
        { middleName: { contains: s } },
        { firstSurname: { contains: s } },
        { secondSurname: { contains: s } },
        { identificationNumber: { contains: s } },
      ];
    }
    const offset = params.offset ?? 0;
    const limit = params.limit ?? 50;

    const [rows, total] = await Promise.all([
      this.prisma.person.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: [{ firstSurname: 'asc' }, { firstName: 'asc' }],
      }),
      this.prisma.person.count({ where }),
    ]);
    return { items: rows.map((r) => this.mapper.toDomain(r)), total };
  }

  async save(person: Person): Promise<Person> {
    const createData = this.mapper.toPersistence(person);
    const updateData = this.mapper.toUpdatePayload(person);
    const row = await this.prisma.person.upsert({
      where: { id: person.id },
      create: createData,
      update: updateData,
    });
    return this.mapper.toDomain(row);
  }

  async countActiveRelations(id: string): Promise<number> {
    // Authorized signers referencing this person.
    const count = await this.prisma.companyAuthorizedSigner.count({
      where: { personId: id },
    });
    return count;
  }

  async existsInRequestLinks(id: string): Promise<boolean> {
    const link = await this.prisma.requestPerson.findFirst({
      where: { personId: id },
      select: { id: true },
    });
    return !!link;
  }
}
