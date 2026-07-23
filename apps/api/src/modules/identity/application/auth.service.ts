import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import * as argon2 from 'argon2';
import { DocumentType } from '../../../generated/prisma/index.js';
import type { Prisma } from '../../../generated/prisma/index.js';
import { PrismaService } from '../../../common/infrastructure/prisma/prisma.service.js';
import {
  UnauthorizedError,
  NotFoundError,
  ValidationError,
} from '../../../common/domain/errors/domain-error.js';
import { UserResponseDto } from '../presentation/dto/auth.dto.js';
import { EnvironmentVariables } from '../../../config/env.validation.js';

interface AuthResult {
  accessToken: string;
  refreshToken: string;
  userResponse: UserResponseDto;
}

/**
 * Reusable Prisma payload shape for User rows loaded with its auth identity,
 * roles, and direct permission grants. Used to give strong typing to the
 * multiple `prisma.user.findUnique({...})` call sites in this service.
 */
/**
 * Minimal subset of a `User` row needed by `toUserResponse`. The actual
 * loader may include more relations (authIdentity, roles, permissions, …) but
 * the response builder only consumes the fields below.
 */
type UserForResponsePayload = Prisma.UserGetPayload<{
  include: {
    userRoles?: { include: { role: true } };
    userPermissions?: { include: { permission: true } };
  };
}>;

/**
 * Payload embedded in a password-recovery JWT. The `type` discriminator
 * guards against reusing access/refresh tokens as recovery tokens.
 */
interface PasswordResetPayload {
  sub: string;
  type: 'password_reset';
}

