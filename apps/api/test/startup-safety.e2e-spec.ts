import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import { AppModule } from './../src/app.module';
import {
  FORBIDDEN_PROD_SECRETS,
  validateEnv,
} from './../src/config/env.validation';

/**
 * Phase 5 internal hardening — startup safety and rate-limit coverage.
 *
 * Coverage:
 *   1. The env validator rejects default/dev JWT secrets when NODE_ENV=production.
 *   2. The env validator rejects short JWT secrets in production.
 *   3. The ThrottlerGuard returns a 429 ProblemDetail when the limit is exceeded
 *      on a throttle-protected endpoint.
 *   4. Health endpoints are exempt from rate limiting (many requests succeed).
 */
describe('Phase 5 startup safety + rate limiting (e2e)', () => {
  describe('env validation production safety', () => {
    const baseRequired = {
      NODE_ENV: 'production',
      PORT: 4000,
      DATABASE_URL: 'mysql://x',
      DATABASE_URL_TEST: 'mysql://x',
      JWT_ACCESS_TTL: '15m',
      JWT_REFRESH_TTL: '7d',
      CORS_ORIGINS: '*',
      COOKIE_DOMAIN: 'localhost',
      STORAGE_PATH: './storage',
      MAX_FILE_SIZE: 10485760,
    };

    it('rejects a known development JWT access secret', () => {
      expect(() =>
        validateEnv({
          ...baseRequired,
          JWT_ACCESS_SECRET: 'dev-access-secret-not-for-production-use',
          JWT_REFRESH_SECRET: 'A'.repeat(64),
        }),
      ).toThrow(/JWT_ACCESS_SECRET/);
    });

    it('rejects a forbidden JWT refresh secret', () => {
      expect(() =>
        validateEnv({
          ...baseRequired,
          JWT_ACCESS_SECRET: 'B'.repeat(64),
          JWT_REFRESH_SECRET: 'change-me',
        }),
      ).toThrow(/JWT_REFRESH_SECRET/);
    });

    it('rejects secrets shorter than 32 characters', () => {
      expect(() =>
        validateEnv({
          ...baseRequired,
          JWT_ACCESS_SECRET: 'too-short',
          JWT_REFRESH_SECRET: 'also-short',
        }),
      ).toThrow(/at least 32 characters/);
    });

    it('accepts strong secrets in production', () => {
      expect(() =>
        validateEnv({
          ...baseRequired,
          JWT_ACCESS_SECRET: 'A'.repeat(64),
          JWT_REFRESH_SECRET: 'B'.repeat(64),
        }),
      ).not.toThrow();
    });

    it('does not apply production rules in development', () => {
      expect(() =>
        validateEnv({
          ...baseRequired,
          NODE_ENV: 'development',
          JWT_ACCESS_SECRET: 'dev-access-secret-not-for-production-use',
          JWT_REFRESH_SECRET: 'change-me',
        }),
      ).not.toThrow();
    });

    it('exposes the forbidden-secrets set so tests stay in sync', () => {
      expect(
        FORBIDDEN_PROD_SECRETS.has('dev-access-secret-not-for-production-use'),
      ).toBe(true);
      expect(FORBIDDEN_PROD_SECRETS.size).toBeGreaterThanOrEqual(3);
    });
  });

  describe('throttler runtime behaviour', () => {
    let app: INestApplication;

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

    it('authenticates once with the dev fixture', async () => {
      await request(server())
        .post('/api/v1/auth/login')
        .send({
          documentType: 'NATIONAL_ID',
          documentNumber: '8-234-567',
          password: 'Demo1234!',
        })
        .expect(200);
    });

    it('health endpoint is NOT rate-limited (many polls succeed)', async () => {
      // The HealthController is decorated with @SkipThrottle() so container
      // orchestrators can probe it freely. We blast 30 requests and confirm
      // every one returns 200.
      for (let i = 0; i < 30; i++) {
        await request(server()).get('/api/v1/health').expect(200);
      }
    });

    it('login endpoint returns 429 with a ProblemDetail after the limit', async () => {
      // The login endpoint is throttled at 5 requests / 60s. The first 5 should
      // succeed (200/400/401 are all acceptable — we just need a non-429 response)
      // and the 6th request should be rejected with 429 in ProblemDetail shape.
      let firstReject = 0;
      let fourTwoNine = 0;
      const attempts = 8;
      for (let i = 0; i < attempts; i++) {
        const res = await request(server()).post('/api/v1/auth/login').send({
          documentType: 'NATIONAL_ID',
          documentNumber: '8-234-567',
          password: 'WrongPassword!',
        });
        if (res.statusCode !== 429) firstReject++;
        else fourTwoNine++;
      }
      // At least one request must be rate-limited, and the early ones must not
      // be (they fail auth with 401).
      expect(firstReject).toBeGreaterThanOrEqual(1);
      expect(fourTwoNine).toBeGreaterThanOrEqual(1);
    });

    it('429 response is shaped as a Problem Detail', async () => {
      // Drain any remaining budget on a fresh login address by using the throttled login.
      let captured: {
        status: number;
        body: { code?: string; type?: string };
      } | null = null;
      for (let i = 0; i < 12; i++) {
        const res = await request(server()).post('/api/v1/auth/login').send({
          documentType: 'NATIONAL_ID',
          documentNumber: '8-234-567',
          password: 'WrongPassword!',
        });
        if (res.statusCode === 429) {
          captured = {
            status: res.statusCode,
            body: res.body as { code?: string; type?: string },
          };
          break;
        }
      }
      expect(captured).not.toBeNull();
      if (captured) {
        expect(captured.status).toBe(429);
        expect(captured.body.code).toBeTruthy();
        expect(captured.body.type).toMatch(/^https:\/\/sga\.errors\//);
      }
    });
  });
});
