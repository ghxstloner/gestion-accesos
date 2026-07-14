import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../../../generated/prisma/client';
import { PrismaService } from '../../../../../common/infrastructure/prisma/prisma.service';
import { RequestDocument } from '../../../domain/entities/request-document.entity';
import { DocumentVersion } from '../../../domain/entities/document-version.entity';
import { DocumentReview } from '../../../domain/entities/document-review.entity';
import {
  DOCUMENT_REPOSITORY,
  type DocumentRepositoryPort,
} from '../../../domain/repositories/document.repository.port';
import { DocumentMapper } from '../mappers/document.mapper';

const DOC_INCLUDE = {
  versions: { orderBy: { versionNumber: 'asc' as const } },
} satisfies Prisma.RequestDocumentInclude;

@Injectable()
export class DocumentPrismaRepository implements DocumentRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<RequestDocument | null> {
    const row = await this.prisma.requestDocument.findUnique({
      where: { id },
      include: DOC_INCLUDE,
    });
    return row ? DocumentMapper.toDomain(row) : null;
  }

  async findByRequest(requestId: string): Promise<RequestDocument[]> {
    const rows = await this.prisma.requestDocument.findMany({
      where: { requestId },
      include: DOC_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => DocumentMapper.toDomain(r));
  }

  async findByRequestAndType(
    requestId: string,
    documentTypeId: string,
    subjectType: string,
    subjectId: string | null,
  ): Promise<RequestDocument | null> {
    const row = await this.prisma.requestDocument.findFirst({
      where: { requestId, documentTypeId, subjectType: subjectType as Prisma.RequestDocumentWhereInput['subjectType'], subjectId },
      include: DOC_INCLUDE,
    });
    return row ? DocumentMapper.toDomain(row) : null;
  }

  async save(doc: RequestDocument): Promise<void> {
    const props = doc.toProps();
    const existing = await this.prisma.requestDocument.findUnique({
      where: { id: props.id },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.requestDocument.update({
        where: { id: props.id },
        data: DocumentMapper.toPersistenceUpdate(doc),
      });
    } else {
      await this.prisma.requestDocument.create({
        data: DocumentMapper.toPersistenceCreate(doc),
      });
    }
  }

  async saveVersion(version: DocumentVersion): Promise<void> {
    await this.prisma.documentVersion.create({
      data: DocumentMapper.toVersionPersistenceCreate(version),
    });
  }

  async saveReview(review: DocumentReview): Promise<void> {
    await this.prisma.documentReview.create({
      data: DocumentMapper.toReviewPersistenceCreate(review),
    });
  }

  async listReviews(documentId: string): Promise<DocumentReview[]> {
    const rows = await this.prisma.documentReview.findMany({
      where: { requestDocumentId: documentId },
      orderBy: { reviewedAt: 'desc' },
    });
    return rows.map((r) =>
      DocumentReview.reconstitute({
        id: r.id,
        requestDocumentId: r.requestDocumentId,
        documentVersionId: r.documentVersionId,
        decision: r.decision as DocumentReview['decision'],
        comment: r.comment,
        reviewedBy: r.reviewedBy,
        userId: r.userId,
        reviewedAt: r.reviewedAt,
      }),
    );
  }

  async setCurrentVersion(documentId: string, versionId: string): Promise<void> {
    await this.prisma.requestDocument.update({
      where: { id: documentId },
      data: { currentVersionId: versionId },
    });
  }

  async updateStatus(documentId: string, status: string): Promise<void> {
    await this.prisma.requestDocument.update({
      where: { id: documentId },
      data: { status: status as Prisma.RequestDocumentUncheckedUpdateInput['status'] },
    });
  }
}

export const DOCUMENT_REPOSITORY_PROVIDER = {
  provide: DOCUMENT_REPOSITORY,
  useClass: DocumentPrismaRepository,
};
