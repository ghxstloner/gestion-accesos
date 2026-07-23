import { RequestDocument } from '../../domain/entities/request-document.entity';
import { DocumentVersion } from '../../domain/entities/document-version.entity';
import { DocumentReview } from '../../domain/entities/document-review.entity';
import type { DocumentRequirement } from '../../domain/entities/document-requirement.entity';

export interface DocumentVersionResponseDto {
  id: string;
  versionNumber: number;
  originalFilename: string;
  storedFilename: string;
  mimeType: string;
  size: number;
  sha256: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface DocumentResponseDto {
  id: string;
  requestId: string;
  documentTypeId: string;
  subjectType: string;
  subjectId: string | null;
  currentVersionId: string | null;
  status: string;
  versions: DocumentVersionResponseDto[];
  createdAt: string;
  updatedAt: string;
}

export interface DocumentReviewResponseDto {
  id: string;
  requestDocumentId: string;
  documentVersionId: string;
  decision: string;
  comment: string | null;
  reviewedBy: string;
  reviewedAt: string;
}

export interface DocumentRequirementResponseDto {
  id: string;
  requestTypeId: string;
  documentTypeId: string;
  subjectType: string;
  isRequired: boolean;
  minFiles: number;
  maxFiles: number;
}

export class DocumentPresenter {
  static toResponse(doc: RequestDocument): DocumentResponseDto {
    const props = doc.toProps();
    return {
      id: props.id,
      requestId: props.requestId,
      documentTypeId: props.documentTypeId,
      subjectType: props.subjectType,
      subjectId: props.subjectId,
      currentVersionId: props.currentVersionId,
      status: props.status,
      versions: props.versions.map((v) => this.toVersion(v)),
      createdAt: props.createdAt.toISOString(),
      updatedAt: props.updatedAt.toISOString(),
    };
  }

  static toReview(review: DocumentReview): DocumentReviewResponseDto {
    const props = review.toProps();
    return {
      id: props.id,
      requestDocumentId: props.requestDocumentId,
      documentVersionId: props.documentVersionId,
      decision: props.decision,
      comment: props.comment,
      reviewedBy: props.reviewedBy,
      reviewedAt: props.reviewedAt.toISOString(),
    };
  }

  static toRequirement(
    req: DocumentRequirement,
  ): DocumentRequirementResponseDto {
    return {
      id: req.id,
      requestTypeId: req.requestTypeId,
      documentTypeId: req.documentTypeId,
      subjectType: req.subjectType,
      isRequired: req.isRequired,
      minFiles: req.minFiles,
      maxFiles: req.maxFiles,
    };
  }

  private static toVersion(v: DocumentVersion): DocumentVersionResponseDto {
    return {
      id: v.id,
      versionNumber: v.versionNumber,
      originalFilename: v.originalFilename,
      storedFilename: v.storedFilename,
      mimeType: v.mimeType,
      size: v.size,
      sha256: v.sha256,
      uploadedBy: v.uploadedBy,
      uploadedAt: v.uploadedAt.toISOString(),
    };
  }
}
