import type {
  Prisma,
  User as PrismaUser,
  Role as PrismaRole,
  AuthIdentity as PrismaAuthIdentity,
  DocumentType,
} from '../../../../../generated/prisma/client';
import {
  User,
  normalizeDocumentNumber,
} from '../../../domain/entities/user.entity';

type UserWithAuth = PrismaUser & { authIdentity?: PrismaAuthIdentity | null };
type UserRow = UserWithAuth & { userRoles: { role: PrismaRole }[] };

export class UserMapper {
  static toDomain(row: UserWithAuth): User {
    const auth = row.authIdentity ?? null;
    return User.reconstitute({
      id: row.id,
      documentType: row.documentType,
      documentNumber: row.documentNumber,
      companyId: row.companyId,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      passwordHash: auth?.passwordHash ?? null,
      passwordChangedAt: auth?.passwordChangedAt ?? null,
      mustChangePassword: auth?.mustChangePassword ?? false,
      photoUrl: row.photoUrl,
      status: row.status,
      lastAccessAt: auth?.lastLoginAt ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  static toDomainWithRoles(row: UserRow): { user: User; roles: string[] } {
    const user = this.toDomain(row);
    const roles = row.userRoles.map((ur) => ur.role.code);
    return { user, roles };
  }

  /** User table fields only — AuthIdentity is persisted separately. */
  static toPersistence(user: User): Prisma.UserUncheckedCreateInput {
    const props = user.toProps();
    return {
      id: props.id,
      documentType: props.documentType,
      documentNumber: props.documentNumber,
      normalizedDocumentNumber: normalizeDocumentNumber(props.documentNumber),
      companyId: props.companyId,
      firstName: props.firstName,
      lastName: props.lastName,
      email: props.email,
      photoUrl: props.photoUrl,
      status: props.status,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    };
  }

  static toAuthIdentityPersistence(
    user: User,
  ): Prisma.AuthIdentityUncheckedCreateInput | null {
    const props = user.toProps();
    if (!props.passwordHash) return null;
    return {
      userId: props.id,
      passwordHash: props.passwordHash,
      passwordChangedAt: props.passwordChangedAt ?? new Date(),
      mustChangePassword: props.mustChangePassword,
      lastLoginAt: props.lastAccessAt,
    };
  }
}
