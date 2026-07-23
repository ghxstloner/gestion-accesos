import { Injectable, Inject } from '@nestjs/common';
import {
  AUTHORIZED_SIGNER_REPOSITORY,
  AuthorizedSignerRepositoryPort,
} from '../domain/repositories/authorized-signer.repository.port';
import { CompanyAuthorizedSigner } from '../domain/entities/authorized-signer.entity';
import {
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../../common/domain/errors/domain-error';
import { canReadAcrossCompanies } from '../../../common/domain/access-scope';
import { AuthenticatedUser } from '../../../common/presentation/decorators/authenticated-user';
import { PrismaService } from '../../../common/infrastructure/prisma/prisma.service';
import {
  AuthorizedSignerResponseDto,
  CreateAuthorizedSignerDto,
  RevokeSignerDto,
  UpdateAuthorizedSignerDto,
} from '../presentation/dto/authorized-signer.dto';
import { AuthorizedSignerPresenter } from '../presentation/presenters/authorized-signer.presenter';

@Injectable()
export class AuthorizedSignerService {
  constructor(
    @Inject(AUTHORIZED_SIGNER_REPOSITORY)
    private readonly signerRepo: AuthorizedSignerRepositoryPort,
    private readonly prisma: PrismaService,
  ) {}

  async create(
    dto: CreateAuthorizedSignerDto,
    actor: AuthenticatedUser,
  ): Promise<AuthorizedSignerResponseDto> {
    if (!actor.companyId) throw new ForbiddenError('User has no company');
    const companyId = this.resolveCompanyId(actor);

    // Validate signer user exists and belongs to the same company.
    const user = await this.prisma.user.findUnique({
      where: { id: dto.signerUserId },
      select: { id: true, companyId: true, status: true },
    });
    if (!user) throw new NotFoundError('User', dto.signerUserId);
    if (user.companyId !== companyId) {
      throw new ForbiddenError(
        'Signer user does not belong to the same company',
      );
    }

    const exists = await this.signerRepo.existsForSignerUserActive(
      dto.signerUserId,
    );
    if (exists) {
      throw new ConflictError(
        'This user already has an ACTIVE authorized signer record',
      );
    }

    const signer = CompanyAuthorizedSigner.create({
      companyId,
      signerUserId: dto.signerUserId,
      position: dto.position,
      validFrom: new Date(dto.validFrom),
      validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
      authorizationDocumentId: dto.authorizationDocumentId ?? null,
      signatureFileId: dto.signatureFileId ?? null,
    });
    const saved = await this.signerRepo.save(signer);
    return AuthorizedSignerPresenter.toResponse(saved);
  }

  async findAll(
    params: {
      companyId?: string;
      signerUserId?: string;
      status?: string;
      page?: number;
      limit?: number;
    },
    actor: AuthenticatedUser,
  ): Promise<{
    items: AuthorizedSignerResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const limit = Math.min(params.limit ?? 50, 200);
    const offset = ((params.page ?? 1) - 1) * limit;

    let companyId = params.companyId;
    if (!canReadAcrossCompanies(actor.roles)) {
      companyId = actor.companyId ?? undefined;
    }

    const result = await this.signerRepo.findAll({
      companyId,
      signerUserId: params.signerUserId,
      status: params.status,
      offset,
      limit,
    });
    return {
      items: result.items.map((s) => AuthorizedSignerPresenter.toResponse(s)),
      total: result.total,
      page: params.page ?? 1,
      limit,
    };
  }

  async findById(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<AuthorizedSignerResponseDto> {
    const signer = await this.signerRepo.findById(id);
    if (!signer) throw new NotFoundError('AuthorizedSigner', id);
    if (!canReadAcrossCompanies(actor.roles)) {
      this.ensureCompanyScope(actor, signer.companyId);
    }
    return AuthorizedSignerPresenter.toResponse(signer);
  }

  async update(
    id: string,
    dto: UpdateAuthorizedSignerDto,
    actor: AuthenticatedUser,
  ): Promise<AuthorizedSignerResponseDto> {
    const signer = await this.signerRepo.findById(id);
    if (!signer) throw new NotFoundError('AuthorizedSigner', id);
    this.ensureCompanyScope(actor, signer.companyId);
    signer.update({
      position: dto.position,
      validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
      validUntil:
        dto.validUntil === undefined
          ? undefined
          : dto.validUntil
            ? new Date(dto.validUntil)
            : null,
      authorizationDocumentId: dto.authorizationDocumentId,
      signatureFileId: dto.signatureFileId,
    });
    const saved = await this.signerRepo.save(signer);
    return AuthorizedSignerPresenter.toResponse(saved);
  }

  async activate(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<AuthorizedSignerResponseDto> {
    const signer = await this.signerRepo.findById(id);
    if (!signer) throw new NotFoundError('AuthorizedSigner', id);
    this.ensureCompanyScope(actor, signer.companyId);
    signer.activate();
    const saved = await this.signerRepo.save(signer);
    return AuthorizedSignerPresenter.toResponse(saved);
  }

  async revoke(
    id: string,
    dto: RevokeSignerDto,
    actor: AuthenticatedUser,
  ): Promise<AuthorizedSignerResponseDto> {
    const signer = await this.signerRepo.findById(id);
    if (!signer) throw new NotFoundError('AuthorizedSigner', id);
    this.ensureCompanyScope(actor, signer.companyId);
    signer.revoke(actor.userId, dto.reason);
    const saved = await this.signerRepo.save(signer);
    return AuthorizedSignerPresenter.toResponse(saved);
  }

  /** Used by other modules to look up a signer and apply scoping. */
  async getActiveSignerForRequest(
    signerId: string,
    companyId: string | null,
  ): Promise<CompanyAuthorizedSigner> {
    const signer = await this.signerRepo.findById(signerId);
    if (!signer) throw new NotFoundError('AuthorizedSigner', signerId);
    if (companyId !== null && signer.companyId !== companyId) {
      throw new ForbiddenError('Signer belongs to another company');
    }
    if (signer.cannotAuthorize) {
      throw new BusinessRuleError(
        `Signer ${signerId} cannot authorize new requests (status: ${signer.effectiveStatus})`,
      );
    }
    return signer;
  }

  private resolveCompanyId(actor: AuthenticatedUser): string {
    if (!actor.companyId) {
      if (actor.roles.includes('SYSTEM_ADMIN')) {
        throw new BusinessRuleError(
          'SYSTEM_ADMIN must specify companyId explicitly',
        );
      }
      throw new ForbiddenError('User has no company');
    }
    return actor.companyId;
  }

  private ensureCompanyScope(
    actor: AuthenticatedUser,
    targetCompanyId: string,
  ): void {
    if (actor.roles.includes('SYSTEM_ADMIN')) return;
    if (actor.companyId !== targetCompanyId) {
      throw new ForbiddenError('Cannot access signers from another company');
    }
  }
}
