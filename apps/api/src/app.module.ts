import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { validateEnv } from './config/env.validation.js';
import { PrismaModule } from './common/infrastructure/prisma/prisma.module.js';
import { HealthController } from './presentation/health.controller.js';
import { GlobalExceptionFilter } from './common/presentation/filters/global-exception.filter.js';
import { CorrelationIdInterceptor } from './common/presentation/interceptors/correlation-id.interceptor.js';
import { LoggingInterceptor } from './common/presentation/interceptors/logging.interceptor.js';
import { SgaThrottlerGuard } from './common/presentation/guards/sga-throttler.guard.js';
import { OrganizationsModule } from './modules/organizations/organizations.module.js';
import { IdentityModule } from './modules/identity/identity.module.js';
import { CatalogsModule } from './modules/catalogs/catalogs.module.js';
import { AuthorizedSignersModule } from './modules/authorized-signers/authorized-signers.module.js';
import { RequestsModule } from './modules/requests/requests.module.js';
import { DocumentsModule } from './modules/documents/documents.module.js';
import { ReviewsModule } from './modules/reviews/reviews.module.js';
import { CredentialsModule } from './modules/credentials/credentials.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { SettingsModule } from './modules/settings/settings.module.js';
import { WorkflowsModule } from './modules/workflows/workflows.module.js';
import { AlertsModule } from './modules/alerts/alerts.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { DashboardModule } from './modules/dashboard/dashboard.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    // Rate limiter. Limits are configurable through the THROTTLE_* environment
    // variables defined in env.validation.ts so QA/prod operators can tune
    // them without a code change. Three named buckets allow finer-grained
    // overrides per route: `short` (brute-force), `medium` (mutations),
    // `long` (general traffic).
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          name: 'short',
          ttl: config.get<number>('THROTTLE_SHORT_TTL', 1_000),
          limit: config.get<number>('THROTTLE_SHORT_LIMIT', 3),
        },
        {
          name: 'medium',
          ttl: config.get<number>('THROTTLE_MEDIUM_TTL', 10_000),
          limit: config.get<number>('THROTTLE_MEDIUM_LIMIT', 20),
        },
        {
          name: 'long',
          ttl: config.get<number>('THROTTLE_LONG_TTL', 60_000),
          limit: config.get<number>('THROTTLE_LONG_LIMIT', 100),
        },
      ],
    }),
    PrismaModule,
    ScheduleModule.forRoot(),
    OrganizationsModule,
    IdentityModule,
    CatalogsModule,
    AuthorizedSignersModule,
    RequestsModule,
    DocumentsModule,
    ReviewsModule,
    CredentialsModule,
    NotificationsModule,
    AuditModule,
    SettingsModule,
    WorkflowsModule,
    AlertsModule,
    ReportsModule,
    DashboardModule,
  ],
  controllers: [HealthController],
  providers: [
    // Global exception handling, correlation/logging, validation pipe and
    // throttler guard are all registered here (instead of via useGlobal* in
    // bootstrap) so they are also visible to integration/e2e tests.
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: CorrelationIdInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    },
    { provide: APP_GUARD, useClass: SgaThrottlerGuard },
  ],
})
export class AppModule {}
