import { CompanyAuthorizedSigner } from '../../domain/entities/authorized-signer.entity';
import { AuthorizedSignerResponseDto } from '../dto/authorized-signer.dto';

export class AuthorizedSignerPresenter {
  static toResponse(
    signer: CompanyAuthorizedSigner,
  ): AuthorizedSignerResponseDto {
    const p = signer.toProps();
    return {
      id: p.id,
      companyId: p.companyId,
      signerUserId: p.signerUserId,
      position: p.position,
      validFrom: p.validFrom,
      validUntil: p.validUntil,
      authorizationDocumentId: p.authorizationDocumentId,
      signatureFileId: p.signatureFileId,
      status: p.status,
      effectiveStatus: signer.effectiveStatus,
      revokedAt: p.revokedAt,
      revokedBy: p.revokedBy,
      revocationReason: p.revocationReason,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }
}
