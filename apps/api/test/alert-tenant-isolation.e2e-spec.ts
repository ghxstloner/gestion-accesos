/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/common/infrastructure/prisma/prisma.service';

/**
 * Extract alert ids from a supertest response without touching `res.body`
 * (typed `any`) directly in the assertion — avoids no-unsafe-* lint rules.
 */
function extractAlertIds(res: request.Response): string[] {
  const body = res.body as { items?: Array<{ id: string }> };
  return (body.items ?? []).map((a) => a.id);
}

/**
 * Alert tenant-isolation regression (Phase 6).
 *
 * Goal: prove that a COMPANY_ADMIN cannot list, read, acknowledge or resolve
 * an OperationalAlert whose `companyId` belongs to another tenant, while
 * still being able to act on (1) alerts owned by their own company and (2)
 * GLOBAL alerts (companyId IS NULL).
 *
 * Strategy: plant a deterministic alert row owned by SYSTEM_ADMIN's company
 * (AAC — the company that company #0 owns) and a GLOBAL one, then log in as
 * COMPANY_ADMIN on a DIFFERENT company and assert the access matrix.
 */
describe('Alert tenant isolation (IDOR regression, e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let systemToken: string;
  let otherCompanyToken: string;

  let systemCompanyId: string;
  let otherCompanyId: string;

  let foreignAlertId: string;
  let ownAlertId: string;
  let globalAlertId: string;

  // Use a unique rule code so we don't collide with seed alerts across runs.
  const RULE_CODE = `phase6.idor.${process.ppid ?? 'x'}.${Date.now() % 100000}`;
  const RULE_ID = `rule-${RULE_CODE}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    // Resolve the companies of the two seeded users deterministically
    // (rather than guessing company names that may change in the seed):
    //   roberto (8-234-567) — SYSTEM_ADMIN — company "AAC"
    //   laura   (4-345-678) — COMPANY_ADMIN — McDonald's Panama
    const [systemUser, otherUser] = await prisma.user.findMany({
      where: { documentNumber: { in: ['8-234-567', '4-345-678'] } },
      select: { documentNumber: true, companyId: true },
    });
    if (!systemUser?.companyId || !otherUser?.companyId) {
      throw new Error(
        'Seed is missing the two companies required by alert IDOR tests',
      );
    }
    // Map by document for clarity (defensive ordering).
    if (systemUser.documentNumber === '8-234-567') {
      systemCompanyId = systemUser.companyId;
      otherCompanyId = otherUser.companyId;
    } else {
      systemCompanyId = otherUser.companyId;
      otherCompanyId = systemUser.companyId;
    }
    // Defensive: the two seed users must belong to DIFFERENT companies,
    // otherwise the IDOR premise (foreign tenant) does not hold.
    if (systemCompanyId === otherCompanyId) {
      throw new Error(
        'Seed users 8-234-567 and 4-345-678 unexpectedly share a company',
      );
    }

    // Ensure the AlertRule exists for the unique code so the FK can resolve.
    await prisma.alertRule.upsert({
      where: { code: RULE_CODE },
      create: {
        id: RULE_ID,
        code: RULE_CODE,
        name: 'Phase 6 IDOR test rule',
        description: 'Synthetic rule for cross-tenant alert regression',
        scope: 'CREDENTIAL',
        severity: 'WARN',
        enabled: false,
      },
      update: {},
    });

    // Delete any prior synthetic alerts for this rule, then plant three.
    await prisma.operationalAlert.deleteMany({
      where: { ruleCode: RULE_CODE },
    });

    const [foreign, own, global] = await Promise.all([
      prisma.operationalAlert.create({
        data: {
          ruleId: RULE_ID,
          ruleCode: RULE_CODE,
          severity: 'WARN',
          entityType: 'credential',
          entityId: `foreign-${RULE_CODE}`,
          title: 'Foreign-tenant alert',
          message: 'Owned by system company',
          status: 'OPEN',
          companyId: systemCompanyId,
        },
      }),
      prisma.operationalAlert.create({
        data: {
          ruleId: RULE_ID,
          ruleCode: RULE_CODE,
          severity: 'WARN',
          entityType: 'credential',
          entityId: `own-${RULE_CODE}`,
          title: 'Own-tenant alert',
          message: 'Owned by the other company',
          status: 'OPEN',
          companyId: otherCompanyId,
        },
      }),
      prisma.operationalAlert.create({
        data: {
          ruleId: RULE_ID,
          ruleCode: RULE_CODE,
          severity: 'WARN',
          entityType: 'credential',
          entityId: `global-${RULE_CODE}`,
          title: 'Global alert',
          message: 'System-wide',
          status: 'OPEN',
          companyId: null,
        },
      }),
    ]);
    foreignAlertId = foreign.id;
    ownAlertId = own.id;
    globalAlertId = global.id;
  });

  afterAll(async () => {
    // Cleanup the synthetic rule + alerts we created.
    try {
      await prisma.operationalAlert.deleteMany({
        where: { ruleCode: RULE_CODE },
      });
      await prisma.alertRule.deleteMany({ where: { code: RULE_CODE } });
    } catch {
      /* best-effort cleanup */
    }
    await app.close();
  });

  function server(): Server {
    return app.getHttpServer() as Server;
  }

  async function login(doc: string): Promise<string> {
    const res = await request(server())
      .post('/api/v1/auth/login')
      .send({
        documentType: 'NATIONAL_ID',
        documentNumber: doc,
        password: 'Demo1234!',
      })
      .expect(200);
    return res.body.accessToken as string;
  }

  it('authenticates both fixtures', async () => {
    systemToken = await login('8-234-567');
    otherCompanyToken = await login('4-345-678');
    expect(systemToken).toBeTruthy();
    expect(otherCompanyToken).toBeTruthy();
  });

  it('SYSTEM_ADMIN sees every alert (foreign, own, global)', async () => {
    const res = await request(server())
      .get(`/api/v1/alerts?limit=200`)
      .set('Authorization', `Bearer ${systemToken}`)
      .expect(200);
    const ids = extractAlertIds(res);
    expect(ids).toEqual(
      expect.arrayContaining([foreignAlertId, ownAlertId, globalAlertId]),
    );
  });

  it('COMPANY_ADMIN sees own + global alerts but NOT the foreign-tenant alert', async () => {
    const res = await request(server())
      .get(`/api/v1/alerts?limit=200`)
      .set('Authorization', `Bearer ${otherCompanyToken}`)
      .expect(200);
    const ids = extractAlertIds(res);
    expect(ids).toEqual(expect.arrayContaining([ownAlertId, globalAlertId]));
    expect(ids).not.toContain(foreignAlertId);
  });

  it('COMPANY_ADMIN cannot GET a foreign-tenant alert detail', async () => {
    const res = await request(server())
      .get(`/api/v1/alerts/${foreignAlertId}`)
      .set('Authorization', `Bearer ${otherCompanyToken}`);
    expect([403, 404]).toContain(res.statusCode);
  });

  it('COMPANY_ADMIN can GET own-tenant alert detail', async () => {
    await request(server())
      .get(`/api/v1/alerts/${ownAlertId}`)
      .set('Authorization', `Bearer ${otherCompanyToken}`)
      .expect(200);
  });

  it('COMPANY_ADMIN can GET a GLOBAL alert detail', async () => {
    await request(server())
      .get(`/api/v1/alerts/${globalAlertId}`)
      .set('Authorization', `Bearer ${otherCompanyToken}`)
      .expect(200);
  });

  it('COMPANY_ADMIN cannot acknowledge a foreign-tenant alert', async () => {
    const res = await request(server())
      .post(`/api/v1/alerts/${foreignAlertId}/acknowledge`)
      .set('Authorization', `Bearer ${otherCompanyToken}`);
    expect([403, 404]).toContain(res.statusCode);

    // Side-effect: the foreign alert must STILL be OPEN.
    const row = await prisma.operationalAlert.findUnique({
      where: { id: foreignAlertId },
      select: { status: true },
    });
    expect(row?.status).toBe('OPEN');
  });

  it('COMPANY_ADMIN cannot resolve a foreign-tenant alert', async () => {
    const res = await request(server())
      .post(`/api/v1/alerts/${foreignAlertId}/resolve`)
      .set('Authorization', `Bearer ${otherCompanyToken}`);
    expect([403, 404]).toContain(res.statusCode);

    const row = await prisma.operationalAlert.findUnique({
      where: { id: foreignAlertId },
      select: { status: true, resolvedAt: true },
    });
    expect(row?.status).toBe('OPEN');
    expect(row?.resolvedAt).toBeNull();
  });

  it('COMPANY_ADMIN can acknowledge own-tenant alert', async () => {
    await request(server())
      .post(`/api/v1/alerts/${ownAlertId}/acknowledge`)
      .set('Authorization', `Bearer ${otherCompanyToken}`)
      .expect(204);
    const row = await prisma.operationalAlert.findUnique({
      where: { id: ownAlertId },
      select: { status: true },
    });
    expect(row?.status).toBe('ACKNOWLEDGED');
  });
});
