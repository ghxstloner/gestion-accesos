/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import { AppModule } from './../src/app.module';

/**
 * End-to-end smoke + auth-gated coverage for the Phase 4/5 critical surface.
 *
 * Uses the deterministic dev fixture seeded by `prisma db seed`
 * (documentType=NATIONAL_ID, documentNumber=8-234-567, password=Demo1234!).
 *
 * Covered flows:
 *   1. /health public.
 *   2. /auth/login issues an access token.
 *   3. Authenticated GET on /dashboard/summary, /audit/query,
 *      /reports/requests/by-status and /notifications/unread-count all
 *      return 200.
 *   4. An unauthenticated request is rejected (401).
 */
describe('Phase 4/5 critical surface (e2e)', () => {
  let app: INestApplication;
  let accessToken: string | undefined;

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

  it('GET /health returns 200', () =>
    request(server())
      .get('/api/v1/health')
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('ok');
        expect(typeof body.timestamp).toBe('string');
      }));

  it('GET /dashboard/summary without token is rejected (401)', () =>
    request(server()).get('/api/v1/dashboard/summary').expect(401));

  it('POST /auth/login with dev fixture issues an access token', async () => {
    const res = await request(server())
      .post('/api/v1/auth/login')
      .send({
        documentType: 'NATIONAL_ID',
        documentNumber: '8-234-567',
        password: 'Demo1234!',
      })
      .expect(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    accessToken = res.body.accessToken as string;
  });

  it('GET /dashboard/summary with token returns aggregate', () =>
    request(server())
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(
          expect.objectContaining({
            pendingRequests: expect.any(Number),
            pendingIssuance: expect.any(Number),
            nearExpiryCredentials: expect.any(Number),
            overdueCustody: expect.any(Number),
            criticalAlerts: expect.any(Number),
            overdueSlaTasks: expect.any(Number),
            recentActivity: expect.any(Array),
            scope: expect.stringMatching(/^(GLOBAL|COMPANY|OWN)$/),
          }),
        );
      }));

  it('GET /audit/query with token returns paginated events', () =>
    request(server())
      .get('/api/v1/audit/query?page=1&pageSize=5')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(
          expect.objectContaining({
            items: expect.any(Array),
            total: expect.any(Number),
          }),
        );
      }));

  it('GET /reports/requests/by-status with token returns counts', () =>
    request(server())
      .get('/api/v1/reports/requests/by-status')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(Array.isArray(body)).toBe(true);
      }));

  it('GET /notifications/unread-count with token returns a count', () =>
    request(server())
      .get('/api/v1/notifications/unread-count')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(typeof body.count).toBe('number');
      }));
});
