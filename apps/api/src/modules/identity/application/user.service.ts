import { Injectable, Inject } from '@nestjs/common';
import {
  UserRepositoryPort,
  USER_REPOSITORY,
} from '../domain/repositories/user.repository.port';
import { User } from '../domain/entities/user.entity';
import { PasswordHasher } from '../infrastructure/services/password-hasher';
import { PrismaService } from '../../../common/infrastructure/prisma/prisma.service';
import {
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../../common/domain/errors/domain-error';
import { AuthenticatedUser } from '../../../common/presentation/decorators/authenticated-user';
import {
  CreateUserDto,
  UpdateUserDto,
  UserResponseDto,
} from '../presentation/dto/auth.dto';

@Injectable()
export class UserService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepositoryPort,
    private readonly passwordHasher: PasswordHasher,
    private readonly prisma: PrismaService,
  ) {}

  async create(
    dto: CreateUserDto,
    actor: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    const companyId = this.resolveCompanyId(
      dto.companyId,
      actor,
      dto.roleCodes,
    );

    const existing = await this.userRepo.findByEmail(dto.email);
    if (existing)
      throw new ConflictError('A user with this email already exists');

    const passwordHash = await this.passwordHasher.hash(dto.password);
    const user = User.create({
      companyId,
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      passwordHash,
    });

    const saved = await this.userRepo.save(user);
    const roleIds = await this.getRoleIdsByCodes(dto.roleCodes);
    await this.userRepo.setUserRoles(saved.id, roleIds);

    const record = await this.userRepo.findByIdWithRoles(saved.id);
    return this.toResponse(record);
  }

  async findAll(
    params: {
      companyId?: string;
      search?: string;
      status?: string;
      page?: number;
      limit?: number;
    },
    actor: AuthenticatedUser,
  ): Promise<{
    items: UserResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const limit = Math.min(params.limit ?? 50, 200);
    const offset = ((params.page ?? 1) - 1) * limit;

    let companyId = params.companyId;
    if (
      actor.roles.includes('COMPANY_ADMIN') &&
      !actor.roles.includes('SYSTEM_ADMIN')
    ) {
      companyId = actor.companyId;
    }

    const result = await this.userRepo.findAll({
      companyId,
      search: params.search,
      status: params.status,
      offset,
      limit,
    });

    return {
      items: result.items.map((r) => this.toResponse(r)),
      total: result.total,
      page: params.page ?? 1,
      limit,
    };
  }

  async findById(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    const record = await this.userRepo.findByIdWithRoles(id);
    if (!record) throw new NotFoundError('User', id);
    this.ensureCompanyScope(actor, record.user.companyId);
    return this.toResponse(record);
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    actor: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    const record = await this.userRepo.findByIdWithRoles(id);
    if (!record) throw new NotFoundError('User', id);
    this.ensureCompanyScope(actor, record.user.companyId);

    if (dto.email && dto.email !== record.user.email) {
      const existing = await this.userRepo.findByEmail(dto.email);
      if (existing && existing.id !== id)
        throw new ConflictError('Email already in use');
    }

    record.user.update(dto);
    await this.userRepo.save(record.user);
    const updated = await this.userRepo.findByIdWithRoles(id);
    return this.toResponse(updated);
  }

  async activate(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    const record = await this.userRepo.findByIdWithRoles(id);
    if (!record) throw new NotFoundError('User', id);
    this.ensureCompanyScope(actor, record.user.companyId);
    record.user.activate();
    await this.userRepo.save(record.user);
    return this.toResponse(await this.userRepo.findByIdWithRoles(id));
  }

  async block(id: string, actor: AuthenticatedUser): Promise<UserResponseDto> {
    if (id === actor.userId)
      throw new BusinessRuleError('Cannot block your own account');
    const record = await this.userRepo.findByIdWithRoles(id);
    if (!record) throw new NotFoundError('User', id);
    this.ensureCompanyScope(actor, record.user.companyId);
    record.user.block();
    await this.userRepo.save(record.user);
    return this.toResponse(await this.userRepo.findByIdWithRoles(id));
  }

  async resetPassword(
    id: string,
    newPassword: string,
    actor: AuthenticatedUser,
  ): Promise<void> {
    const record = await this.userRepo.findByIdWithRoles(id);
    if (!record) throw new NotFoundError('User', id);
    this.ensureCompanyScope(actor, record.user.companyId);
    const hash = await this.passwordHasher.hash(newPassword);
    record.user.setPasswordHash(hash);
    await this.userRepo.save(record.user);
  }

  async updateRoles(
    id: string,
    roleCodes: string[],
    actor: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    const record = await this.userRepo.findByIdWithRoles(id);
    if (!record) throw new NotFoundError('User', id);
    this.ensureCompanyScope(actor, record.user.companyId);

    if (
      !actor.roles.includes('SYSTEM_ADMIN') &&
      roleCodes.includes('SYSTEM_ADMIN')
    ) {
      throw new ForbiddenError('Cannot assign SYSTEM_ADMIN role');
    }

    const roleIds = await this.getRoleIdsByCodes(roleCodes);
    await this.userRepo.setUserRoles(id, roleIds);
    return this.toResponse(await this.userRepo.findByIdWithRoles(id));
  }

  private resolveCompanyId(
    requestedCompanyId: string | undefined,
    actor: AuthenticatedUser,
    roleCodes: string[],
  ): string | null {
    if (
      roleCodes.includes('SYSTEM_ADMIN') &&
      !actor.roles.includes('SYSTEM_ADMIN')
    ) {
      throw new ForbiddenError('Cannot create a SYSTEM_ADMIN user');
    }
    if (actor.roles.includes('SYSTEM_ADMIN')) {
      return requestedCompanyId ?? null;
    }
    if (!actor.companyId)
      throw new BusinessRuleError('Company admin must have a company');
    if (requestedCompanyId && requestedCompanyId !== actor.companyId) {
      throw new ForbiddenError('Cannot create users for another company');
    }
    return actor.companyId;
  }

  private ensureCompanyScope(
    actor: AuthenticatedUser,
    targetCompanyId: string | null,
  ): void {
    if (actor.roles.includes('SYSTEM_ADMIN')) return;
    if (actor.companyId !== targetCompanyId) {
      throw new ForbiddenError('Cannot access users from another company');
    }
  }

  private async getRoleIdsByCodes(codes: string[]): Promise<string[]> {
    const roles = await this.prisma.role.findMany({
      where: { code: { in: codes as any } },
      select: { id: true },
    });
    if (roles.length !== codes.length) {
      throw new BusinessRuleError('One or more roles do not exist');
    }
    return roles.map((r) => r.id);
  }

  private toResponse(record: {
    user: User;
    roles: string[];
    permissions: string[];
  }): UserResponseDto {
    return {
      id: record.user.id,
      companyId: record.user.companyId,
      firstName: record.user.firstName,
      lastName: record.user.lastName,
      email: record.user.email,
      status: record.user.status,
      roles: record.roles,
      permissions: record.permissions,
      lastAccessAt: record.user.lastAccessAt,
      createdAt: record.user.createdAt,
    };
  }
}
