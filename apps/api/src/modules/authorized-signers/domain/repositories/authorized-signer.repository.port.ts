import { CompanyAuthorizedSigner } from '../entities/authorized-signer.entity';

export const AUTHORIZED_SIGNER_REPOSITORY = Symbol(
  'AUTHORIZED_SIGNER_REPOSITORY',
);

export interface SignerListParams {
  companyId?: string;
  signerUserId?: string;
  status?: string;
  search?: string;
  offset?: number;
  limit?: number;
}

export interface AuthorizedSignerRepositoryPort {
  findById(id: string): Promise<CompanyAuthorizedSigner | null>;
  findAll(
    params: SignerListParams,
  ): Promise<{ items: CompanyAuthorizedSigner[]; total: number }>;
  save(signer: CompanyAuthorizedSigner): Promise<CompanyAuthorizedSigner>;
  existsForSignerUserActive(
    signerUserId: string,
    excludeId?: string,
  ): Promise<boolean>;
}
