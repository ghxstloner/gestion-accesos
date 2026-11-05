import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../../common/domain/errors/domain-error';
import {
  Company,
  CompanyExternalData,
} from '../domain/entities/company.entity';
import {
  COMPANY_REPOSITORY,
  type CompanyRepositoryPort,
} from '../domain/repositories/company.repository.port';
import {
  EXTERNAL_COMPANY_REGISTRY,
  type ExternalCompanyQuery,
  type ExternalCompanyRecord,
  type ExternalCompanyRegistryPort,
} from '../domain/external-company-registry.port';

export type UpsertOutcome = 'created' | 'updated' | 'unchanged';

export interface CompanySyncSummary {
  source: string;
  /** Filter sent to the registry; null = full sync. */
  fechaDesde: string | null;
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ clienteId: string; message: string }>;
  startedAt: Date;
  finishedAt: Date;
}

export interface ExternalCompanySearchResult extends ExternalCompanyRecord {
  /** Local company already linked to this record (by cliente_Id or RUC). */
  importedCompanyId: string | null;
}

/** Fields compared to decide whether a sync actually changed a company. */
const TRACKED_FIELDS = [
  'legalName',
  'tradeName',
  'taxIdentifier',
  'dv',
  'email',
  'phone',
  'address',
  'mainContactName',
  'externalClientId',
  'externalSource',
  'status',
] as const;

/** Maps an AITSA record onto the registry-owned company fields. */
export function toCompanyExternalData(
  record: ExternalCompanyRecord,
  source: string,
): CompanyExternalData {
  return {
    legalName: record.nombre,
    tradeName: record.nombreComercial,
    taxIdentifier: record.ruc,
    dv: record.dv,
    email: record.correo,
    phone: record.telefono,
    address: record.direccion,
    mainContactName: record.contacto,
    externalClientId: record.clienteId,
    externalSource: source,
    active: (record.estado ?? '').trim().toLowerCase() === 'alta',
  };
}

function toDateParam(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Synchronises companies from the external registry (AITSA / Intelisis).
 *
 * Matching: `externalClientId` first, then RUC (`taxIdentifier`) so companies
 * created manually before the integration get linked instead of duplicated.
 * Incremental runs use `fechaDesde` = date of the last company the sync
 * changed, minus one day (the registry filter is date-only).
 */
@Injectable()
export class CompanySyncService {
  private readonly logger = new Logger(CompanySyncService.name);
  private running = false;

  constructor(
    @Inject(COMPANY_REPOSITORY)
    private readonly companyRepo: CompanyRepositoryPort,
    @Inject(EXTERNAL_COMPANY_REGISTRY)
    private readonly registry: ExternalCompanyRegistryPort,
  ) {}

  isConfigured(): boolean {
    return this.registry.isConfigured();
  }

  async search(
    query: ExternalCompanyQuery,
  ): Promise<ExternalCompanySearchResult[]> {
    const clean: ExternalCompanyQuery = {
      ruc: query.ruc?.trim() || undefined,
      nombre: query.nombre?.trim() || undefined,
      clienteId: query.clienteId?.trim() || undefined,
    };
    if (!clean.ruc && !clean.nombre && !clean.clienteId) {
      throw new ValidationError('Provide ruc, nombre or clienteId to search');
    }
    const records = await this.registry.search(clean);
    const results: ExternalCompanySearchResult[] = [];
    for (const record of records) {
      const local = await this.findLocalMatch(record);
      results.push({ ...record, importedCompanyId: local?.id ?? null });
    }
    return results;
  }

  async importByClientId(clienteId: string): Promise<Company> {
    const id = clienteId?.trim();
    if (!id) throw new ValidationError('clienteId is required');
    const records = await this.registry.search({ clienteId: id });
    const record = records.find((r) => r.clienteId === id) ?? null;
    if (!record) throw new NotFoundError('AITSA company', id);
    const { company } = await this.upsertRecord(record);
    return company;
  }

  async sync(
    options: { fechaDesde?: string | null } = {},
  ): Promise<CompanySyncSummary> {
    if (this.running) {
      throw new ConflictError('A company synchronisation is already running');
    }
    this.running = true;
    const startedAt = new Date();
    try {
      const fechaDesde =
        options.fechaDesde?.trim() || (await this.defaultFechaDesde());
      const records = await this.registry.search(
        fechaDesde ? { fechaDesde } : {},
      );
      const summary: CompanySyncSummary = {
        source: this.registry.source,
        fechaDesde,
        fetched: records.length,
        created: 0,
        updated: 0,
        skipped: 0,
        errors: [],
        startedAt,
        finishedAt: startedAt,
      };
      for (const record of records) {
        try {
          const { outcome } = await this.upsertRecord(record);
          if (outcome === 'created') summary.created++;
          else if (outcome === 'updated') summary.updated++;
          else summary.skipped++;
        } catch (err) {
          summary.skipped++;
          summary.errors.push({
            clienteId: record.clienteId,
            message: (err as Error).message,
          });
        }
      }
      summary.finishedAt = new Date();
      this.logger.log(
        `Company sync (${summary.source}, fechaDesde=${fechaDesde ?? 'ALL'}): ` +
          `fetched=${summary.fetched} created=${summary.created} ` +
          `updated=${summary.updated} skipped=${summary.skipped} errors=${summary.errors.length}`,
      );
      return summary;
    } finally {
      this.running = false;
    }
  }

  async upsertRecord(
    record: ExternalCompanyRecord,
  ): Promise<{ company: Company; outcome: UpsertOutcome }> {
    const data = toCompanyExternalData(record, this.registry.source);
    const now = new Date();

    const byClient = await this.companyRepo.findByExternalClientId(
      record.clienteId,
    );
    const byRuc = record.ruc
      ? await this.companyRepo.findByTaxIdentifier(record.ruc)
      : null;

    if (byClient && byRuc && byClient.id !== byRuc.id) {
      throw new ConflictError(
        `RUC ${record.ruc} already belongs to another company (${byRuc.legalName})`,
      );
    }
    if (!byClient && byRuc?.externalClientId) {
      throw new ConflictError(
        `RUC ${record.ruc} is linked to a different AITSA client (${byRuc.externalClientId})`,
      );
    }

    const existing = byClient ?? byRuc;
    if (!existing) {
      const created = Company.fromExternal(data, now);
      return {
        company: await this.companyRepo.save(created),
        outcome: 'created',
      };
    }

    const before = existing.toProps();
    existing.applyExternal(data, now);
    const after = existing.toProps();
    const changed = TRACKED_FIELDS.some((f) => before[f] !== after[f]);
    if (!changed) return { company: existing, outcome: 'unchanged' };
    return {
      company: await this.companyRepo.save(existing),
      outcome: 'updated',
    };
  }

  private async findLocalMatch(
    record: ExternalCompanyRecord,
  ): Promise<Company | null> {
    const byClient = await this.companyRepo.findByExternalClientId(
      record.clienteId,
    );
    if (byClient) return byClient;
    return record.ruc ? this.companyRepo.findByTaxIdentifier(record.ruc) : null;
  }

  private async defaultFechaDesde(): Promise<string | null> {
    const last = await this.companyRepo.findLatestExternalSync(
      this.registry.source,
    );
    if (!last) return null;
    return toDateParam(new Date(last.getTime() - 24 * 60 * 60_000));
  }
}
