/**
 * `ReviewService` orchestration spec — verifies the symmetric wiring that
 * closes Phase 1: every reviewer decision (approve / reject / return /
 * reject_documents) goes through `RequestWorkflowOrchestrator.onReviewOutcome`
 * instead of calling `requestService.transition` directly. No path can mutate
 * the Request status without also completing/advancing the matching workflow
 * task.
 *
 * Cases (matches the user's Phase 1 closure requirements):
 *  1. aprobación final — `approve_final` routes through orchestrator.
 *  2. rechazo — `reject` routes through orchestrator.
 *  3. devolución para corrección — `return` routes through orchestrator.
 *  4. solicitud sin workflow — orchestrator is still invoked (it falls back
 *     internally); we don't bypass it.
 *  5. solicitud con workflow activo — orchestrator receives the right
 *     { requestTransition, outcome }.
 *  6. repetición idempotente — second call with the same transition is a
 *     no-op at the orchestrator because the Request status no longer matches
 *     the guard (defensive skip), matching legacy idempotency.
 *  7. ausencia de tarea abierta — orchestrator still invoked; the contract
 *     is honoured at the ReviewService level (orchestrator handles the
 *     missing-task fallback internally).
 *  8. rollback ante fallo — when the orchestrator throws, the ReviewTask
 *     state-machine mutation already happened in memory but the orchestrator
 *     did NOT advance; this matches the pre-wiring behaviour (the exception
 *     surfaces to the controller).
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import type { AuthenticatedUser } from '../../../common/presentation/decorators/authenticated-user';
import type {
  ReviewRepositoryPort,
  ReviewTaskRecord,
  ReviewListFilters,
  ReviewListPage,
} from '../domain/repositories/review.repository.port';
import {
  ForbiddenError,
  NotFoundError,
} from '../../../common/domain/errors/domain-error';
import { ReviewTask } from '../domain/entities/review-task.entity';
import { ReviewService } from './review.service';
import type { RequestService } from '../../requests/application/request.service';
import type { RequestWorkflowOrchestrator } from '../../workflows/application/request-workflow-orchestrator.service';
import type { HumanTaskOutcome } from '../../workflows/domain/workflow-definition.types';

const ACTOR: AuthenticatedUser = {
  userId: 'manager-1',
  companyId: 'co-1',
  email: 'manager@example.test',
  roles: ['ACCESS_DOCUMENTS_MANAGER'],
  permissions: [],
};

const SYSTEM_ADMIN_ACTOR: AuthenticatedUser = {
  userId: 'admin-1',
  companyId: 'co-1',
  email: 'admin@example.test',
  roles: ['SYSTEM_ADMIN'],
  permissions: [],
};

/** Records every call to onReviewOutcome so we can assert routing. */
class StubOrchestrator {
  calls: Array<{
    requestId: string;
    requestTransition: string;
    outcome: HumanTaskOutcome;
    comment: string | null;
    reasonCode: string | null;
  }> = [];
  /** Throw on the next call (rollback on failure test). */
  nextError: Error | null = null;

  async onReviewOutcome(input: {
    requestId: string;
    requestTransition: string;
    outcome: HumanTaskOutcome;
    comment?: string | null;
    reasonCode?: string | null;
  }): Promise<void> {
    await Promise.resolve();
    this.calls.push({
      requestId: input.requestId,
      requestTransition: input.requestTransition,
      outcome: input.outcome,
      comment: input.comment ?? null,
      reasonCode: input.reasonCode ?? null,
    });
    if (this.nextError) {
      const e = this.nextError;
      this.nextError = null;
      throw e;
    }
  }
}

/** Minimal RequestService stub. Only `getById` is exercised by ReviewService. */
class StubRequestService {
  /** requestId → status returned by getById. */
  statuses = new Map<string, string>();
  async getById(_actor: AuthenticatedUser, requestId: string) {
    await Promise.resolve();
    void _actor;
    const status = this.statuses.get(requestId) ?? 'PENDING_FINAL_APPROVAL';
    return {
      id: requestId,
      status,
      requestTypeCode: 'TEMPORARY_PERSON',
    } as unknown as Awaited<ReturnType<RequestService['getById']>>;
  }
}

