import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { EnvironmentVariables, validateEnv } from './config/env.validation';
import { PrismaModule } from './common/infrastructure/prisma/prisma.module';
import { HealthController } from './presentation/health.controller';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { IdentityModule } from './modules/identity/identity.module';
import { CatalogsModule } from './modules/catalogs/catalogs.module';
import { PeopleModule } from './modules/people/people.module';
import { AuthorizedSignersModule } from './modules/authorized-signers/authorized-signers.module';
import { RequestsModule } from './modules/requests/requests.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { CredentialsModule } from './modules/credentials/credentials.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AuditModule } from './modules/audit/audit.module';
import { SettingsModule } from './modules/settings/settings.module';

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
    PeopleModule,
    AuthorizedSignersModule,
    RequestsModule,
    DocumentsModule,
    ReviewsModule,
    CredentialsModule,
    NotificationsModule,
    AuditModule,
    SettingsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
