import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { CompanySyncService } from './company-sync.service';

const JOB_NAME = 'organizations.aitsa_company_sync';
/** Daily at 03:15 by default. */
const DEFAULT_CRON = '15 3 * * *';

/**
 * Registers the daily AITSA company sync when AITSA_SYNC_ENABLED=true.
 *
 * Registered dynamically (instead of `@Cron`) so the cadence can come from
 * AITSA_SYNC_CRON via ConfigService at runtime.
 */
@Injectable()
export class CompanySyncScheduler implements OnModuleInit {
  private readonly logger = new Logger(CompanySyncScheduler.name);

  constructor(
    private readonly config: ConfigService,
    private readonly registry: SchedulerRegistry,
    private readonly syncService: CompanySyncService,
  ) {}

  onModuleInit(): void {
    const enabled =
      String(this.config.get('AITSA_SYNC_ENABLED') ?? '').toLowerCase() ===
      'true';
    if (!enabled) return;
    if (!this.syncService.isConfigured()) {
      this.logger.warn(
        'AITSA_SYNC_ENABLED=true but AITSA_API_CLIENT_ID / AITSA_API_SECRET are missing; sync job not scheduled',
      );
      return;
    }
    const cron = this.config.get<string>('AITSA_SYNC_CRON') || DEFAULT_CRON;
    const job = CronJob.from({
      cronTime: cron,
      onTick: () => void this.runSafe(),
      start: false,
    });
    this.registry.addCronJob(JOB_NAME, job);
    job.start();
    this.logger.log(`AITSA company sync scheduled (${cron})`);
  }

  private async runSafe(): Promise<void> {
    try {
      await this.syncService.sync();
    } catch (err) {
      this.logger.error(`AITSA company sync failed: ${(err as Error).message}`);
    }
  }
}
