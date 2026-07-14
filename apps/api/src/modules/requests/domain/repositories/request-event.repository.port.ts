import type { RequestEvent } from '../entities/request-event.entity';

export const REQUEST_EVENT_REPOSITORY = Symbol('REQUEST_EVENT_REPOSITORY');

export interface RequestEventRepositoryPort {
  /** Persist a new event row. Events are immutable after creation. */
  create(event: RequestEvent): Promise<void>;

  /** List events for a request, oldest-first. */
  listByRequest(requestId: string): Promise<RequestEvent[]>;
}