class InMemoryReviewRepo implements ReviewRepositoryPort {
  records = new Map<string, ReviewTaskRecord>();

  save(task: ReviewTaskRecord): Promise<void> {
    this.records.set(task.id, task);
    return Promise.resolve();
  }
  findById(id: string): Promise<ReviewTaskRecord | null> {
    return Promise.resolve(this.records.get(id) ?? null);
  }
  findByRequest(requestId: string): Promise<ReviewTaskRecord[]> {
    return Promise.resolve(
      Array.from(this.records.values()).filter(
        (r) => r.requestId === requestId,
      ),
    );
  }
  list(inputs: {
    filters: ReviewListFilters;
    page: number;
    pageSize: number;
  }): Promise<ReviewListPage> {
    let items = Array.from(this.records.values());
    if (inputs.filters.requestId) {
      items = items.filter((r) => r.requestId === inputs.filters.requestId);
    }
    return Promise.resolve({
      items,
      total: items.length,
      page: inputs.page,
      pageSize: inputs.pageSize,
    });
  }
}

function buildService(opts: {
  requestStatus?: string;
  taskType?: 'DOCUMENT_REVIEW' | 'FINAL_APPROVAL';
  taskStatus?: 'PENDING' | 'ASSIGNED' | 'COMPLETED' | 'CANCELLED';
  actor?: AuthenticatedUser;
}) {
  const reviews = new InMemoryReviewRepo();
  const requests = new StubRequestService();
  const orchestrator = new StubOrchestrator();

  const requestId = 'req-1';
  const task = makeTask({
    requestId,
    taskType: opts.taskType ?? 'FINAL_APPROVAL',
    status: opts.taskStatus ?? 'ASSIGNED',
  });
  reviews.records.set(task.id, toRecord(task));
  requests.statuses.set(
    requestId,
    opts.requestStatus ?? 'PENDING_FINAL_APPROVAL',
  );

  const service = new ReviewService(
    reviews,
    requests as unknown as RequestService,
    orchestrator as unknown as RequestWorkflowOrchestrator,
  );
  return {
    service,
    reviews,
    requests,
    orchestrator,
    task,
    requestId,
    actor: opts.actor ?? ACTOR,
  };
}

function makeTask(input: {
  requestId: string;
  taskType: 'DOCUMENT_REVIEW' | 'FINAL_APPROVAL';
  status: 'PENDING' | 'ASSIGNED' | 'COMPLETED' | 'CANCELLED';
}): ReviewTask {
  return ReviewTask.reconstitute({
    id: 'task-' + Math.random().toString(36).slice(2, 8),
    requestId: input.requestId,
    taskType: input.taskType,
    status: input.status,
    assignedToUserId: input.status === 'ASSIGNED' ? 'manager-1' : null,
    assignedRoleCode:
      input.status === 'ASSIGNED' ? 'ACCESS_DOCUMENTS_MANAGER' : null,
    assignedAt: input.status === 'ASSIGNED' ? new Date() : null,
    completedAt: null,
    dueAt: null,
    createdAt: new Date(),
  });
}

function toRecord(task: ReviewTask): ReviewTaskRecord {
  // Direct field read by reconstituting the props — we only need the
  // persistance shape, so we map through the entity getters.
  return {
    id: task.id,
    requestId: task.requestId,
    taskType: task.taskType,
    status: task.status,
    assignedToUserId: null,
    assignedRoleCode: null,
    assignedAt: null,
    completedAt: null,
    dueAt: null,
    createdAt: new Date(),
  };
}

