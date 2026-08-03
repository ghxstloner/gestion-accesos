/**
 * Audit: filter, mask, csv, pagination, permission scope.
 */
/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/require-await */

import {
  AuditService,
  maskSensitive,
  toCsv,
  csvCell,
  REDACTED,
} from './audit.service';

interface Row {
  id: string;
  actorUserId: string | null;
  actorCompanyId: string | null;
  action: string;
  aggregateType: string;
  aggregateId: string | null;
  previousData: unknown;
  newData: unknown;
  metadata: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  correlationId: string | null;
  occurredAt: Date;
}

function makeRow(partial: Partial<Row>): Row {
  return {
    id: partial.id ?? 'e1',
    actorUserId: partial.actorUserId ?? 'u1',
    actorCompanyId: partial.actorCompanyId ?? 'c1',
    action: partial.action ?? 'create',
    aggregateType: partial.aggregateType ?? 'request',
    aggregateId: partial.aggregateId ?? 'r1',
    previousData: partial.previousData ?? null,
    newData: partial.newData ?? null,
    metadata: partial.metadata ?? null,
    ipAddress: partial.ipAddress ?? null,
    userAgent: partial.userAgent ?? null,
    correlationId: partial.correlationId ?? null,
    occurredAt: partial.occurredAt ?? new Date('2026-08-01T12:00:00Z'),
  };
}

function makeFakePrisma(rows: Row[]) {
  return {
    auditEvent: {
      async create() {
        return {};
      },
      async findUnique({ where }: { where: { id: string } }) {
        return rows.find((r) => r.id === where.id) ?? null;
      },
      async findMany({ where, skip, take }: any) {
        let out = rows.slice();
        if (where?.aggregateType)
          out = out.filter((r) => r.aggregateType === where.aggregateType);
        if (where?.action) {
          if (typeof where.action === 'string') {
            out = out.filter((r) => r.action === where.action);
          } else if (where.action.contains) {
            out = out.filter((r) => r.action.includes(where.action.contains));
          }
        }
        if (where?.actorUserId)
          out = out.filter((r) => r.actorUserId === where.actorUserId);
        if (where?.correlationId)
          out = out.filter((r) => r.correlationId === where.correlationId);
        if (where?.occurredAt?.gte)
          out = out.filter((r) => r.occurredAt >= where.occurredAt.gte);
        if (where?.occurredAt?.lte)
          out = out.filter((r) => r.occurredAt <= where.occurredAt.lte);
        out.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
        return out.slice(skip ?? 0, (skip ?? 0) + (take ?? out.length));
      },
      async count({ where }: any) {
        let out = rows.slice();
        if (where?.aggregateType)
          out = out.filter((r) => r.aggregateType === where.aggregateType);
        if (where?.action) {
          if (typeof where.action === 'string')
            out = out.filter((r) => r.action === where.action);
          else if (where.action.contains)
            out = out.filter((r) => r.action.includes(where.action.contains));
        }
        if (where?.actorUserId)
          out = out.filter((r) => r.actorUserId === where.actorUserId);
        if (where?.correlationId)
          out = out.filter((r) => r.correlationId === where.correlationId);
        if (where?.occurredAt?.gte)
          out = out.filter((r) => r.occurredAt >= where.occurredAt.gte);
        if (where?.occurredAt?.lte)
          out = out.filter((r) => r.occurredAt <= where.occurredAt.lte);
        return out.length;
      },
    },
  };
}

describe('maskSensitive', () => {
  it('masks known sensitive fields', () => {
    const out = maskSensitive({
      name: 'Alice',
      password: 'secret',
      nested: { token: 'x', ok: 1 },
      list: [{ hashedPassword: 'h', other: 'ok' }],
    });
    expect(out).toEqual({
      name: 'Alice',
      password: REDACTED,
      nested: { token: REDACTED, ok: 1 },
      list: [{ hashedPassword: REDACTED, other: 'ok' }],
    });
  });

  it('passes through null and primitives', () => {
    expect(maskSensitive(null)).toBeNull();
    expect(maskSensitive(42)).toBe(42);
    expect(maskSensitive('plain')).toBe('plain');
  });
});

