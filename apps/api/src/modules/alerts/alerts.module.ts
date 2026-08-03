import { Module } from '@nestjs/common';
import { AlertsController } from './presentation/controllers/alerts.controller';
import { AlertService } from './application/alert.service';
import { AlertEvaluationService } from './application/alert-evaluation.service';
import { SchedulerService } from './application/scheduler.service';
import {
  ALERT_RULE_REPOSITORY,
  OPERATIONAL_ALERT_REPOSITORY,
  SCHEDULED_JOB_REPOSITORY,
} from './domain/repositories/alert.repository.port';
import { AlertRulePrismaRepository } from './infrastructure/persistence/repositories/alert-rule.repository.prisma';
import { OperationalAlertPrismaRepository } from './infrastructure/persistence/repositories/operational-alert.repository.prisma';
import { ScheduledJobPrismaRepository } from './infrastructure/persistence/repositories/scheduled-job.repository.prisma';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [AlertsController],
  providers: [
    AlertService,
    AlertEvaluationService,
    SchedulerService,
    { provide: ALERT_RULE_REPOSITORY, useClass: AlertRulePrismaRepository },
    {
      provide: OPERATIONAL_ALERT_REPOSITORY,
      useClass: OperationalAlertPrismaRepository,
    },
    {
      provide: SCHEDULED_JOB_REPOSITORY,
      useClass: ScheduledJobPrismaRepository,
    },
  ],
  exports: [AlertService, AlertEvaluationService, SchedulerService],
})
export class AlertsModule {}
