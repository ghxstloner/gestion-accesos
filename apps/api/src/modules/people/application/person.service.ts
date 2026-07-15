import { Injectable, Inject } from '@nestjs/common';
import {
  PERSON_REPOSITORY,
  PersonRepositoryPort,
} from '../domain/repositories/person.repository.port';
import { Person } from '../domain/entities/person.entity';
import { CatalogService } from '../../catalogs/application/catalog.service';
import {
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../../common/domain/errors/domain-error';
import { canReadAcrossCompanies } from '../../../common/domain/access-scope';
import { AuthenticatedUser } from '../../../common/presentation/decorators/authenticated-user';
import {
  CreatePersonDto,
  PersonResponseDto,
  UpdatePersonDto,
} from '../presentation/dto/person.dto';
import { PersonPresenter } from '../presentation/presenters/person.presenter';

const VALID_STATUSES: Record<string, 'ACTIVE' | 'INACTIVE'> = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
};

@Injectable()
export class PersonService {
  constructor(
    @Inject(PERSON_REPOSITORY)
    private readonly personRepo: PersonRepositoryPort,
    private readonly catalogs: CatalogService,
  ) {}

  async create(
    dto: CreatePersonDto,
    actor: AuthenticatedUser,
  ): Promise<PersonResponseDto> {
    const companyId = this.resolveCompanyId(actor, dto.companyId);
    await this.ensureIdentificationTypeActive(dto.identificationTypeId);

    const existingIdType = await this.personRepo.findByCompanyAndIdentification(
      companyId,
      dto.identificationTypeId,
      dto.identificationNumber,
    );
    if (existingIdType) {
      throw new ConflictError(
        'A person with this identification already exists in this company',
      );
    }

    const person = Person.create({
      companyId,
      firstName: dto.firstName,
      middleName: dto.middleName ?? null,
      firstSurname: dto.firstSurname,
      secondSurname: dto.secondSurname ?? null,
      marriedSurname: dto.marriedSurname ?? null,
      identificationTypeId: dto.identificationTypeId,
      identificationNumber: dto.identificationNumber,
      socialSecurityNumber: dto.socialSecurityNumber ?? null,
      birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
      gender: dto.gender ?? null,
      maritalStatus: dto.maritalStatus ?? null,
      nationality: dto.nationality ?? null,
      bloodType: dto.bloodType ?? null,
      phone: dto.phone ?? null,
      mobile: dto.mobile ?? null,
      email: dto.email ?? null,
      residentialAddress: dto.residentialAddress ?? null,
      physicalCondition: dto.physicalCondition ?? null,
      department: dto.department ?? null,
      position: dto.position ?? null,
      yearsOfService: dto.yearsOfService ?? null,
      previouslyWorkedAtAirport: dto.previouslyWorkedAtAirport ?? false,
      previousCompanyName: dto.previousCompanyName ?? null,
      previouslyHadCredential: dto.previouslyHadCredential ?? false,
      reusePreviousPhoto: dto.reusePreviousPhoto ?? false,
      createdBy: actor.userId,
    });
    const saved = await this.personRepo.save(person);
    return PersonPresenter.toResponse(saved);
  }

  async findAll(
    params: {
      companyId?: string;
      search?: string;
      status?: string;
      identificationTypeId?: string;
      page?: number;
      limit?: number;
    },
    actor: AuthenticatedUser,
  ): Promise<{
    items: PersonResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const limit = Math.min(params.limit ?? 50, 200);
    const offset = ((params.page ?? 1) - 1) * limit;

    let companyId = params.companyId;
    if (!canReadAcrossCompanies(actor.roles)) {
      companyId = actor.companyId ?? undefined;
    }
    const status = params.status ? VALID_STATUSES[params.status] : undefined;
    if (params.status && !status) {
      throw new BusinessRuleError(`Invalid person status: ${params.status}`);
    }

    const result = await this.personRepo.findAll({
      companyId,
      search: params.search,
      status,
      identificationTypeId: params.identificationTypeId,
      offset,
      limit,
    });

    return {
      items: result.items.map((p) => PersonPresenter.toResponse(p)),
      total: result.total,
      page: params.page ?? 1,
      limit,
    };
  }

