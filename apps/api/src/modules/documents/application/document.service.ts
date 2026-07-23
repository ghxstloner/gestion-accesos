import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  BusinessRuleError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../common/domain/errors/domain-error';
import { AuthenticatedUser } from '../../../common/presentation/decorators/authenticated-user';
import { CatalogService } from '../../catalogs/application/catalog.service';
import { RequestService } from '../../requests/application/request.service';
import { RequestStatePolicy } from '../../requests/domain/request-state.policy';
import {
  DOCUMENT_REPOSITORY,
  type DocumentRepositoryPort,
} from '../domain/repositories/document.repository.port';
import {
  DOCUMENT_REQUIREMENT_REPOSITORY,
  type DocumentRequirementRepositoryPort,
} from '../domain/repositories/document-requirement.repository.port';
import {
  FILE_STORAGE,
  type FileStoragePort,
  type StoredFile,
  type UploadFile,
} from '../domain/file-storage.port';
import {
  FILE_STORAGE_CONFIG,
  type FileStorageConfig,
} from '../domain/file-storage-config';
import { RequestDocument } from '../domain/entities/request-document.entity';
import type { DocumentSubjectType } from '../domain/entities/request-document.entity';
import { DocumentVersion } from '../domain/entities/document-version.entity';
import { DocumentReview } from '../domain/entities/document-review.entity';
import type { ReviewDecision } from '../domain/entities/document-review.entity';

export interface UploadDocumentInput {
  requestId: string;
  documentTypeId: string;
  subjectType: DocumentSubjectType;
  subjectId: string | null;
  upload: UploadFile;
}

export interface ReviewDocumentInput {
  documentId: string;
  decision: ReviewDecision;
  comment?: string | null;
}

@Injectable()
export class DocumentService {
  constructor(
    @Inject(DOCUMENT_REPOSITORY) private readonly docs: DocumentRepositoryPort,
    @Inject(DOCUMENT_REQUIREMENT_REPOSITORY)
    private readonly requirements: DocumentRequirementRepositoryPort,
    @Inject(FILE_STORAGE) private readonly storage: FileStoragePort,
    @Inject(FILE_STORAGE_CONFIG)
    private readonly storageConfig: FileStorageConfig,
    private readonly catalogService: CatalogService,
    private readonly requestService: RequestService,
  ) {}

  /* ── reads ── */

  async listForRequest(
    actor: AuthenticatedUser,
    requestId: string,
  ): Promise<RequestDocument[]> {
    // Throws if actor can't read this request
    await this.requestService.getById(actor, requestId);
    return this.docs.findByRequest(requestId);
  }

  async getById(
    actor: AuthenticatedUser,
    documentId: string,
  ): Promise<RequestDocument> {
    const doc = await this.docs.findById(documentId);
    if (!doc) throw new NotFoundError('RequestDocument', documentId);
    await this.requestService.getById(actor, doc.requestId);
    return doc;
  }

  async listReviews(actor: AuthenticatedUser, documentId: string) {
    await this.getById(actor, documentId);
    return this.docs.listReviews(documentId);
  }

  /* ── uploads ── */

  async upload(
    actor: AuthenticatedUser,
    input: UploadDocumentInput,
  ): Promise<RequestDocument> {
    const req = await this.requestService.getById(actor, input.requestId);

    // Only request creators (or company admins) may attach files; and only while the
    // request is editable OR it has been returned for correction.
    if (!RequestStatePolicy.isEditable(req.status)) {
      throw new BusinessRuleError(
        `Cannot upload files to a request in status ${req.status}`,
      );
    }

    // Validate documentType catalog
    const docType = await this.catalogService.findById(input.documentTypeId);
    if (!docType) throw new NotFoundError('CatalogItem', input.documentTypeId);
    if (docType.kind !== 'DOCUMENT_TYPE') {
      throw new ValidationError(
        `${input.documentTypeId} is not a DOCUMENT_TYPE`,
      );
    }

    // Validate subjectId references a real primary participant on the request
    if (input.subjectType === 'USER') {
      if (!input.subjectId) {
        throw new ValidationError(
          'subjectId is required for USER-subject documents',
        );
      }
      const linked = req.participants.find(
        (p) => p.participantUserId === input.subjectId,
      );
      if (!linked) {
        throw new BusinessRuleError(
          `User ${input.subjectId} is not linked to this request`,
        );
      }
    }

    // Persist the file. We namespace by request id so files for one request can't collide.
    let stored: StoredFile;
    try {
      stored = await this.storage.store(input.upload, `requests/${req.id}`);
    } catch (err) {
      throw err instanceof Error
        ? new ValidationError(`File upload failed: ${err.message}`)
        : err;
    }

    // Find or create the parent RequestDocument (one per request × documentType × subject)
    let doc = await this.docs.findByRequestAndType(
      req.id,
      input.documentTypeId,
      input.subjectType,
      input.subjectId,
    );

    const isNewDoc = !doc;
    if (!doc) {
      doc = RequestDocument.create(
        {
          requestId: req.id,
          documentTypeId: input.documentTypeId,
          subjectType: input.subjectType,
          subjectId: input.subjectId,
        },
        randomUUID(),
      );
    }

    // Determine next version number
    const nextVersionNumber = doc.versions.length + 1;
    const versionId = randomUUID();
    const version = DocumentVersion.create(
      {
        requestDocumentId: doc.id,
        versionNumber: nextVersionNumber,
        originalFilename: stored.originalFilename,
        storedFilename: stored.storedFilename,
        storageKey: stored.storageKey,
        mimeType: stored.mimeType,
        size: stored.size,
        sha256: stored.sha256,
        uploadedBy: actor.userId,
      },
      versionId,
    );
    doc.addVersion(version);

    if (isNewDoc) {
      await this.docs.save(doc);
    } else {
      await this.docs.save(doc);
    }
    await this.docs.saveVersion(version);

    return doc;
  }

  /* ── reviews ── */

  async review(
    actor: AuthenticatedUser,
    input: ReviewDocumentInput,
  ): Promise<DocumentReview> {
    const doc = await this.docs.findById(input.documentId);
    if (!doc) throw new NotFoundError('RequestDocument', input.documentId);
    const req = await this.requestService.getById(actor, doc.requestId);

    // Only reviewer roles can review documents
    const reviewerRoles = [
      'DOCUMENT_RECEIVER',
      'ACCESS_DOCUMENTS_MANAGER',
      'COMPANY_ADMIN',
      'SYSTEM_ADMIN',
    ];
    const isReviewer = actor.roles.some((r) => reviewerRoles.includes(r));
    if (!isReviewer) {
      throw new ForbiddenError('Your role cannot review documents');
    }
    if (req.status !== 'UNDER_DOCUMENT_REVIEW') {
      throw new BusinessRuleError(
        `Documents can only be reviewed in UNDER_DOCUMENT_REVIEW status (got ${req.status})`,
      );
    }

    const current = doc.getCurrentVersion();
    if (!current) {
      throw new BusinessRuleError('Document has no current version to review');
    }

    const review = DocumentReview.create(
      {
        requestDocumentId: doc.id,
        documentVersionId: current.id,
        decision: input.decision,
        comment: input.comment ?? null,
        reviewedBy: actor.userId,
      },
      randomUUID(),
    );

    if (input.decision === 'APPROVED') {
      doc.approve();
    } else {
      doc.reject();
    }

    await this.docs.save(doc);
    await this.docs.saveReview(review);
    return review;
  }

  /* ── requirement reads ── */

  async listRequirements(requestTypeId: string) {
    return this.requirements.findActiveForRequestType(requestTypeId);
  }
}
