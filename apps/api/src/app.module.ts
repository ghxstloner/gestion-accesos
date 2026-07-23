import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { validateEnv } from './config/env.validation.js';
import { PrismaModule } from './common/infrastructure/prisma/prisma.module.js';
import { HealthController } from './presentation/health.controller.js';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 3 },
      { name: 'medium', ttl: 10000, limit: 20 },
      { name: 'long', ttl: 60000, limit: 100 },
    ]),
    PrismaModule,
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
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
