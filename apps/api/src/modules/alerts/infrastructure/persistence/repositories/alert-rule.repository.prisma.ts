import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../../common/infrastructure/prisma/prisma.service';
import {
  ALERT_RULE_CODES,
  type AlertRuleRecord,
  type AlertRuleRepositoryPort,
} from '../../../domain/repositories/alert.repository.port';

@Injectable()
export class AlertRulePrismaRepository implements AlertRuleRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<AlertRuleRecord[]> {
    const rows = await this.prisma.alertRule.findMany({
      orderBy: { code: 'asc' },
    });
    return rows.map((r) => this.toRecord(r));
  }

  async findByCode(code: string): Promise<AlertRuleRecord | null> {
    const row = await this.prisma.alertRule.findUnique({ where: { code } });
    return row ? this.toRecord(row) : null;
  }

  async seedDefaults(
    rules: Array<
      Omit<
        AlertRuleRecord,
        'id' | 'lastRunAt' | 'lastResultJson' | 'createdAt' | 'updatedAt'
      >
    >,
  ): Promise<number> {
    let created = 0;
    for (const rule of rules) {
      const existing = await this.prisma.alertRule.findUnique({
        where: { code: rule.code },
        select: { code: true },
      });
      if (existing) continue;
      await this.prisma.alertRule.create({
        data: {
          id: randomUUID(),
          code: rule.code,
          name: rule.name,
          description: rule.description,
          scope: rule.scope,
          thresholdDays: rule.thresholdDays,
          severity: rule.severity,
          enabled: rule.enabled,
        },
      });
      created++;
    }
    return created;
  }

  async registerRun(
    code: string,
    lastRunAt: Date,
    lastResultJson: unknown,
  ): Promise<void> {
    await this.prisma.alertRule.update({
      where: { code },
      data: {
        lastRunAt,
        lastResultJson: lastResultJson as never,
      },
    });
  }

  private toRecord(
    row: Prisma.AlertRuleGetPayload<Record<string, never>>,
  ): AlertRuleRecord {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      scope: row.scope,
      thresholdDays: row.thresholdDays,
      severity: row.severity,
      enabled: row.enabled,
      lastRunAt: row.lastRunAt,
      lastResultJson: row.lastResultJson,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

/**
 * Static definitions of the built-in Phase 3 rules. Used both by the seeding
 * routine and by the evaluator to look up matching rule metadata for a code.
 */
export const BUILTIN_RULES = [
  {
    code: ALERT_RULE_CODES.CREDENTIAL_NEAR_EXPIRY,
    name: 'Credential nearing expiry',
    description:
      'Credentials that expire within the threshold (default 30 days).',
    scope: 'CREDENTIAL' as const,
    thresholdDays: 30,
    severity: 'INFO' as const,
    enabled: true,
  },
  {
    code: ALERT_RULE_CODES.CREDENTIAL_EXPIRED,
    name: 'Expired credentials',
    description: 'Credentials that have already passed their expiration date.',
    scope: 'CREDENTIAL' as const,
    thresholdDays: 0,
    severity: 'CRITICAL' as const,
    enabled: true,
  },
  {
    code: ALERT_RULE_CODES.CUSTODY_OVERDUE,
    name: 'Overdue custody records',
    description: 'Credenciales in custody past their expected return date.',
    scope: 'CUSTODY' as const,
    thresholdDays: 0,
    severity: 'WARN' as const,
    enabled: true,
  },
  {
    code: ALERT_RULE_CODES.WORKFLOW_SLA_OVERDUE,
    name: 'SLA overdue workflow tasks',
    description:
      'Workflow review/production tasks that exceeded their SLA window.',
    scope: 'WORKFLOW' as const,
    thresholdDays: 2,
    severity: 'WARN' as const,
    enabled: true,
  },
  {
    code: ALERT_RULE_CODES.FAILED_JOBS,
    name: 'Failed scheduled jobs',
    description: 'Scheduled jobs whose last execution failed.',
    scope: 'JOB' as const,
    thresholdDays: 0,
    severity: 'WARN' as const,
    enabled: true,
  },
] as const;
