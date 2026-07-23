import type {
  Prisma,
  RequestDocument as PrismaRequestDocument,
  DocumentVersion as PrismaDocumentVersion,
} from '../../../../../generated/prisma/client';
import { RequestDocument } from '../../../domain/entities/request-document.entity';
import { DocumentVersion } from '../../../domain/entities/document-version.entity';
import { DocumentReview } from '../../../domain/entities/document-review.entity';

type DocumentRow = PrismaRequestDocument & {
  versions: PrismaDocumentVersion[];
};

export class DocumentMapper {
  static toDomain(row: DocumentRow): RequestDocument {
    const versions = row.versions.map((v) =>
      DocumentVersion.reconstitute({
        id: v.id,
        requestDocumentId: v.requestDocumentId,
        versionNumber: v.versionNumber,
        originalFilename: v.originalFilename,
        storedFilename: v.storedFilename,
        storageKey: v.storageKey,
        mimeType: v.mimeType,
        size: Number(v.size),
        sha256: v.sha256,
        uploadedBy: v.uploadedBy,
        uploadedAt: v.uploadedAt,
      }),
    );

    return RequestDocument.reconstitute({
      id: row.id,
      requestId: row.requestId,
      documentTypeId: row.documentTypeId,
      subjectType: row.subjectType,
      subjectId: row.subjectId,
      currentVersionId: row.currentVersionId,
      status: row.status,
      versions,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  static toPersistenceCreate(
    doc: RequestDocument,
  ): Prisma.RequestDocumentUncheckedCreateInput {
    const props = doc.toProps();
    return {
      id: props.id,
      requestId: props.requestId,
      documentTypeId: props.documentTypeId,
      subjectType: props.subjectType,
      subjectId: props.subjectId,
      currentVersionId: props.currentVersionId,
      status: props.status,
    };
  }

  static toPersistenceUpdate(
    doc: RequestDocument,
  ): Prisma.RequestDocumentUncheckedUpdateInput {
    const props = doc.toProps();
    return {
      currentVersionId: props.currentVersionId,
      status: props.status,
    };
  }

  static toVersionPersistenceCreate(
    ver: DocumentVersion,
  ): Prisma.DocumentVersionUncheckedCreateInput {
    const props = ver.toProps();
    return {
      id: props.id,
      requestDocumentId: props.requestDocumentId,
      versionNumber: props.versionNumber,
      originalFilename: props.originalFilename,
      storedFilename: props.storedFilename,
      storageKey: props.storageKey,
      mimeType: props.mimeType,
      size: BigInt(props.size),
      sha256: props.sha256,
      uploadedBy: props.uploadedBy,
    };
  }

  static toReviewPersistenceCreate(
    review: DocumentReview,
  ): Prisma.DocumentReviewUncheckedCreateInput {
    const props = review.toProps();
    return {
      id: props.id,
      requestDocumentId: props.requestDocumentId,
      documentVersionId: props.documentVersionId,
      decision: props.decision,
      comment: props.comment,
      reviewedBy: props.reviewedBy,
    };
  }
}
