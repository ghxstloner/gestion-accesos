import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../../common/infrastructure/prisma/prisma.service';
import {
  type ScheduledJobRecord,
  type ScheduledJobRepositoryPort,
  type ScheduledJobStatus,
} from '../../../domain/repositories/alert.repository.port';

type JobRow = {
  id: string;
  code: string;
  lastRunAt: Date | null;
  lastStatus: ScheduledJobStatus | null;
  lastError: string | null;
  runCount: number;
  failCount: number;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Lightweight lease-based lock for scheduled jobs.
 *
 * In single-instance deployments the lease simply guards against reentrancy if
 * a step runs longer than the cron interval. In multi-instance deployments the
 * DB row is the shared coordination point: the first worker to take a row from
 * RUNNING→RUNNING (within the lease window) wins.
 */
@Injectable()
export class ScheduledJobPrismaRepository implements ScheduledJobRepositoryPort {
  private readonly logger = new Logger(ScheduledJobPrismaRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async findByCode(code: string): Promise<ScheduledJobRecord | null> {
    const row = await this.prisma.scheduledJob.findUnique({ where: { code } });
    return row ? this.toRecord(row) : null;
  }

  async tryStart(
    code: string,
    leaseMs: number,
  ): Promise<{ acquired: boolean; record: ScheduledJobRecord | null }> {
    let row = await this.prisma.scheduledJob.findUnique({
      where: { code },
    });
    if (!row) {
      row = await this.prisma.scheduledJob.create({
        data: { id: randomUUID(), code },
      });
    } else if (
      row.lastStatus === 'RUNNING' &&
      row.lastRunAt &&
      Date.now() - row.lastRunAt.getTime() < leaseMs
    ) {
      // Still inside the active lease window — let another worker run it.
      this.logger.debug(
        `Job ${code} skipped — RUNNING lease still active (started ${row.lastRunAt.toISOString()})`,
      );
      return { acquired: false, record: this.toRecord(row) };
    }
    const updated = await this.prisma.scheduledJob.update({
      where: { code },
      data: {
        lastStatus: 'RUNNING',
        lastRunAt: new Date(),
        lastError: null,
        runCount: { increment: 1 },
      },
    });
    return { acquired: true, record: this.toRecord(updated) };
  }

  async markSuccess(code: string): Promise<void> {
    await this.prisma.scheduledJob.update({
      where: { code },
      data: { lastStatus: 'SUCCESS', lastError: null },
    });
  }

  async markFailed(code: string, error: string): Promise<void> {
    await this.prisma.scheduledJob.update({
      where: { code },
      data: {
        lastStatus: 'FAILED',
        lastError: error.slice(0, 65000),
        failCount: { increment: 1 },
      },
    });
  }

  private toRecord(row: JobRow): ScheduledJobRecord {
    return { ...row };
  }
}
