import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import { AppModule } from './../src/app.module';

describe('HealthController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/health (GET)', () => {
    // `INestApplication.getHttpServer()` is typed as `any` in
    // @nestjs/common (see http-server.interface.d.ts); the cast below is the
    // most precise we can express at this boundary without lying.
    const server = app.getHttpServer() as Server;
    const expectedTimestamp = expect.any(String) as unknown;
    return request(server)
      .get('/health')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          status: 'ok',
          timestamp: expectedTimestamp,
        });
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
