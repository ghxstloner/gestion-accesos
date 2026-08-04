import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { EnvironmentVariables, NodeEnv } from './config/env.validation';
import { EmptyStringToUndefinedPipe } from './common/presentation/pipes/empty-string-to-undefined.pipe';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService<EnvironmentVariables, true>);
  const env = config.get<NodeEnv>('NODE_ENV') ?? NodeEnv.Development;
  const port = config.get<number>('PORT') ?? 4000;

  app.setGlobalPrefix('api/v1');

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(compression());
  app.use(cookieParser());

  const origins = (
    config.get<string>('CORS_ORIGINS') ?? 'http://localhost:3000'
  )
    .split(',')
    .map((o) => o.trim());
  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  });

  // Globals are registered in AppModule via APP_* tokens so they also apply
  // to integration/e2e tests. Here we only add the order-sensitive
  // EmptyStringToUndefinedPipe BEFORE the global ValidationPipe.
  app.useGlobalPipes(new EmptyStringToUndefinedPipe());

  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SGA — Sistema de Gestión de Accesos')
    .setDescription(
      'API REST del Sistema de Gestión de Accesos del Aeropuerto Internacional',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(port);
  Logger.log(
    `SGA API running on http://localhost:${port}/api/v1 (${env})`,
    'Bootstrap',
  );
  Logger.log(`Swagger UI at http://localhost:${port}/api/docs`, 'Bootstrap');
}

void bootstrap();