  async findById(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<PersonResponseDto> {
    const person = await this.personRepo.findById(id);
    if (!person) throw new NotFoundError('Person', id);
    if (!canReadAcrossCompanies(actor.roles)) {
      this.ensureCompanyScope(actor, person.companyId);
    }
    return PersonPresenter.toResponse(person);
  }

  async update(
    id: string,
    dto: UpdatePersonDto,
    actor: AuthenticatedUser,
  ): Promise<PersonResponseDto> {
    const person = await this.personRepo.findById(id);
    if (!person) throw new NotFoundError('Person', id);
    this.ensureCompanyScope(actor, person.companyId);

    if (
      dto.identificationTypeId &&
      dto.identificationNumber &&
      (dto.identificationTypeId !== person.identificationTypeId ||
        dto.identificationNumber !== person.identificationNumber)
    ) {
      await this.ensureIdentificationTypeActive(dto.identificationTypeId);
      const clash = await this.personRepo.findByCompanyAndIdentification(
        person.companyId,
        dto.identificationTypeId,
        dto.identificationNumber,
      );
      if (clash && clash.id !== person.id) {
        throw new ConflictError(
          'A person with this identification already exists',
        );
      }
    }

    person.update({
      ...dto,
      birthDate:
        dto.birthDate === undefined
          ? undefined
          : dto.birthDate
            ? new Date(dto.birthDate)
            : null,
    });
    const saved = await this.personRepo.save(person);
    return PersonPresenter.toResponse(saved);
  }

  async activate(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<PersonResponseDto> {
    const person = await this.personRepo.findById(id);
    if (!person) throw new NotFoundError('Person', id);
    this.ensureCompanyScope(actor, person.companyId);
    person.activate();
    const saved = await this.personRepo.save(person);
    return PersonPresenter.toResponse(saved);
  }

  async deactivate(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<PersonResponseDto> {
    const person = await this.personRepo.findById(id);
    if (!person) throw new NotFoundError('Person', id);
    this.ensureCompanyScope(actor, person.companyId);
    person.deactivate();
    const saved = await this.personRepo.save(person);
    return PersonPresenter.toResponse(saved);
  }

  private resolveCompanyId(
    actor: AuthenticatedUser,
    requestedCompanyId?: string,
  ): string {
    if (actor.roles.includes('SYSTEM_ADMIN')) {
      if (!requestedCompanyId) {
        throw new BusinessRuleError(
          'companyId is required for system administrators',
        );
      }
      return requestedCompanyId;
    }
    if (!actor.companyId) throw new ForbiddenError('User has no company');
    return actor.companyId;
  }

  private ensureCompanyScope(
    actor: AuthenticatedUser,
    targetCompanyId: string,
  ): void {
    if (actor.roles.includes('SYSTEM_ADMIN')) return;
    if (actor.companyId !== targetCompanyId) {
      throw new ForbiddenError('Cannot access people from another company');
    }
  }

  private async ensureIdentificationTypeActive(
    identificationTypeId: string,
  ): Promise<void> {
    const item = await this.catalogs.findById(identificationTypeId);
    if (!item) throw new BusinessRuleError('Unknown identification type');
    if (item.kind !== 'IDENTIFICATION_TYPE') {
      throw new BusinessRuleError(
        `Catalog item is not an IDENTIFICATION_TYPE (got ${item.kind})`,
      );
    }
    if (!item.isActive) {
      throw new BusinessRuleError('Identification type is not active');
    }
  }

  /** Used by other modules to look up a person with scoping checks applied. */
  async getByIdAndCompany(
    id: string,
    companyId: string | null,
  ): Promise<Person> {
    const person = await this.personRepo.findById(id);
    if (!person) throw new NotFoundError('Person', id);
    if (companyId !== null && person.companyId !== companyId) {
      throw new ForbiddenError('Person belongs to another company');
    }
    return person;
  }
}