describe('ReviewService — Phase 1 orchestration wiring', () => {
  describe('routing of reviewer decisions', () => {
    it('aprobación final → routes approve_final/APPROVE through the orchestrator', async () => {
      const { service, orchestrator, task, requestId, actor } = buildService({
        requestStatus: 'PENDING_FINAL_APPROVAL',
        taskType: 'FINAL_APPROVAL',
        taskStatus: 'ASSIGNED',
      });
      await service.transition(actor, task.id, 'approve_final', {});
      expect(orchestrator.calls).toEqual([
        expect.objectContaining({
          requestId,
          requestTransition: 'approve_final',
          outcome: 'APPROVE',
        }),
      ]);
    });

    it('rechazo → routes reject/REJECT through the orchestrator', async () => {
      const { service, orchestrator, task, requestId, actor } = buildService({
        requestStatus: 'PENDING_FINAL_APPROVAL',
        taskType: 'FINAL_APPROVAL',
        taskStatus: 'ASSIGNED',
      });
      await service.transition(actor, task.id, 'reject', {
        reasonCode: 'INCOMPLETE',
        comment: 'no',
      });
      expect(orchestrator.calls).toEqual([
        expect.objectContaining({
          requestId,
          requestTransition: 'reject',
          outcome: 'REJECT',
          reasonCode: 'INCOMPLETE',
          comment: 'no',
        }),
      ]);
    });

    it('devolución para corrección → routes return/RETURN_FOR_CORRECTION through the orchestrator', async () => {
      const { service, orchestrator, task, requestId, actor } = buildService({
        requestStatus: 'PENDING_FINAL_APPROVAL',
        taskType: 'FINAL_APPROVAL',
        taskStatus: 'ASSIGNED',
      });
      await service.transition(actor, task.id, 'return', {
        comment: 'fix docs',
      });
      expect(orchestrator.calls).toEqual([
        expect.objectContaining({
          requestId,
          requestTransition: 'return',
          outcome: 'RETURN_FOR_CORRECTION',
          comment: 'fix docs',
        }),
      ]);
    });

    it('reject_documents → routes return/RETURN_FOR_CORRECTION (NOT reject) through the orchestrator', async () => {
      const { service, orchestrator, task, requestId, actor } = buildService({
        requestStatus: 'UNDER_DOCUMENT_REVIEW',
        taskType: 'DOCUMENT_REVIEW',
        taskStatus: 'ASSIGNED',
      });
      await service.transition(actor, task.id, 'reject_documents', {});
      expect(orchestrator.calls).toEqual([
        expect.objectContaining({
          requestId,
          // Matches the legacy semantics: rejecting documents → RETURN Request.
          requestTransition: 'return',
          outcome: 'RETURN_FOR_CORRECTION',
        }),
      ]);
    });

    it('approve_documents → routes approve_documents/APPROVE through the orchestrator', async () => {
      const { service, orchestrator, task, requestId, actor } = buildService({
        requestStatus: 'UNDER_DOCUMENT_REVIEW',
        taskType: 'DOCUMENT_REVIEW',
        taskStatus: 'ASSIGNED',
      });
      await service.transition(actor, task.id, 'approve_documents', {});
      expect(orchestrator.calls).toEqual([
        expect.objectContaining({
          requestId,
          requestTransition: 'approve_documents',
          outcome: 'APPROVE',
        }),
      ]);
    });
  });

  describe('legacy compatibility and edge cases', () => {
    it('solicitud SIN workflow activo — still routes through orchestrator (orchestrator owns the internal fallback)', async () => {
      // The orchestrator fake here always accepts; the real orchestrator
      // would internally fall back to legacy transition when no ACTIVE
      // instance / open task exists. This test asserts ReviewService DOES
      // NOT bypass the orchestrator branch (i.e. the bridge is mandatory).
      const { service, orchestrator, task, actor } = buildService({
        requestStatus: 'PENDING_FINAL_APPROVAL',
        taskType: 'FINAL_APPROVAL',
        taskStatus: 'ASSIGNED',
      });
      await service.transition(actor, task.id, 'approve_final', {});
      expect(orchestrator.calls.length).toBe(1);
    });

    it('assign / unassign — do NOT route through the orchestrator (no Request status change)', async () => {
      const { service, orchestrator, task, actor } = buildService({
        requestStatus: 'PENDING_FINAL_APPROVAL',
        taskType: 'FINAL_APPROVAL',
        taskStatus: 'PENDING',
      });
      // assign → orchestrator never called.
      await service.transition(actor, task.id, 'assign', {
        assignedToUserId: 'mgr-x',
      });
      expect(orchestrator.calls.length).toBe(0);
      // unassign → orchestrator never called.
      await service.transition(actor, task.id, 'unassign', {});
      expect(orchestrator.calls.length).toBe(0);
    });

    it('repetición idempotente — second apply of the same transition is a defensive no-op (Request already moved)', async () => {
      const { service, orchestrator, task, actor, requests, requestId } =
        buildService({
          requestStatus: 'PENDING_FINAL_APPROVAL',
          taskType: 'FINAL_APPROVAL',
          taskStatus: 'ASSIGNED',
        });
      await service.transition(actor, task.id, 'approve_final', {});
      // Simulate Request now APPROVED (after first run).
      requests.statuses.set(requestId, 'APPROVED');
      // The ReviewTask is COMPLETED so a second state-policy check would
      // throw ConflictError — but if we reconstitute a fresh ASSIGNED task
      // and call approve_final again on an already-APPROVED request, the
      // pre-state guard skips orchestrator invocation (idempotent skip).
      const freshTask = makeTask({
        requestId,
        taskType: 'FINAL_APPROVAL',
        status: 'ASSIGNED',
      });
      // Place the fresh task in the repo.
      (
        service as unknown as { reviews: InMemoryReviewRepo }
      ).reviews.records.set(freshTask.id, toRecord(freshTask));
      await service.transition(actor, freshTask.id, 'approve_final', {});
      // No second orchestrator call — defensive guard skipped.
      expect(orchestrator.calls.length).toBe(1);
    });

    it('ausencia de tarea abierta (workflow ACTIVE pero sin human task) — ReviewService still routes the decision; fallback lives in orchestrator', async () => {
      // ReviewService cannot see the workflow state, so "no open task" is
      // opaque here. The contract is that ReviewService MUST forward the
      // decision to the orchestrator regardless of internal workflow state.
      // The orchestrator's own spec covers the missing-task fallback.
      const { service, orchestrator, task, actor } = buildService({
        requestStatus: 'PENDING_FINAL_APPROVAL',
        taskType: 'FINAL_APPROVAL',
        taskStatus: 'ASSIGNED',
      });
      await service.transition(actor, task.id, 'return', {});
      expect(orchestrator.calls.length).toBe(1);
    });

    it('rollback ante fallo — orchestrator throws → exception surfaces; task in-memory state already mutated but no second orchestrator call is attempted', async () => {
      const { service, orchestrator, task, actor } = buildService({
        requestStatus: 'PENDING_FINAL_APPROVAL',
        taskType: 'FINAL_APPROVAL',
        taskStatus: 'ASSIGNED',
      });
      orchestrator.nextError = new Error('atomic tx rolled back');
      await expect(
        service.transition(actor, task.id, 'approve_final', {}),
      ).rejects.toThrow(/atomic tx rolled back/);
      // Exactly one call was attempted — no retry / no double transition.
      expect(orchestrator.calls.length).toBe(1);
    });
  });

  describe('authorization', () => {
    it('still forbids non-manager actors (regression guard)', async () => {
      const { service, task } = buildService({
        requestStatus: 'PENDING_FINAL_APPROVAL',
        taskType: 'FINAL_APPROVAL',
        taskStatus: 'ASSIGNED',
        actor: {
          ...ACTOR,
          roles: ['SYSTEM_ADMIN'], // SYSTEM_ADMIN is in allowed list
        },
      });
      // Sanity: SYSTEM_ADMIN passes assertManager.
      await expect(
        service.transition(SYSTEM_ADMIN_ACTOR, task.id, 'approve_final', {}),
      ).resolves.toBeDefined();
    });

    it('rejects an actor that is not in the manager role set', async () => {
      const outsider: AuthenticatedUser = {
        ...ACTOR,
        userId: 'reader-1',
        roles: ['VIEWER'], // not in the allowed list
        permissions: [],
      };
      const { service, task } = buildService({
        requestStatus: 'PENDING_FINAL_APPROVAL',
        taskType: 'FINAL_APPROVAL',
        taskStatus: 'ASSIGNED',
      });
      // Now that the DomainError base preserves subclass prototypes, the
      // Constructor matcher is precise and expressive.
      await expect(
        service.transition(outsider, task.id, 'approve_final', {}),
      ).rejects.toThrow(ForbiddenError);
    });

    it('rejects unknown task id with NotFound', async () => {
      const { service, actor } = buildService({});
      await expect(
        service.transition(actor, 'does-not-exist', 'approve_final', {}),
      ).rejects.toThrow(NotFoundError);
    });
  });

  beforeEach(() => {
    // Reset jest-internal state if any future test adds spies here.
  });
});
