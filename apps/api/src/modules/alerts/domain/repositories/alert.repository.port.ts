/**
 * Phase 3 — Alerting ports.
 *
 * The alert engine is deliberately storage-agnostic: rules, observations and
 * scheduled-job state are exposed through repository ports that the
 * infrastructure layer implements with Prisma. The application services
 * orchestrate them and the scheduling layer drives the cadence.
 */

import type { Prisma } from '@prisma/client';

// ─────────────────────────────────────────────
// Enums (mirror the Prisma enum values)
// ─────────────────────────────────────────────

export type AlertRuleScope =
  'CREDENTIAL' | 'CUSTODY' | 'WORKFLOW' | 'REVIEW' | 'JOB';

export type AlertSeverity = 'INFO' | 'WARN' | 'CRITICAL';

export type OperationalAlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

export type ScheduledJobStatus = 'SUCCESS' | 'FAILED' | 'RUNNING';

// ─────────────────────────────────────────────
// Record types returned by repositories
// ─────────────────────────────────────────────

export interface AlertRuleRecord {
  id: string;
  code: string;
  name: string;
  description: string | null;
  scope: AlertRuleScope;
  thresholdDays: number | null;
  severity: AlertSeverity;
  enabled: boolean;
  lastRunAt: Date | null;
  lastResultJson: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OperationalAlertRecord {
  id: string;
  ruleId: string;
  ruleCode: string;
  severity: AlertSeverity;
  entityType: string;
  entityId: string;
  title: string;
  message: string;
  observedAt: Date;
  status: OperationalAlertStatus;
  // Company scope of the alert. NULL when the alert is GLOBAL — system/job
  // alerts that are not tied to a single tenant (visible to SYSTEM_ADMIN and
  // cross-company operational roles). Company-scoped alerts (credential /
  // custody / workflow / review observations) carry their owning company id.
  companyId: string | null;
  acknowledgedByUserId: string | null;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScheduledJobRecord {
  id: string;
  code: string;
  lastRunAt: Date | null;
  lastStatus: ScheduledJobStatus | null;
  lastError: string | null;
  runCount: number;
  failCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────
// Filter / pagination types
// ─────────────────────────────────────────────

export interface OperationalAlertListFilters {
  scope?: AlertRuleScope;
  severity?: AlertSeverity;
  status?: OperationalAlertStatus;
  // Tenant filter. When set, results are restricted to alerts whose
  // companyId matches OR which are GLOBAL (companyId IS NULL) so the caller
  // still observes governance-level alerts alongside their own. When null,
  // no tenant filter is applied (used by SYSTEM_ADMIN).
  companyId?: string | null;
  page?: number;
  limit?: number;
}

export interface OperationalAlertListPage {
  items: OperationalAlertRecord[];
  total: number;
  page: number;
  limit: number;
}

export interface AlertUpsertInput {
  ruleId: string;
  ruleCode: string;
  severity: AlertSeverity;
  entityType: string;
  entityId: string;
  title: string;
  message: string;
  // Company scope to assign to a NEWLY-created alert (idempotent refresh
  // path leaves the existing row's scope untouched). NULL means global.
  companyId?: string | null;
  metadata?: Record<string, unknown> | null;
  observedAt?: Date;
}

// ─────────────────────────────────────────────
// Repository ports
// ─────────────────────────────────────────────

export const ALERT_RULE_REPOSITORY = Symbol('ALERT_RULE_REPOSITORY');

export interface AlertRuleRepositoryPort {
  findAll(): Promise<AlertRuleRecord[]>;
  findByCode(code: string): Promise<AlertRuleRecord | null>;
  seedDefaults(
    rules: Array<
      Omit<
        AlertRuleRecord,
        'id' | 'lastRunAt' | 'lastResultJson' | 'createdAt' | 'updatedAt'
      >
    >,
  ): Promise<number>;
  registerRun(
    code: string,
    lastRunAt: Date,
    lastResultJson: unknown,
  ): Promise<void>;
}

export const OPERATIONAL_ALERT_REPOSITORY = Symbol(
  'OPERATIONAL_ALERT_REPOSITORY',
);

export interface OperationalAlertRepositoryPort {
  list(filters: OperationalAlertListFilters): Promise<OperationalAlertListPage>;
  /** Insert or refresh an alert. Returns true if a NEW row was created (drives
   *  upper-layer side-effects like notifications). Idempotency rests on the
   *  unique (ruleCode, entityType, entityId) index: existing rows in
   *  OPEN/ACKNOWLEDGED status get their observedAt + message refreshed but no
   *  duplicate is inserted. */
  upsertObservation(
    input: AlertUpsertInput,
  ): Promise<{ created: boolean; alert: OperationalAlertRecord }>;
  findById(id: string): Promise<OperationalAlertRecord | null>;
  acknowledge(id: string, userId: string): Promise<OperationalAlertRecord>;
  resolve(id: string): Promise<OperationalAlertRecord>;
}

export const SCHEDULED_JOB_REPOSITORY = Symbol('SCHEDULED_JOB_REPOSITORY');

export interface ScheduledJobRepositoryPort {
  findByCode(code: string): Promise<ScheduledJobRecord | null>;
  /** Try to start a run. Returns false if the job is still flagged RUNNING and
   *  the lease has not expired (avoids concurrent duplicate runs on multi-instance
   *  deployments). Lease duration (ms) bounds stale RUNNING entries from crashed
   *  workers so they get retried. */
  tryStart(
    code: string,
    leaseMs: number,
  ): Promise<{ acquired: boolean; record: ScheduledJobRecord | null }>;
  markSuccess(code: string): Promise<void>;
  markFailed(code: string, error: string): Promise<void>;
}

// ─────────────────────────────────────────────
// Built-in rule codes (single source of truth for both seeding and evaluation)
// ─────────────────────────────────────────────

export const ALERT_RULE_CODES = {
  CREDENTIAL_NEAR_EXPIRY: 'credential.near_expiry',
  CREDENTIAL_EXPIRED: 'credential.expired',
  CUSTODY_OVERDUE: 'custody.overdue',
  WORKFLOW_SLA_OVERDUE: 'workflow.sla_overdue',
  FAILED_JOBS: 'system.failed_jobs',
} as const;

export type AlertRuleCode =
  (typeof ALERT_RULE_CODES)[keyof typeof ALERT_RULE_CODES];
