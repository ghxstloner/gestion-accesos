import { User } from '../entities/user.entity';

export interface UserWithRoles {
  user: User;
  roles: string[];
  permissions: string[];
  additionalPermissions: string[];
}

export interface UserRepositoryPort {
  findById(id: string): Promise<User | null>;
  findByIdWithRoles(id: string): Promise<UserWithRoles | null>;
  findByEmail(email: string): Promise<User | null>;
  findByEmailWithRoles(email: string): Promise<UserWithRoles | null>;
  findAll(params?: {
    companyId?: string;
    search?: string;
    status?: string;
    offset?: number;
    limit?: number;
  }): Promise<{ items: UserWithRoles[]; total: number }>;
  save(user: User): Promise<User>;
  setUserRoles(userId: string, roleIds: string[]): Promise<void>;
  setUserPermissions(userId: string, permissionCodes: string[]): Promise<void>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface RefreshSessionRepositoryPort {
  create(input: {
    userId: string;
    tokenHash: string;
    userAgent?: string;
    ipAddress?: string;
    expiresAt: Date;
  }): Promise<{ id: string }>;
  findByTokenHash(tokenHash: string): Promise<{
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    revokedAt: Date | null;
  } | null>;
  revoke(id: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
  findActiveByUser(userId: string): Promise<
    Array<{
      id: string;
      userAgent: string | null;
      ipAddress: string | null;
      expiresAt: Date;
      createdAt: Date;
    }>
  >;
}

export const REFRESH_SESSION_REPOSITORY = Symbol('REFRESH_SESSION_REPOSITORY');
