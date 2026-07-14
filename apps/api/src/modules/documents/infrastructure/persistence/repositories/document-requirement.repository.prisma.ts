import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../../../generated/prisma/client';
import { PrismaService } from '../../../../../common/infrastructure/prisma/prisma.service';
import { DocumentRequirement } from '../../../domain/entities/document-requirement.entity';
import {
  DOCUMENT_REQUIREMENT_REPOSITORY,
  type DocumentRequirementRepositoryPort,
} from '../../../domain/repositories/document-requirement.repository.port';

@Injectable()
export class DocumentRequirementPrismaRepository implements DocumentRequirementRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveForRequestType(requestTypeId: string): Promise<DocumentRequirement[]> {
    const rows = await this.prisma.documentRequirement.findMany({
      where: { requestTypeId, isActive: true },
    });
    return rows.map((r) =>
      DocumentRequirement.reconstitute({
        id: r.id,
        requestTypeId: r.requestTypeId,
        documentTypeId: r.documentTypeId,
        subjectType: r.subjectType as 'REQUEST' | 'PERSON',
        isRequired: r.isRequired,
        minFiles: r.minFiles,
        maxFiles: r.maxFiles,
        isActive: r.isActive,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }),
    );
  }

  async save(req: DocumentRequirement): Promise<void> {
    const props = req.toProps();
    const data: Prisma.DocumentRequirementUncheckedCreateInput = {
      id: props.id,
      requestTypeId: props.requestTypeId,
      documentTypeId: props.documentTypeId,
      subjectType: props.subjectType,
      isRequired: props.isRequired,
      minFiles: props.minFiles,
      maxFiles: props.maxFiles,
      isActive: props.isActive,
    };
    await this.prisma.documentRequirement.upsert({
      where: { id: props.id },
      create: data,
      update: {
        isRequired: props.isRequired,
        minFiles: props.minFiles,
        maxFiles: props.maxFiles,
        isActive: props.isActive,
      },
    });
  }
}

export const DOCUMENT_REQUIREMENT_REPOSITORY_PROVIDER = {
  provide: DOCUMENT_REQUIREMENT_REPOSITORY,
  useClass: DocumentRequirementPrismaRepository,
};
