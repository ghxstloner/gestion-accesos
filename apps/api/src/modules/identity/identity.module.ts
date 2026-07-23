import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './presentation/controllers/auth.controller';
import { UsersController } from './presentation/controllers/users.controller';
import { AuthService } from './application/auth.service';
import { UserService } from './application/user.service';
import { PasswordHasher } from './infrastructure/services/password-hasher';
import {
  USER_REPOSITORY,
  REFRESH_SESSION_REPOSITORY,
} from './domain/repositories/user.repository.port';
import {
  UserPrismaRepository,
  RefreshSessionPrismaRepository,
} from './infrastructure/persistence/repositories/user.repository.prisma';
import { JwtAuthGuard } from '../../common/presentation/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/presentation/guards/permissions.guard';
import type { StringValue } from 'ms';

/**
 * Default TTL of the access token when `JWT_ACCESS_TTL` is missing or empty.
 * Kept in sync with the format expected by `jsonwebtoken` (`ms.StringValue`).
 */
const DEFAULT_JWT_ACCESS_TTL: StringValue = '15m';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_ACCESS_SECRET,
        signOptions: {
          expiresIn: (process.env.JWT_ACCESS_TTL as StringValue | undefined) ?? DEFAULT_JWT_ACCESS_TTL,
        },
      }),
    }),
  ],
  controllers: [AuthController, UsersController],
  providers: [
    AuthService,
    UserService,
    PasswordHasher,
    { provide: USER_REPOSITORY, useClass: UserPrismaRepository },
    {
      provide: REFRESH_SESSION_REPOSITORY,
      useClass: RefreshSessionPrismaRepository,
    },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [AuthService, UserService, USER_REPOSITORY, PasswordHasher],
})
export class IdentityModule {}
