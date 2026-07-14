import type { DocumentRequirement } from '../entities/document-requirement.entity';

export const DOCUMENT_REQUIREMENT_REPOSITORY = Symbol('DOCUMENT_REQUIREMENT_REPOSITORY');

export interface DocumentRequirementRepositoryPort {
  findActiveForRequestType(requestTypeId: string): Promise<DocumentRequirement[]>;
  save(req: DocumentRequirement): Promise<void>;
}
