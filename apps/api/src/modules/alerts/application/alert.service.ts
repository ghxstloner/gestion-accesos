import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../../../common/presentation/decorators/authenticated-user';
import { canReadAcrossCompanies } from '../../../common/domain/access-scope';
import {
  ForbiddenError,
  NotFoundError,
} from '../../../common/domain/errors/domain-error';
import {
  type OperationalAlertListFilters,
  type OperationalAlertListPage,
  type OperationalAlertRecord,
  OPERATIONAL_ALERT_REPOSITORY,
  type OperationalAlertRepositoryPort,
} from '../domain/repositories/alert.repository.port';

/**
 * Phase 3 — thin application service that exposes operational-alert queries
 * and acknowledgement/resolution transitions to the presentation layer.
 * Permission checks happen here (not at the controller) so unit tests cover
 * them directly.
 *
 * Phase 6 — Tenant isolation. Alerts are scoprable by company:
 *   - SYSTEM_ADMIN:           no filter (sees every alert, including GLOBAL).
 *   - Cross-company roles     (DOCUMENT_RECEIVER, ACCESS_DOCUMENTS_MANAGER,
 *                              CARD_ISSUER): may read across companies
 *                              (operational awareness for queues).
 *   - COMPANY_ADMIN:          only alerts where companyId matches their own
 *                              company OR companyId IS NULL (global alerts).
 * Acknowledge/resolve additionally require the `alerts.acknowledge`
 * permission, and a COMPANY_ADMIN may only ack/resolve alerts visible to
 * their company.
 */
@Injectable()
export class AlertService {
  constructor(
    @Inject(OPERATIONAL_ALERT_REPOSITORY)
    private readonly alerts: OperationalAlertRepositoryPort,
  ) {}

  /**
   * Compute the tenant filter applied to list/detail queries.
   * Returns `null` (no filter) for SYSTEM_ADMIN and cross-company operational
   * roles. Returns `actor.companyId` for everyone else (or throws if the
   * caller has no company scope at all).
   */
  private scopeCompanyId(actor: AuthenticatedUser): string | null {
    if (
      actor.roles.includes('SYSTEM_ADMIN') ||
      canReadAcrossCompanies(actor.roles)
    ) {
      return null;
    }
    if (!actor.companyId) {
      throw new ForbiddenError(
        'You do not have permission to read alerts without a company scope',
      );
    }
    return actor.companyId;
  }

  async list(
    actor: AuthenticatedUser,
    filters: OperationalAlertListFilters,
  ): Promise<OperationalAlertListPage> {
    const companyId = this.scopeCompanyId(actor);
    // `undefined` ⇒ repository applies no tenant filter (SYSTEM_ADMIN /
    // cross-company operators). An explicit string filters to that company.
    // A null actor.companyId without a bypass was rejected above.
    if (companyId !== null) {
      return this.alerts.list({ ...filters, companyId });
    }
    return this.alerts.list(filters);
  }

  /**
   * Resolve a single alert and enforce read-visibility for the caller.
   * Returns NotFoundError rather than ForbiddenError for scoping failures on
   * the detail path to avoid leaking the existence of cross-tenant ids.
   */
  async findById(
    actor: AuthenticatedUser,
    id: string,
  ): Promise<OperationalAlertRecord> {
    const existing = await this.alerts.findById(id);
    if (!existing) throw new NotFoundError('Alert not found');
    const scoped = this.scopeCompanyId(actor);
    if (
      scoped !== null &&
      existing.companyId !== null &&
      existing.companyId !== scoped
    ) {
      throw new NotFoundError('Alert not found');
    }
    return existing;
  }

  async acknowledge(actor: AuthenticatedUser, id: string): Promise<void> {
    this.assertCanAcknowledge(actor);
    const existing = await this.findById(actor, id);
    await this.alerts.acknowledge(existing.id, actor.userId);
  }

  async resolve(actor: AuthenticatedUser, id: string): Promise<void> {
    this.assertCanAcknowledge(actor);
    const existing = await this.findById(actor, id);
    await this.alerts.resolve(existing.id);
  }

  private assertCanAcknowledge(actor: AuthenticatedUser): void {
    const allowed =
      actor.roles.includes('SYSTEM_ADMIN') ||
      actor.permissions.includes('alerts.acknowledge');
    if (!allowed) {
      throw new ForbiddenError(
        'You do not have permission to acknowledge or resolve alerts',
      );
    }
  }
}
