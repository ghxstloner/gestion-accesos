import type { Request } from '../entities/request.entity';
import type { RequestStatus } from '../entities/request.entity';

export const REQUEST_REPOSITORY = Symbol('REQUEST_REPOSITORY');

export interface RequestListFilters {
  companyId?: string;
  createdByUserId?: string;
  status?: RequestStatus;
  requestTypeId?: string;
  search?: string;
}

export interface PaginatedRequests {
  items: Request[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RequestRepositoryPort {
  /** Find request aggregate by id with all children loaded. */
  findById(id: string): Promise<Request | null>;

  /** Paginated, filtered listing. */
  findMany(
    filters: RequestListFilters,
    page: number,
    pageSize: number,
  ): Promise<PaginatedRequests>;

  /** Persist the full aggregate (insert or update; optimistic locking via version). */
  save(request: Request): Promise<void>;

  /** Hard delete a draft request. */
  delete(id: string): Promise<void>;

  /**
   * Atomically reserve a sequence number for a given prefix and year.
   * Implementations MUST be transactional and use row-level locking.
   */
  nextSequenceNumber(prefix: string, year: number): Promise<number>;

  /** Count requests submitted by a company in the current year (for number generation). */
  countForNumber(
    prefix: string,
    year: number,
    companyId: string,
  ): Promise<number>;
}
