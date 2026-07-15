import type {
  Prisma,
  User as PrismaUser,
  Role as PrismaRole,
} from '../../../../../generated/prisma/client';
import { User } from '../../../domain/entities/user.entity';

type UserRow = PrismaUser & { userRoles: { role: PrismaRole }[] };

export class UserMapper {
  static toDomain(row: PrismaUser): User {
    return User.reconstitute({
      id: row.id,
      companyId: row.companyId,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      passwordHash: row.passwordHash,
      passwordChangedAt: row.passwordChangedAt,
      mustChangePassword: row.mustChangePassword,
      photoUrl: row.photoUrl,
      status: row.status,
      lastAccessAt: row.lastAccessAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  static toDomainWithRoles(row: UserRow): { user: User; roles: string[] } {
    const user = this.toDomain(row);
    const roles = row.userRoles.map((ur) => ur.role.code);
    return { user, roles };
  }

  static toPersistence(user: User): Prisma.UserUncheckedCreateInput {
    const props = user.toProps();
    return {
      id: props.id,
      companyId: props.companyId,
      firstName: props.firstName,
      lastName: props.lastName,
      email: props.email,
      passwordHash: props.passwordHash,
      passwordChangedAt: props.passwordChangedAt,
      mustChangePassword: props.mustChangePassword,
      photoUrl: props.photoUrl,
      status: props.status,
      lastAccessAt: props.lastAccessAt,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    };
  }
}
