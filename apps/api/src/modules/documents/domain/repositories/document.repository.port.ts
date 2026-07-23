import type { RequestDocument } from '../entities/request-document.entity';
import type { DocumentVersion } from '../entities/document-version.entity';
import type { DocumentReview } from '../entities/document-review.entity';

export const DOCUMENT_REPOSITORY = Symbol('DOCUMENT_REPOSITORY');

export interface DocumentRepositoryPort {
  findById(id: string): Promise<RequestDocument | null>;
  findByRequest(requestId: string): Promise<RequestDocument[]>;
  findByRequestAndType(
    requestId: string,
    documentTypeId: string,
    subjectType: string,
    subjectId: string | null,
  ): Promise<RequestDocument | null>;
  save(doc: RequestDocument): Promise<void>;
  saveVersion(version: DocumentVersion): Promise<void>;
  saveReview(review: DocumentReview): Promise<void>;
  listReviews(documentId: string): Promise<DocumentReview[]>;
  setCurrentVersion(documentId: string, versionId: string): Promise<void>;
  updateStatus(documentId: string, status: string): Promise<void>;
}
