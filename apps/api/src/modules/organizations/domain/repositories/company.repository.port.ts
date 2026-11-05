import { Company } from '../entities/company.entity';

export interface CompanyRepositoryPort {
  findById(id: string): Promise<Company | null>;
  findByTaxIdentifier(taxIdentifier: string): Promise<Company | null>;
  findByExternalClientId(externalClientId: string): Promise<Company | null>;
  /** Most recent `externalSyncedAt` among companies from `source`. */
  findLatestExternalSync(source: string): Promise<Date | null>;
  findAll(params?: {
    search?: string;
    status?: string;
    offset?: number;
    limit?: number;
  }): Promise<{ items: Company[]; total: number }>;
  save(company: Company): Promise<Company>;
}

export const COMPANY_REPOSITORY = Symbol('COMPANY_REPOSITORY');
