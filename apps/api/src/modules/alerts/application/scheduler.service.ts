import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AlertEvaluationService } from './alert-evaluation.service';
import { BUILTIN_RULES } from '../infrastructure/persistence/repositories/alert-rule.repository.prisma';

/**
 * Phase 3 — SchedulerService
 *
 * Drives the alert evaluation jobs on a regular cadence using @nestjs/schedule.
 * Each invocation defers to AlertEvaluationService.runJob which acquires its
 * own DB-backed lease, so even if a tick overlaps with the previous run, the
 * evaluator handles de-duplication.
 *
 * On boot we seed the built-in rule definitions once (idempotent).
 *
 * Override the cadence via ALERTS_CRON_* env vars if needed (configurable via
 * the cron expressions below).
 */
@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(private readonly evaluator: AlertEvaluationService) {}

  async onModuleInit(): Promise<void> {
    try {
      const seeded = await this.evaluator.seedDefaults([...BUILTIN_RULES]);
      if (seeded > 0) {
        this.logger.log(`Seeded ${seeded} default alert rules`);
      }
    } catch (err) {
      // Seeding is best-effort — never block module init.
      this.logger.warn(`Alert rule seeding skipped: ${(err as Error).message}`);
    }
  }

  /**
   * Cadence:
   *  - credentials: hourly at minute 5 (avoid the top-of-hour chaos)
   *  - custody:    every 15 minutes
   *  - workflows:  every 30 minutes
   *  - jobs:       every 5 minutes
   *
   * Use CronExpression helpers where applicable for readability; raw strings
   * for the offset variants.
   */
  @Cron('5 * * * *', { name: 'alerts.evaluate_credentials' })
  runCredentials(): void {
    void this.runSafe('alerts.evaluate_credentials');
  }

  @Cron('*/15 * * * *', { name: 'alerts.evaluate_custody' })
  runCustody(): void {
    void this.runSafe('alerts.evaluate_custody');
  }

  @Cron('*/30 * * * *', { name: 'alerts.evaluate_workflows' })
  runWorkflows(): void {
    void this.runSafe('alerts.evaluate_workflows');
  }

  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'alerts.evaluate_jobs' })
  runJobs(): void {
    void this.runSafe('alerts.evaluate_jobs');
  }

  private async runSafe(jobCode: string): Promise<void> {
    try {
      await this.evaluator.runJob(jobCode);
    } catch (err) {
      // runJob already marks the job FAILED, but we still log here so any
      // unexpected throw above the evaluator (lease acquisition, etc.) shows up.
      this.logger.error(
        `Scheduler run ${jobCode} crashed: ${(err as Error).message}`,
      );
    }
  }
}
