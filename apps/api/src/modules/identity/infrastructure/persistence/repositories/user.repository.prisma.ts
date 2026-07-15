import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../common/infrastructure/prisma/prisma.service';
import { User } from '../../../domain/entities/user.entity';
import {
  UserRepositoryPort,
  UserWithRoles,
  RefreshSessionRepositoryPort,
} from '../../../domain/repositories/user.repository.port';
import { UserMapper } from '../mappers/user.mapper';
import { ROLE_PERMISSIONS } from '../../../domain/permissions';

@Injectable()
export class UserPrismaRepository implements UserRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  private computePermissions(roles: string[]): string[] {
    const perms = new Set<string>();
    for (const role of roles) {
      const rolePerms = ROLE_PERMISSIONS[role];
      if (rolePerms) rolePerms.forEach((p) => perms.add(p));
    }
    return [...perms];
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row ? UserMapper.toDomain(row) : null;
  }

  async findByIdWithRoles(id: string): Promise<UserWithRoles | null> {
    const row = await this.prisma.user.findUnique({
      where: { id },
      include: {
        userRoles: { include: { role: true } },
        userPermissions: { include: { permission: true } },
      },
    });
    if (!row) return null;
    const { user, roles } = UserMapper.toDomainWithRoles(row);
    const additionalPermissions = row.userPermissions.map(
      (item) => item.permission.code,
    );
    return {
      user,
      roles,
      additionalPermissions,
      permissions: [
        ...new Set([
          ...this.computePermissions(roles),
          ...additionalPermissions,
        ]),
      ],
    };
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    return row ? UserMapper.toDomain(row) : null;
  }

  async findByEmailWithRoles(email: string): Promise<UserWithRoles | null> {
    const row = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        userRoles: { include: { role: true } },
        userPermissions: { include: { permission: true } },
      },
    });
    if (!row) return null;
    const { user, roles } = UserMapper.toDomainWithRoles(row);
    const additionalPermissions = row.userPermissions.map(
      (item) => item.permission.code,
    );
    return {
      user,
      roles,
      additionalPermissions,
      permissions: [
        ...new Set([
          ...this.computePermissions(roles),
          ...additionalPermissions,
        ]),
      ],
    };
  }

  async findAll(params?: {
    companyId?: string;
    search?: string;
    status?: string;
    offset?: number;
    limit?: number;
  }): Promise<{ items: UserWithRoles[]; total: number }> {
    const where: Record<string, unknown> = {};
    if (params?.companyId) where.companyId = params.companyId;
    if (params?.status) where.status = params.status;
    if (params?.search) {
      where.OR = [
        { firstName: { contains: params.search } },
        { lastName: { contains: params.search } },
        { email: { contains: params.search } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: params?.offset ?? 0,
        take: params?.limit ?? 50,
        orderBy: { createdAt: 'desc' },
        include: {
          userRoles: { include: { role: true } },
          userPermissions: { include: { permission: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const items = rows.map((row) => {
      const { user, roles } = UserMapper.toDomainWithRoles(row);
      const additionalPermissions = row.userPermissions.map(
        (item) => item.permission.code,
      );
      return {
        user,
        roles,
        additionalPermissions,
        permissions: [
          ...new Set([
            ...this.computePermissions(roles),
            ...additionalPermissions,
          ]),
        ],
      };
    });

    return { items, total };
  }

  async save(user: User): Promise<User> {
    const data = UserMapper.toPersistence(user);
    const row = await this.prisma.user.upsert({
      where: { id: user.id },
      create: data,
      update: {
        companyId: data.companyId,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        passwordHash: data.passwordHash,
        passwordChangedAt: data.passwordChangedAt,
        mustChangePassword: data.mustChangePassword,
        photoUrl: data.photoUrl,
        status: data.status,
        lastAccessAt: data.lastAccessAt,
      },
    });
    return UserMapper.toDomain(row);
  }

  async setUserRoles(userId: string, roleIds: string[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId } }),
      this.prisma.userRole.createMany({
        data: roleIds.map((roleId) => ({ userId, roleId })),
        skipDuplicates: true,
      }),
    ]);
  }

  async setUserPermissions(
    userId: string,
    permissionCodes: string[],
  ): Promise<void> {
    const permissions = await this.prisma.permission.findMany({
      where: { code: { in: permissionCodes } },
      select: { id: true },
    });
    await this.prisma.$transaction([
      this.prisma.userPermission.deleteMany({ where: { userId } }),
      this.prisma.userPermission.createMany({
        data: permissions.map((permission) => ({
          userId,
          permissionId: permission.id,
        })),
        skipDuplicates: true,
      }),
    ]);
  }
}

@Injectable()
export class RefreshSessionPrismaRepository implements RefreshSessionRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    userId: string;
    tokenHash: string;
    userAgent?: string;
    ipAddress?: string;
    expiresAt: Date;
  }): Promise<{ id: string }> {
    const row = await this.prisma.refreshSession.create({
      data: {
        userId: input.userId,
        tokenHash: input.tokenHash,
        userAgent: input.userAgent,
        ipAddress: input.ipAddress,
        expiresAt: input.expiresAt,
      },
    });
    return { id: row.id };
  }

  async findByTokenHash(tokenHash: string) {
    return this.prisma.refreshSession.findUnique({ where: { tokenHash } });
  }

  async revoke(id: string): Promise<void> {
    await this.prisma.refreshSession.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async findActiveByUser(userId: string) {
    return this.prisma.refreshSession.findMany({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }
}