describe('csvCell + toCsv', () => {
  it('escapes commas, quotes and newlines', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('he said "hi"')).toBe('"he said ""hi"""');
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"');
  });

  it('serialises rows with column ordering', () => {
    const csv = toCsv(
      [
        { a: 1, b: 'x' },
        { a: 2, b: 'y,z' },
      ],
      ['a', 'b'],
    );
    expect(csv).toBe('a,b\n1,x\n2,"y,z"');
  });

  it('emits only the header when empty', () => {
    expect(toCsv([], ['a', 'b'])).toBe('a,b');
  });
});

describe('AuditService.query / detail / exportCsv', () => {
  const rows: Row[] = [
    makeRow({
      id: 'e1',
      action: 'request.create.success',
      aggregateType: 'request',
      occurredAt: new Date('2026-08-02T10:00:00Z'),
      newData: { holder: 'a', password: 'p' },
    }),
    makeRow({
      id: 'e2',
      action: 'request.reject.failure',
      aggregateType: 'request',
      occurredAt: new Date('2026-08-01T10:00:00Z'),
      newData: { ok: true },
    }),
    makeRow({
      id: 'e3',
      action: 'credential.update',
      aggregateType: 'credential',
      occurredAt: new Date('2026-08-03T10:00:00Z'),
      newData: { ok: true },
    }),
  ];

  it('filters by date range', async () => {
    const svc = new AuditService(makeFakePrisma(rows) as any);
    const res = await svc.query({
      from: new Date('2026-08-02T00:00:00Z'),
      to: new Date('2026-08-02T23:59:59Z'),
      page: 1,
      pageSize: 50,
    });
    expect(res.total).toBe(1);
    expect(res.items[0].id).toBe('e1');
  });

  it('filters by aggregateType', async () => {
    const svc = new AuditService(makeFakePrisma(rows) as any);
    const res = await svc.query({
      aggregateType: 'credential',
      page: 1,
      pageSize: 50,
    });
    expect(res.total).toBe(1);
    expect(res.items[0].id).toBe('e3');
  });

  it('paginates deterministically', async () => {
    const svc = new AuditService(makeFakePrisma(rows) as any);
    const page1 = await svc.query({ page: 1, pageSize: 2 });
    const page2 = await svc.query({ page: 2, pageSize: 2 });
    expect(page1.items.map((i) => i.id)).toEqual(['e3', 'e1']);
    expect(page2.items.map((i) => i.id)).toEqual(['e2']);
  });

  it('masks sensitive fields in returned items', async () => {
    const svc = new AuditService(makeFakePrisma(rows) as any);
    const res = await svc.query({
      aggregateType: 'request',
      page: 1,
      pageSize: 50,
    });
    const item = res.items.find((x) => x.id === 'e1');
    expect((item.newData as { password: string }).password).toBe(REDACTED);
  });

  it('detail returns the row when found', async () => {
    const svc = new AuditService(makeFakePrisma(rows) as any);
    const r = await svc.detail('e1');
    expect(r?.id).toBe('e1');
  });

  it('detail returns null when missing', async () => {
    const svc = new AuditService(makeFakePrisma(rows) as any);
    expect(await svc.detail('nope')).toBeNull();
  });

  it('exportCsv produces a csv with header + body', async () => {
    const svc = new AuditService(makeFakePrisma(rows) as any);
    const csv = await svc.exportCsv({ page: 1, pageSize: 100 });
    expect(csv.split('\n')[0]).toContain('occurredAt');
    expect(csv.split('\n').length).toBe(4);
  });

  it('exportCsv respects filters', async () => {
    const svc = new AuditService(makeFakePrisma(rows) as any);
    const csv = await svc.exportCsv({
      aggregateType: 'credential',
      page: 1,
      pageSize: 100,
    });
    expect(csv.split('\n').length).toBe(2);
  });
});
