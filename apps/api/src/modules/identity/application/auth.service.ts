import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import {
  UserRepositoryPort,
  RefreshSessionRepositoryPort,
  USER_REPOSITORY,
  REFRESH_SESSION_REPOSITORY,
} from '../domain/repositories/user.repository.port';
import {
  UnauthorizedError,
  NotFoundError,
} from '../../../common/domain/errors/domain-error';
import { JwtPayload } from '../../../common/presentation/guards/jwt-auth.guard';
import { UserResponseDto } from '../presentation/dto/auth.dto';
import { EnvironmentVariables } from '../../../config/env.validation';

interface AuthResult {
  accessToken: string;
  refreshToken: string;
  userResponse: UserResponseDto;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepositoryPort,
    @Inject(REFRESH_SESSION_REPOSITORY)
    private readonly sessionRepo: RefreshSessionRepositoryPort,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  async login(
    email: string,
    password: string,
    meta: { userAgent?: string; ipAddress?: string },
  ): Promise<AuthResult> {
    const record = await this.userRepo.findByEmailWithRoles(email);
    if (!record) throw new UnauthorizedError('Invalid credentials');

    const { user, roles, permissions } = record;
    if (!user.canAuthenticate) {
      throw new UnauthorizedError(
        user.status === 'BLOCKED'
          ? 'Account is blocked'
          : 'Account is not active',
      );
    }

    const { PasswordHasher } =
      await import('../infrastructure/services/password-hasher.js');
    const hasher = new PasswordHasher();
    const valid = await hasher.verify(user.passwordHash, password);
    if (!valid) throw new UnauthorizedError('Invalid credentials');

    user.recordAccess();
    await this.userRepo.save(user);

    const result = await this.issueTokens(
      user.id,
      user.email,
      user.companyId,
      roles,
      permissions,
      meta,
    );
    return { ...result, userResponse: this.toUserResponse(record) };
  }

  async refresh(
    refreshToken: string,
    meta: { userAgent?: string; ipAddress?: string },
  ): Promise<AuthResult> {
    const tokenHash = this.hashToken(refreshToken);
    const session = await this.sessionRepo.findByTokenHash(tokenHash);
    if (!session) throw new UnauthorizedError('Invalid refresh token');
    if (session.revokedAt) throw new UnauthorizedError('Session revoked');
    if (session.expiresAt < new Date())
      throw new UnauthorizedError('Session expired');

    const record = await this.userRepo.findByIdWithRoles(session.userId);
    if (!record) throw new UnauthorizedError('User not found');
    const { user, roles, permissions } = record;
    if (!user.canAuthenticate)
      throw new UnauthorizedError('Account is not active');

    await this.sessionRepo.revoke(session.id);

    const result = await this.issueTokens(
      user.id,
      user.email,
      user.companyId,
      roles,
      permissions,
      meta,
    );
    return { ...result, userResponse: this.toUserResponse(record) };
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    const tokenHash = this.hashToken(refreshToken);
    const session = await this.sessionRepo.findByTokenHash(tokenHash);
    if (session) await this.sessionRepo.revoke(session.id);
  }

  async logoutAll(userId: string): Promise<void> {
    await this.sessionRepo.revokeAllForUser(userId);
  }

  async getMe(userId: string): Promise<UserResponseDto> {
    const record = await this.userRepo.findByIdWithRoles(userId);
    if (!record) throw new NotFoundError('User', userId);
    return this.toUserResponse(record);
  }

  async changePassword(
    userId: string,
    newPassword: string,
  ): Promise<UserResponseDto> {
    const record = await this.userRepo.findByIdWithRoles(userId);
    if (!record) throw new NotFoundError('User', userId);
    const { PasswordHasher } =
      await import('../infrastructure/services/password-hasher.js');
    const hash = await new PasswordHasher().hash(newPassword);
    record.user.setPasswordHash(hash, false);
    await this.userRepo.save(record.user);
    return this.toUserResponse(await this.userRepo.findByIdWithRoles(userId));
  }

  async getSessions(userId: string) {
    return this.sessionRepo.findActiveByUser(userId);
  }

  async deleteSession(userId: string, sessionId: string): Promise<void> {
    const sessions = await this.sessionRepo.findActiveByUser(userId);
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) throw new NotFoundError('Session', sessionId);
    await this.sessionRepo.revoke(sessionId);
  }

  private async issueTokens(
    userId: string,
    email: string,
    companyId: string | null,
    roles: string[],
    permissions: string[],
    meta: { userAgent?: string; ipAddress?: string },
  ): Promise<AuthResult> {
    const payload: JwtPayload = {
      sub: userId,
      email,
      companyId,
      roles,
      permissions,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      expiresIn: this.config.get<string>('JWT_ACCESS_TTL') as any,
    });

    const refreshToken = randomBytes(48).toString('base64url');
    const refreshTtl = this.config.get<string>('JWT_REFRESH_TTL') ?? '7d';
    const expiresAt = this.parseTtl(refreshTtl);

    await this.sessionRepo.create({
      userId,
      tokenHash: this.hashToken(refreshToken),
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken,
      // Este resultado interno se reemplaza inmediatamente por la proyección completa.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      userResponse: { id: userId, email, companyId, roles, permissions } as any,
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseTtl(ttl: string): Date {
    const match = ttl.match(/^(\d+)([smhd])$/);
    if (!match) return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60000,
      h: 3600000,
      d: 86400000,
    };
    return new Date(Date.now() + value * multipliers[unit]);
  }

  private toUserResponse(record: {
    user: {
      id: string;
      companyId: string | null;
      firstName: string;
      lastName: string;
      email: string;
      status: string;
      lastAccessAt: Date | null;
      createdAt: Date;
      photoUrl: string | null;
      mustChangePassword: boolean;
      passwordExpired: boolean;
    };
    roles: string[];
    permissions: string[];
    additionalPermissions: string[];
  }): UserResponseDto {
    const { user, roles, permissions, additionalPermissions } = record;
    return {
      id: user.id,
      companyId: user.companyId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      status: user.status,
      roles,
      permissions,
      additionalPermissions,
      lastAccessAt: user.lastAccessAt,
      createdAt: user.createdAt,
      photoUrl: user.photoUrl,
      mustChangePassword: user.mustChangePassword || user.passwordExpired,
    };
  }
}
