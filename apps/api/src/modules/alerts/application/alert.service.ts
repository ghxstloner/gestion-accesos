import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../../../common/presentation/decorators/authenticated-user';
import {
  ForbiddenError,
  NotFoundError,
} from '../../../common/domain/errors/domain-error';
import {
  type OperationalAlertListFilters,
  type OperationalAlertListPage,
  OPERATIONAL_ALERT_REPOSITORY,
  type OperationalAlertRepositoryPort,
} from '../domain/repositories/alert.repository.port';

/**
 * Phase 3 — thin application service that exposes operational-alert queries
 * and acknowledgement/resolution transitions to the presentation layer.
 * Permission checks happen here (not at the controller) so unit tests cover
 * them directly.
 */
@Injectable()
export class AlertService {
  constructor(
    @Inject(OPERATIONAL_ALERT_REPOSITORY)
    private readonly alerts: OperationalAlertRepositoryPort,
  ) {}

  async list(
    filters: OperationalAlertListFilters,
  ): Promise<OperationalAlertListPage> {
    return this.alerts.list(filters);
  }

  async acknowledge(actor: AuthenticatedUser, id: string): Promise<void> {
    this.assertCanAcknowledge(actor);
    const existing = await this.alerts.findById(id);
    if (!existing) throw new NotFoundError('Alert not found');
    await this.alerts.acknowledge(id, actor.userId);
  }

  async resolve(actor: AuthenticatedUser, id: string): Promise<void> {
    this.assertCanAcknowledge(actor);
    const existing = await this.alerts.findById(id);
    if (!existing) throw new NotFoundError('Alert not found');
    await this.alerts.resolve(id);
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