export function normalizeDocumentNumber(doc: string): string {
  return doc.trim().toUpperCase();
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  async loginByDocument(
    documentType: DocumentType,
    documentNumber: string,
    password: string,
    meta: { userAgent?: string; ipAddress?: string },
  ): Promise<AuthResult> {
    const normalizedDoc = normalizeDocumentNumber(documentNumber);

    const user = await this.prisma.user.findUnique({
      where: {
        documentType_normalizedDocumentNumber: {
          documentType,
          normalizedDocumentNumber: normalizedDoc,
        },
      },
      include: {
        authIdentity: true,
        userRoles: { include: { role: true } },
        userPermissions: { include: { permission: true } },
      },
    });

    if (!user || !user.authIdentity) {
      throw new UnauthorizedError('Invalid document or password');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedError(
        user.status === 'BLOCKED'
          ? 'Account is blocked'
          : 'Account is not active',
      );
    }

    const { authIdentity } = user;

    // Check account lockout
    if (authIdentity.lockedUntil && authIdentity.lockedUntil > new Date()) {
      throw new UnauthorizedError(
        'Account is temporarily locked due to multiple failed login attempts',
      );
    }

    // Verify password with Argon2id
    const valid = await argon2.verify(authIdentity.passwordHash, password);

    if (!valid) {
      const failedLoginAttempts = authIdentity.failedLoginAttempts + 1;
      let lockedUntil: Date | null = null;
      if (failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
      }

      await this.prisma.authIdentity.update({
        where: { id: authIdentity.id },
        data: { failedLoginAttempts, lockedUntil },
      });

      // Audit Log for failed login
      await this.prisma.auditEvent.create({
        data: {
          actorUserId: user.id,
          actorCompanyId: user.companyId,
          action: 'user.login_failed',
          aggregateType: 'User',
          aggregateId: user.id,
          metadata: {
            reason: 'Invalid password',
            attempts: failedLoginAttempts,
          },
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        },
      });

      throw new UnauthorizedError('Invalid document or password');
    }

    // Reset failed attempts & record last login time
    await this.prisma.authIdentity.update({
      where: { id: authIdentity.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    // Audit Log for successful login
    await this.prisma.auditEvent.create({
      data: {
        actorUserId: user.id,
        actorCompanyId: user.companyId,
        action: 'user.login_success',
        aggregateType: 'User',
        aggregateId: user.id,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });

    const roles = user.userRoles.map((ur) => ur.role.code);
    const permissions = user.userPermissions.map((up) => up.permission.code);

    const result = await this.issueTokens(
      user.id,
      user.companyId,
      roles,
      permissions,
      meta,
    );
    return {
      ...result,
      userResponse: this.toUserResponse(user, roles, permissions),
    };
  }

  async requestPasswordRecovery(
    documentType: DocumentType,
    documentNumber: string,
    meta: { userAgent?: string; ipAddress?: string },
  ): Promise<{ message: string }> {
    const genericResponse = {
      message:
        'Si la cuenta tiene un correo electrónico verificado, se enviarán las instrucciones de recuperación.',
    };

    const normalizedDoc = normalizeDocumentNumber(documentNumber);

    const user = await this.prisma.user.findUnique({
      where: {
        documentType_normalizedDocumentNumber: {
          documentType,
          normalizedDocumentNumber: normalizedDoc,
        },
      },
      include: { authIdentity: true },
    });

    // Check conditions: User exists, active status, email exists & verified, authIdentity exists
    if (
      !user ||
      user.status !== 'ACTIVE' ||
      !user.email ||
      !user.emailVerifiedAt ||
      !user.authIdentity
    ) {
      // Audit log generic attempt without exposing user details
      await this.prisma.auditEvent.create({
        data: {
          action: 'user.password_recovery_requested',
          aggregateType: 'User',
          aggregateId: user?.id ?? null,
          metadata: { documentType, status: 'ignored_unverified_or_not_found' },
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        },
      });
      return genericResponse;
    }

    // Invalidate previous challenges
    await this.prisma.passwordRecoveryChallenge.updateMany({
      where: { userId: user.id, consumedAt: null, invalidatedAt: null },
      data: { invalidatedAt: new Date() },
    });

    // Generate 6-digit code and hash it
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = await argon2.hash(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const ipHash = meta.ipAddress
      ? createHash('sha256').update(meta.ipAddress).digest('hex')
      : null;

    await this.prisma.passwordRecoveryChallenge.create({
      data: {
        userId: user.id,
        codeHash,
        expiresAt,
        requestedIpHash: ipHash,
      },
    });

    await this.prisma.auditEvent.create({
      data: {
        actorUserId: user.id,
        action: 'user.password_recovery_code_generated',
        aggregateType: 'User',
        aggregateId: user.id,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });

    return genericResponse;
  }

  async verifyPasswordRecoveryCode(
    documentType: DocumentType,
    documentNumber: string,
    code: string,
  ): Promise<{ recoveryToken: string }> {
    const normalizedDoc = normalizeDocumentNumber(documentNumber);

    const user = await this.prisma.user.findUnique({
      where: {
        documentType_normalizedDocumentNumber: {
          documentType,
          normalizedDocumentNumber: normalizedDoc,
        },
      },
    });

    if (!user) throw new ValidationError('Invalid or expired recovery code');

    const challenge = await this.prisma.passwordRecoveryChallenge.findFirst({
      where: {
        userId: user.id,
        consumedAt: null,
        invalidatedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge || challenge.attempts >= challenge.maxAttempts) {
      throw new ValidationError('Invalid or expired recovery code');
    }

    const validCode = await argon2.verify(challenge.codeHash, code);
    if (!validCode) {
      await this.prisma.passwordRecoveryChallenge.update({
        where: { id: challenge.id },
        data: { attempts: challenge.attempts + 1 },
      });
      throw new ValidationError('Invalid or expired recovery code');
    }

    // Mark challenge as consumed
    await this.prisma.passwordRecoveryChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });

    // Emit a short-lived single-purpose recovery token
    const recoveryToken = this.jwtService.sign(
      { sub: user.id, type: 'password_reset' },
      { expiresIn: '15m' },
    );

    return { recoveryToken };
  }

  async resetPasswordWithToken(
    recoveryToken: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    let payload: PasswordResetPayload;
    try {
      payload = this.jwtService.verify<PasswordResetPayload>(recoveryToken);
    } catch {
      throw new ValidationError('Invalid or expired recovery token');
    }

    if (payload.type !== 'password_reset' || !payload.sub) {
      throw new ValidationError('Invalid recovery token payload');
    }

    const userId = payload.sub;
    const newPasswordHash = await argon2.hash(newPassword);

    await this.prisma.authIdentity.update({
      where: { userId },
      data: {
        passwordHash: newPasswordHash,
        passwordChangedAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    // Invalidate refresh sessions
    await this.prisma.refreshSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // Audit log
    await this.prisma.auditEvent.create({
      data: {
        actorUserId: userId,
        action: 'user.password_reset_success',
        aggregateType: 'User',
        aggregateId: userId,
      },
    });

    return { message: 'Contraseña actualizada exitosamente.' };
  }

  async refresh(
    refreshToken: string,
    meta: { userAgent?: string; ipAddress?: string },
  ): Promise<AuthResult> {
    const tokenHash = this.hashToken(refreshToken);
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash },
    });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
      include: {
        userRoles: { include: { role: true } },
        userPermissions: { include: { permission: true } },
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedError('Account is not active');
    }

    await this.prisma.refreshSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    const roles = user.userRoles.map((ur) => ur.role.code);
    const permissions = user.userPermissions.map((up) => up.permission.code);

    const result = await this.issueTokens(
      user.id,
      user.companyId,
      roles,
      permissions,
      meta,
    );
    return {
      ...result,
      userResponse: this.toUserResponse(user, roles, permissions),
    };
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshSession.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async getMe(userId: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: { include: { role: true } },
        userPermissions: { include: { permission: true } },
      },
    });
    if (!user) throw new NotFoundError('User', userId);
    const roles = user.userRoles.map((ur) => ur.role.code);
    const permissions = user.userPermissions.map((up) => up.permission.code);
    return this.toUserResponse(user, roles, permissions);
  }

  private async issueTokens(
    userId: string,
    companyId: string | null,
    roles: string[],
    permissions: string[],
    meta: { userAgent?: string; ipAddress?: string },
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // MINIMAL JWT PAYLOAD (no documentNumber, no password, no sensitive info)
    const payload = {
      sub: userId,
      companyId,
      roles,
      permissions,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(refreshToken);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.prisma.refreshSession.create({
      data: {
        userId,
        tokenHash,
        userAgent: meta.userAgent ?? null,
        ipAddress: meta.ipAddress ?? null,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private toUserResponse(
    user: UserForResponsePayload,
    roles: string[],
    permissions: string[],
  ): UserResponseDto {
    return {
      id: user.id,
      documentType: user.documentType,
      documentNumber: user.documentNumber,
      companyId: user.companyId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      status: user.status,
      roles,
      permissions,
      createdAt: user.createdAt,
      photoUrl: user.photoUrl,
    };
  }
}
