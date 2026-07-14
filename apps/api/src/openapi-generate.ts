/**
 * Generates the OpenAPI specification file (`openapi.json`) without starting the
 * HTTP server. Used by the monorepo `api:openapi` / `api:generate-client`
 * scripts so the same Swagger document that powers `/api/docs` can be fed to
 * `openapi-typescript` to generate the typed client consumed by `apps/web`.
 *
 * Run: `npm run openapi:generate` (from apps/api).
 */
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppModule } from './app.module';

async function generate() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'],
  });

  const config = new DocumentBuilder()
    .setTitle('SGA — Sistema de Gestión de Accesos')
    .setDescription(
      'API REST del Sistema de Gestión de Accesos del Aeropuerto Internacional.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addServer('/api/v1')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  const outPath = resolve(process.cwd(), 'openapi.json');
  writeFileSync(outPath, JSON.stringify(document, null, 2), 'utf-8');

  console.log(`OpenAPI written to ${outPath}`);
  await app.close();
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
