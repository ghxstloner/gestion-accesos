import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../../common/infrastructure/prisma/prisma.service';
import {
  REQUEST_SUBMISSION_REPOSITORY,
  type RequestSubmissionRepositoryPort,
  type SubmissionSnapshot,
  type RequestSubmissionRecord,
} from '../../../domain/repositories/request-submission.repository.port';

@Injectable()
export class RequestSubmissionPrismaRepository implements RequestSubmissionRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(snap: SubmissionSnapshot): Promise<RequestSubmissionRecord> {
    const sequence = await this.prisma.requestSubmission.count({
      where: { requestId: snap.requestId },
    });
    const row = await this.prisma.requestSubmission.create({
      data: {
        id: randomUUID(),
        requestId: snap.requestId,
        sequence: sequence + 1,
        submittedBy: snap.submittedBy,
        snapshotJson: snap.snapshotJson as Prisma.InputJsonValue,
        snapshotHash: snap.snapshotHash,
        previousSubmissionId: snap.previousSubmissionId,
      },
    });
    return {
      id: row.id,
      requestId: row.requestId,
      sequence: row.sequence,
      submittedBy: row.submittedBy,
      submittedAt: row.submittedAt,
      snapshotHash: row.snapshotHash,
    };
  }

  async listByRequest(requestId: string): Promise<RequestSubmissionRecord[]> {
    const rows = await this.prisma.requestSubmission.findMany({
      where: { requestId },
      orderBy: { sequence: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      requestId: r.requestId,
      sequence: r.sequence,
      submittedBy: r.submittedBy,
      submittedAt: r.submittedAt,
      snapshotHash: r.snapshotHash,
    }));
  }
}

export function computeSnapshotHash(payload: Record<string, unknown>): string {
  const json = JSON.stringify(payload, Object.keys(payload).sort());
  return createHash('sha256').update(json).digest('hex');
}

export const REQUEST_SUBMISSION_REPOSITORY_PROVIDER = {
  provide: REQUEST_SUBMISSION_REPOSITORY,
  useClass: RequestSubmissionPrismaRepository,
};
