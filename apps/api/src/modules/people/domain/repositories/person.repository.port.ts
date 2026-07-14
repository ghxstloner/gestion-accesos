import { Person } from '../entities/person.entity';

export const PERSON_REPOSITORY = Symbol('PERSON_REPOSITORY');

export interface PersonListParams {
  companyId?: string;
  search?: string;
  status?: string;
  identificationTypeId?: string;
  offset?: number;
  limit?: number;
}

export interface PersonRepositoryPort {
  findById(id: string): Promise<Person | null>;
  findByCompanyAndIdentification(
    companyId: string,
    identificationTypeId: string,
    identificationNumber: string,
  ): Promise<Person | null>;
  findAll(
    params: PersonListParams,
  ): Promise<{ items: Person[]; total: number }>;
  save(person: Person): Promise<Person>;
  countActiveRelations(id: string): Promise<number>;
  /** Returns whether the person is referenced by any RequestPerson link. */
  existsInRequestLinks(id: string): Promise<boolean>;
}
