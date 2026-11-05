import { DomainError } from '../../../common/domain/errors/domain-error';

/**
 * Company record as published by the external customer registry
 * (AITSA `get-consulta-empresas`, backed by Intelisis).
 */
export interface ExternalCompanyRecord {
  clienteId: string;
  nombre: string;
  nombreComercial: string | null;
  ruc: string | null;
  dv: string | null;
  correo: string | null;
  telefono: string | null;
  direccion: string | null;
  contacto: string | null;
  /** `Alta` = active; anything else (e.g. `Baja`) = inactive. */
  estado: string | null;
}

/** Filters supported by the registry. All optional; combine as needed. */
export interface ExternalCompanyQuery {
  /** YYYY-MM-DD — records modified on/after this date. */
  fechaDesde?: string;
  ruc?: string;
  nombre?: string;
  clienteId?: string;
}

export interface ExternalCompanyRegistryPort {
  /** Value stored in `companies.external_source` for records from this registry. */
  readonly source: string;
  /** False when credentials are missing; callers should fail fast. */
  isConfigured(): boolean;
  search(query: ExternalCompanyQuery): Promise<ExternalCompanyRecord[]>;
}

export const EXTERNAL_COMPANY_REGISTRY = Symbol('EXTERNAL_COMPANY_REGISTRY');

/** The external registry is unreachable, misconfigured or rejected the call. */
export class ExternalRegistryError extends DomainError {
  readonly code = 'EXTERNAL_SERVICE_ERROR';
  readonly statusCode = 502;
}
