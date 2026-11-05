/**
 * AITSA company sync: mapping, upsert matching, status rules, incremental
 * cursor, and response-shape tolerance of the HTTP adapter helpers.
 */
/* eslint-disable @typescript-eslint/require-await */

import { Logger } from '@nestjs/common';
import {
  CompanySyncService,
  toCompanyExternalData,
} from './company-sync.service';
import { Company } from '../domain/entities/company.entity';
import type { CompanyRepositoryPort } from '../domain/repositories/company.repository.port';
import type {
  ExternalCompanyQuery,
  ExternalCompanyRecord,
  ExternalCompanyRegistryPort,
} from '../domain/external-company-registry.port';
import {
  extractRecords,
  normalizeRecord,
  parseToken,
} from '../infrastructure/aitsa/aitsa-companies.client';

function makeRecord(
  partial: Partial<ExternalCompanyRecord> = {},
): ExternalCompanyRecord {
  return {
    clienteId: 'C000010',
    nombre: 'AMERICAN AIRLINES',
    nombreComercial: 'AMERICAN',
    ruc: '28726-117-524',
    dv: '60',
    correo: 'angela.diaz@aa.com',
    telefono: '238-4699',
    direccion: 'Aeropuerto',
    contacto: 'ANGELA DIAZ',
    estado: 'Alta',
    ...partial,
  };
}

class InMemoryCompanyRepo implements CompanyRepositoryPort {
  rows = new Map<string, Company>();
  saves = 0;

  async findById(id: string) {
    return this.rows.get(id) ?? null;
  }
  async findByTaxIdentifier(tax: string) {
    return [...this.rows.values()].find((c) => c.taxIdentifier === tax) ?? null;
  }
  async findByExternalClientId(id: string) {
    return (
      [...this.rows.values()].find((c) => c.externalClientId === id) ?? null
    );
  }
  async findLatestExternalSync(source: string) {
    const dates = [...this.rows.values()]
      .filter((c) => c.externalSource === source && c.externalSyncedAt)
      .map((c) => c.externalSyncedAt.getTime());
    return dates.length ? new Date(Math.max(...dates)) : null;
  }
  async findAll() {
    return { items: [...this.rows.values()], total: this.rows.size };
  }
  async save(company: Company) {
    this.saves++;
    // Store a copy so in-memory mutations without save() are not persisted.
    const copy = Company.reconstitute(company.toProps());
    this.rows.set(copy.id, copy);
    return copy;
  }
}

class FakeRegistry implements ExternalCompanyRegistryPort {
  readonly source = 'AITSA';
  queries: ExternalCompanyQuery[] = [];
  constructor(public records: ExternalCompanyRecord[] = []) {}
  isConfigured() {
    return true;
  }
  async search(query: ExternalCompanyQuery) {
    this.queries.push(query);
    if (query.clienteId) {
      return this.records.filter((r) => r.clienteId === query.clienteId);
    }
    return this.records;
  }
}

beforeAll(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
});

function setup(records: ExternalCompanyRecord[] = []) {
  const repo = new InMemoryCompanyRepo();
  const registry = new FakeRegistry(records);
  const service = new CompanySyncService(repo, registry);
  return { repo, registry, service };
}

describe('toCompanyExternalData', () => {
  it('maps AITSA fields onto company fields', () => {
    const data = toCompanyExternalData(makeRecord(), 'AITSA');
    expect(data).toEqual({
      legalName: 'AMERICAN AIRLINES',
      tradeName: 'AMERICAN',
      taxIdentifier: '28726-117-524',
      dv: '60',
      email: 'angela.diaz@aa.com',
      phone: '238-4699',
      address: 'Aeropuerto',
      mainContactName: 'ANGELA DIAZ',
      externalClientId: 'C000010',
      externalSource: 'AITSA',
      active: true,
    });
  });

  it('treats any estado other than Alta as inactive', () => {
    expect(
      toCompanyExternalData(makeRecord({ estado: 'Baja' }), 'AITSA').active,
    ).toBe(false);
    expect(
      toCompanyExternalData(makeRecord({ estado: null }), 'AITSA').active,
    ).toBe(false);
    expect(
      toCompanyExternalData(makeRecord({ estado: ' alta ' }), 'AITSA').active,
    ).toBe(true);
  });
});

