/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import { AppModule } from './../src/app.module';

/**
 * IDOR regression coverage (Phase 5 final internal hardening).
 *
 * Goal: prove that swapping the resource id in a URL cannot let a
 * COMPANY_ADMIN cross tenant boundaries. Fixtures are the deterministic
 * development seed:
 *   - roberto (8-234-567)  → SYSTEM_ADMIN on company #0 (AAC)
 *   - laura   (4-345-678)  → COMPANY_ADMIN on company #1 (MD Panama)
 *
 * Flow: log in as SYSTEM_ADMIN, list one record per protected resource
 * (credential, custody record, audit event, workflow instance, workflow
 * task). Then log in as laura and confirm she cannot read any of those
 * records: the response must be 403 (or 404).
 */
describe('IDOR regression (e2e)', () => {
  let app: INestApplication;
  let systemToken: string;
  let companyToken: string;

  // IDs harvested while logged in as SYSTEM_ADMIN.
  let credentialId: string | undefined;
  let custodyId: string | undefined;
  let auditId: string | undefined;
  let workflowInstanceId: string | undefined;
  let workflowTaskId: string | undefined;

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
  });

  afterAll(async () => {
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

  it('SYSTEM_ADMIN authenticates and harvests resource ids', async () => {
    systemToken = await login('8-234-567');

    // One credential from any tenant (seed creates several).
    const credList = await request(server())
      .get('/api/v1/credentials?page=1&pageSize=5')
      .set('Authorization', `Bearer ${systemToken}`)
      .expect(200);
    credentialId = credList.body.items?.[0]?.id;
    expect(credentialId).toEqual(expect.any(String));

    // Custody record (may not exist on a fresh seed).
    const custodyList = await request(server())
      .get('/api/v1/custody?page=1&pageSize=5')
      .set('Authorization', `Bearer ${systemToken}`)
      .expect(200);
    custodyId = custodyList.body.items?.[0]?.id;

    // One audit event.
    const auditList = await request(server())
      .get('/api/v1/audit/query?page=1&pageSize=5')
      .set('Authorization', `Bearer ${systemToken}`)
      .expect(200);
    auditId = auditList.body.items?.[0]?.id;
    expect(auditId).toEqual(expect.any(String));

    // Workflow instance (if seeded). No list endpoint exists on instances,
    // so we probe via the tasks endpoint which carries the parent id.
    const tasksList = await request(server())
      .get('/api/v1/workflows/tasks?page=1&pageSize=20')
      .set('Authorization', `Bearer ${systemToken}`);
    if (tasksList.statusCode === 200 && Array.isArray(tasksList.body.items)) {
      workflowTaskId = tasksList.body.items[0]?.id;
      workflowInstanceId = tasksList.body.items[0]?.workflowInstanceId;
    }
  });

  it('COMPANY_ADMIN authenticates on a different tenant', async () => {
    companyToken = await login('4-345-678');
    expect(companyToken).toEqual(expect.any(String));
  });

  it('COMPANY_ADMIN cannot read a credential from another company', async () => {
    const res = await request(server())
      .get(`/api/v1/credentials/${credentialId}`)
      .set('Authorization', `Bearer ${companyToken}`);
    expect([403, 404]).toContain(res.statusCode);
  });

  it('COMPANY_ADMIN cannot read delivery info of a foreign credential', async () => {
    const res = await request(server())
      .get(`/api/v1/credentials/${credentialId}/delivery`)
      .set('Authorization', `Bearer ${companyToken}`);
    expect([403, 404]).toContain(res.statusCode);
  });

  it('COMPANY_ADMIN cannot read custody records from another company', async () => {
    if (!custodyId) return; // skip when seed lacks custody rows
    const res = await request(server())
      .get(`/api/v1/custody/${custodyId}`)
      .set('Authorization', `Bearer ${companyToken}`);
    expect([403, 404]).toContain(res.statusCode);
  });

  it('COMPANY_ADMIN cannot read an audit event from another company', async () => {
    const res = await request(server())
      .get(`/api/v1/audit/${auditId}`)
      .set('Authorization', `Bearer ${companyToken}`);
    expect([403, 404]).toContain(res.statusCode);
    if (res.statusCode === 200) {
      // Belt-and-suspenders: even if the row was returned it must hide.
      expect(res.body.error).toBe('Not found');
    }
  });

  it('COMPANY_ADMIN cannot read a workflow instance from another company', async () => {
    if (!workflowInstanceId) return; // skip if no instances seeded
    const res = await request(server())
      .get(`/api/v1/workflows/instances/${workflowInstanceId}`)
      .set('Authorization', `Bearer ${companyToken}`);
    expect([403, 404]).toContain(res.statusCode);
  });

  it('COMPANY_ADMIN cannot read a workflow task from another company', async () => {
    if (!workflowTaskId) return; // skip if no tasks seeded
    const res = await request(server())
      .get(`/api/v1/workflows/tasks/${workflowTaskId}`)
      .set('Authorization', `Bearer ${companyToken}`);
    expect([403, 404]).toContain(res.statusCode);
  });
});