describe('CompanySyncService.sync', () => {
  it('creates new companies and reports a summary', async () => {
    const { repo, service } = setup([
      makeRecord(),
      makeRecord({
        clienteId: 'C000011',
        nombre: 'COPA',
        ruc: '1-2-3',
        estado: 'Baja',
      }),
    ]);
    const summary = await service.sync();
    expect(summary).toMatchObject({
      fetched: 2,
      created: 2,
      updated: 0,
      skipped: 0,
      errors: [],
    });
    const copa = await repo.findByExternalClientId('C000011');
    expect(copa?.status).toBe('INACTIVE');
    expect(copa?.externalSource).toBe('AITSA');
  });

  it('links an existing manual company by RUC instead of duplicating it', async () => {
    const { repo, service } = setup([makeRecord()]);
    const manual = await repo.save(
      Company.create({
        legalName: 'American (manual)',
        taxIdentifier: '28726-117-524',
      }),
    );
    const summary = await service.sync();
    expect(summary).toMatchObject({ created: 0, updated: 1 });
    expect(repo.rows.size).toBe(1);
    const linked = await repo.findById(manual.id);
    expect(linked?.externalClientId).toBe('C000010');
    expect(linked?.legalName).toBe('AMERICAN AIRLINES');
  });

  it('skips unchanged records without writing', async () => {
    const { repo, service } = setup([makeRecord()]);
    await service.sync();
    const writes = repo.saves;
    const summary = await service.sync();
    expect(summary).toMatchObject({ created: 0, updated: 0, skipped: 1 });
    expect(repo.saves).toBe(writes);
  });

  it('keeps a local suspension when AITSA reports Alta, but applies Baja', async () => {
    const { repo, registry, service } = setup([makeRecord()]);
    await service.sync();
    const company = await repo.findByExternalClientId('C000010');
    company.suspend();
    await repo.save(company);

    registry.records = [makeRecord({ telefono: '000-0000' })];
    await service.sync();
    expect((await repo.findByExternalClientId('C000010'))?.status).toBe(
      'SUSPENDED',
    );

    registry.records = [makeRecord({ estado: 'Baja' })];
    await service.sync();
    expect((await repo.findByExternalClientId('C000010'))?.status).toBe(
      'INACTIVE',
    );
  });

  it('reports a conflict when the RUC belongs to another AITSA client', async () => {
    const { service } = setup([
      makeRecord(),
      makeRecord({ clienteId: 'C999999', nombre: 'DUPLICADA' }),
    ]);
    const summary = await service.sync();
    expect(summary.created).toBe(1);
    expect(summary.errors).toHaveLength(1);
    expect(summary.errors[0].clienteId).toBe('C999999');
  });

  it('uses the last sync date minus one day as fechaDesde', async () => {
    const { repo, registry, service } = setup([]);
    const company = Company.fromExternal(
      toCompanyExternalData(makeRecord(), 'AITSA'),
      new Date('2026-10-20T10:00:00Z'),
    );
    await repo.save(company);
    await service.sync();
    expect(registry.queries.at(-1)).toEqual({ fechaDesde: '2026-10-19' });

    await service.sync({ fechaDesde: '2026-01-01' });
    expect(registry.queries.at(-1)).toEqual({ fechaDesde: '2026-01-01' });
  });

  it('does a full sync when nothing has been synchronised yet', async () => {
    const { registry, service } = setup([]);
    const summary = await service.sync();
    expect(summary.fechaDesde).toBeNull();
    expect(registry.queries.at(-1)).toEqual({});
  });
});

describe('CompanySyncService search / import', () => {
  it('flags results already imported', async () => {
    const { service } = setup([
      makeRecord(),
      makeRecord({ clienteId: 'C2', ruc: '9-9-9' }),
    ]);
    const imported = await service.importByClientId('C000010');
    const results = await service.search({ nombre: 'AMERICAN' });
    expect(
      results.find((r) => r.clienteId === 'C000010')?.importedCompanyId,
    ).toBe(imported.id);
    expect(
      results.find((r) => r.clienteId === 'C2')?.importedCompanyId,
    ).toBeNull();
  });

  it('rejects an empty search', async () => {
    const { service } = setup();
    await expect(service.search({ nombre: '  ' })).rejects.toThrow(
      /ruc, nombre or clienteId/,
    );
  });

  it('throws NotFound when the clienteId does not exist in AITSA', async () => {
    const { service } = setup([]);
    await expect(service.importByClientId('NOPE')).rejects.toThrow(/not found/);
  });
});

describe('AITSA client helpers', () => {
  it('parses the common token response shapes', () => {
    expect(parseToken('{"access_token":"abc","expires_in":3600}')).toEqual({
      token: 'abc',
      expiresInSec: 3600,
    });
    expect(parseToken('{"accessToken":"abc"}')).toEqual({
      token: 'abc',
      expiresInSec: null,
    });
    expect(parseToken('{"data":{"token":"abc"}}')).toEqual({
      token: 'abc',
      expiresInSec: null,
    });
    expect(parseToken('"abc"')).toEqual({ token: 'abc', expiresInSec: null });
    expect(parseToken('eyJhbGciOi.x.y')).toEqual({
      token: 'eyJhbGciOi.x.y',
      expiresInSec: null,
    });
    expect(parseToken('{"error":"nope"}')).toBeNull();
    expect(parseToken('')).toBeNull();
  });

  it('extracts records from array, wrapped and single-object bodies', () => {
    const row = { cliente_Id: 'C1', nombre: 'X' };
    expect(extractRecords([row])).toEqual([row]);
    expect(extractRecords({ data: [row] })).toEqual([row]);
    expect(extractRecords({ data: row })).toEqual([row]);
    expect(extractRecords(row)).toEqual([row]);
    expect(extractRecords(null)).toEqual([]);
  });

  it('normalizes records and drops rows without id or name', () => {
    expect(
      normalizeRecord({ cliente_Id: ' C1 ', nombre: 'X', ruc: '', dv: 60 }),
    ).toMatchObject({
      clienteId: 'C1',
      ruc: null,
      dv: '60',
    });
    expect(normalizeRecord({ nombre: 'X' })).toBeNull();
    expect(normalizeRecord({ cliente_Id: 'C1' })).toBeNull();
  });
});
