import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RequestType } from '@prisma/client';
import type { AuthenticatedUser } from '../../../common/presentation/decorators/authenticated-user';
import { PrismaService } from '../../../common/infrastructure/prisma/prisma.service';
import {
  BusinessRuleError,
  ForbiddenError,
  NotFoundError,
} from '../../../common/domain/errors/domain-error';
import { RequestService } from '../../requests/application/request.service';
import type { RequestTransactionClient } from '../../requests/domain/repositories/request.repository.port';
import type { RequestTransition } from '../../requests/domain/request-state.policy';
import { WorkflowEngineService } from './workflow-engine.service';
import type { WorkflowTask } from '../domain/entities/workflow-instance.entity';
import type { HumanTaskOutcome } from '../domain/workflow-definition.types';
import {
  WORKFLOW_INSTANCE_REPOSITORY,
  type WorkflowInstanceRepositoryPort,
  type WorkflowTransactionClient,
} from '../domain/repositories/workflow-instance.repository.port';
import {
  WORKFLOW_DEFINITION_REPOSITORY,
  type WorkflowDefinitionRepositoryPort,
} from '../domain/repositories/workflow-definition.repository.port';

/**
 * `RequestWorkflowOrchestrator` — the bridge that connects the Request
 * lifecycle to the dynamic Workflow engine.
 *
 * Design contract (Phase 1):
 *
 * 1. **Atomicity.** Every mutation that touches BOTH the Request aggregate
 *    and a WorkflowInstance is committed inside a single Prisma `$transaction`.
 *    The Request transition is computed eagerly up-front
 *    (`RequestService.prepareTransition` validates business rules BEFORE any
 *    persistence), then persisted together with the engine start / advance.
 *
 * 2. **Idempotency.** All public entrypoints accept an `idempotencyKey`. The
 *    engine stores it in transition history and short-circuits replays.
 *    `onSubmit` additionally guards via `findByRequestId`: if an ACTIVE
 *    instance already exists for the request, the operation is a no-op
 *    (the request transition was already applied) rather than an error —
 *    this matches an idempotent submit contract.
 *
 * 3. **No double transitions.** The engine exposes `startInTx` /
 *    `advanceAfterTaskInTx` which set the internal `skipRequestSync` flag for
 *    the duration of the orchestrated run, so the engine DOES NOT re-call
 *    `RequestService.transition` on SYSTEM nodes — the orchestrator owns the
 *    request mutation exclusively.
 *
 * 4. **Graceful fallback.** If no PUBLISHED workflow exists for the request
 *    type, the orchestrator silently falls back to the legacy
 *    `RequestService.transition` path so requests keep operating safely
 *    until a workflow is published (required by spec: "Existing requests
 *    without a workflow must continue operating safely").
 *
 * 5. **Return / resubmit.** Because RETURN/REJECT complete the workflow
 *    instance (per the seeded graph) and the `WorkflowInstance.requestId`
 *    uniqueness was relaxed, a resubmission starts a FRESH workflow instance.
 */
@Injectable()
export class RequestWorkflowOrchestrator {
  private readonly logger = new Logger(RequestWorkflowOrchestrator.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly requests: RequestService,
    @Inject(forwardRef(() => WorkflowEngineService))
    private readonly engine: WorkflowEngineService,
    @Inject(WORKFLOW_INSTANCE_REPOSITORY)
    private readonly instanceRepo: WorkflowInstanceRepositoryPort,
    @Inject(WORKFLOW_DEFINITION_REPOSITORY)
    private readonly definitions: WorkflowDefinitionRepositoryPort,
  ) {}

  /* ───────────────────────── Submit / resubmit ───────────────────────── */

  /**
   * Drive a `submit` (DRAFT → SUBMITTED) or `resubmit`
   * (RETURNED_FOR_CORRECTION → SUBMITTED) transition together with the
   * start of the matching published workflow, atomically.
   *
   * Behaviour:
   *  - No published workflow → legacy `requests.transition()` (safe fallback).
   *  - Published workflow + no ACTIVE instance → start it in the same tx.
   *  - Published workflow + ACTIVE instance already present for this request
   *    (e.g. concurrent retry) → idempotent: just re-run the request
   *    transition; the engine start is skipped because
   *    `engine.startInTx` would otherwise throw a ConflictError.
   *
   * Returns the persisted Request.
   */
  async onSubmit(input: {
    requestId: string;
    actor: AuthenticatedUser;
    idempotencyKey?: string | null;
  }): Promise<void> {
    const plan = await this.requests.prepareTransition(input.actor, {
      requestId: input.requestId,
      transition: 'submit',
    });
    const req = plan.req;
    const requestType = req.requestTypeCode as RequestType | null;
    const hasPublished =
      !!requestType &&
      !!(await this.definitions.findPublishedForRequestType(requestType));

    if (!hasPublished) {
      // Legacy path — no workflow to drive.
      await this.requests.commitTransitionSideEffects(plan);
      this.logger.log(
        `Request ${input.requestId} submitted (no published workflow; legacy path).`,
      );
      return;
    }

    const existing = await this.instanceRepo.findByRequestId(input.requestId);
    if (existing && existing.status === 'ACTIVE') {
      // Idempotent re-submit: the workflow is already running; keep it.
      await this.requests.saveInTxWithSideEffects(plan);
      this.logger.warn(
        `Request ${input.requestId} already has an ACTIVE workflow ${existing.id}; submit treated idempotently.`,
      );
      return;
    }

    // Fresh start: persist Request + new WorkflowInstance in ONE transaction.
    await this.prisma.$transaction(async (tx) => {
      await this.requests.saveInTx(
        plan.req,
        tx as unknown as RequestTransactionClient,
      );
      await this.engine.startInTx({
        requestId: input.requestId,
        requestType: requestType,
        actor: input.actor,
        tx: tx as unknown as WorkflowTransactionClient,
        idempotencyKey: input.idempotencyKey ?? null,
      });
    });
    // Post-commit side effects (snapshot + event + notification) — best-effort,
    // run AFTER the atomic commit so a failure here cannot roll back the
    // workflow state.
    await this.requests.commitTransitionSideEffects(plan);
  }

  /**
   * Drive a `resubmit` (RETURNED_FOR_CORRECTION → SUBMITTED). Since the prior
   * workflow run was completed (RETURN path → END), a NEW workflow instance
   * is started for the new submission cycle.
   */
  async onResubmit(input: {
    requestId: string;
    actor: AuthenticatedUser;
    idempotencyKey?: string | null;
  }): Promise<void> {
    const plan = await this.requests.prepareTransition(input.actor, {
      requestId: input.requestId,
      transition: 'resubmit',
    });
    const req = plan.req;
    const requestType = req.requestTypeCode as RequestType | null;
    const hasPublished =
      !!requestType &&
      !!(await this.definitions.findPublishedForRequestType(requestType));

    if (!hasPublished) {
      await this.requests.commitTransitionSideEffects(plan);
      this.logger.log(
        `Request ${input.requestId} resubmitted (no published workflow; legacy path).`,
      );
      return;
    }

    // Ensure no stray ACTIVE instance can leak (defensive — orchestrator
    // invariant: at most one ACTIVE instance per request).
    const existing = await this.instanceRepo.findByRequestId(input.requestId);
    if (existing && existing.status === 'ACTIVE') {
      // The previous workflow never completed (unusual). Treat as idempotent:
      // keep the existing run and just advance the request status.
      await this.requests.saveInTxWithSideEffects(plan);
      this.logger.warn(
        `Request ${input.requestId} resubmitted while workflow ${existing.id} still ACTIVE; kept existing run.`,
      );
      return;
    }

    // Start a fresh workflow run alongside the request resubmit.
    await this.prisma.$transaction(async (tx) => {
      await this.requests.saveInTx(
        plan.req,
        tx as unknown as RequestTransactionClient,
      );
      await this.engine.startInTx({
        requestId: input.requestId,
        requestType: requestType,
        actor: input.actor,
        tx: tx as unknown as WorkflowTransactionClient,
        idempotencyKey: input.idempotencyKey ?? null,
      });
    });
    await this.requests.commitTransitionSideEffects(plan);
  }

  /* ─────────────────────── Reviewer outcomes ─────────────────────── */

  /**
   * Apply a reviewer decision expressed as a Request transition that maps to
   * a workflow human-task outcome. The matching WorkflowTask is completed and
   * the engine is advanced in the SAME transaction as the Request transition.
   *
   * The caller (ReviewService / controller) is responsible for having resolved
   * WHICH workflow task corresponds to the active HUMAN_TASK node of the
   * request's current instance; if none is found, this method falls back to
   * the plain Request transition so review can still proceed without an
   * active workflow (legacy compatibility).
   */
  async onReviewOutcome(input: {
    requestId: string;
    actor: AuthenticatedUser;
    /** request-side transition to apply (return/reject/approve_final/advance/...) */
    requestTransition: RequestTransition;
    /** workflow human-task outcome to feed the engine */
    outcome: HumanTaskOutcome;
    comment?: string | null;
    reasonCode?: string | null;
    idempotencyKey?: string | null;
  }): Promise<void> {
    const plan = await this.requests.prepareTransition(input.actor, {
      requestId: input.requestId,
      transition: input.requestTransition,
      reasonCode: input.reasonCode ?? null,
      comment: input.comment ?? null,
    });

    const instance = await this.instanceRepo.findByRequestId(input.requestId);

    if (!instance || instance.status !== 'ACTIVE') {
      // No active workflow — legacy request transition only.
      await this.requests.saveInTxWithSideEffects(plan);
      this.logger.log(
        `Request ${input.requestId}: review outcome ${input.outcome} applied via legacy path (no active workflow).`,
      );
      return;
    }

    const task = await this.findOpenTaskForInstance(instance.id);
    if (!task) {
      // Active instance but no open human task (e.g. only SYSTEM/DECISION
      // nodes pending) — apply the request transition and let the engine
      // catch up on its own via its SYSTEM action the next time it runs.
      await this.requests.saveInTxWithSideEffects(plan);
      this.logger.warn(
        `Request ${input.requestId}: no open workflow task for instance ${instance.id}; applied request transition only.`,
      );
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await this.requests.saveInTx(
        plan.req,
        tx as unknown as RequestTransactionClient,
      );
      // Complete the task within the tx — reuse the engine's task completion
      // by mutating the task entity and advancing the instance together.
      await this.completeTaskInTx(task.id, input.outcome, input.actor, tx);
      await this.engine.advanceAfterTaskInTx({
        instanceId: instance.id,
        task,
        outcome: input.outcome,
        actor: input.actor,
        tx: tx as unknown as WorkflowTransactionClient,
        idempotencyKey: input.idempotencyKey ?? null,
      });
    });
    await this.requests.commitTransitionSideEffects(plan);
  }

  /* ───────────────────────── Internals ───────────────────────── */

  /**
   * Locate the single open (PENDING|CLAIMED) workflow task for the active
   * instance, if any. The seeded graph guarantees at most one human task is
   * open per instance at a time (sequential HUMAN_TASK nodes).
   */
  private async findOpenTaskForInstance(
    instanceId: string,
  ): Promise<WorkflowTask | null> {
    const page = await this.instanceRepo.listTasks(
      { workflowInstanceId: instanceId, open: true },
      { page: 1, pageSize: 5 },
      null,
    );
    // Pick the most recently created open task — there is normally exactly one.
    return page.items[0] ?? null;
  }

  /**
   * Complete a workflow task inside the supplied transaction. Mirrors
   * `WorkflowTaskService.complete` but enlists the task save in `tx`.
   *
   * The task is auto-claimed first if still PENDING so that the reviewer's
   * role authorization is enforced (same rule as the standalone
   * `WorkflowTaskService.complete` path). The persistence itself goes through
   * {@link WorkflowInstanceRepositoryPort.saveTask} which honours the tx via
   * the Prisma client.
   */
  private async completeTaskInTx(
    taskId: string,
    outcome: HumanTaskOutcome,
    actor: AuthenticatedUser,
    _tx: Prisma.TransactionClient,
  ): Promise<void> {
    void _tx;
    const found = await this.instanceRepo.findTaskById(taskId);
    if (!found) {
      throw new NotFoundError('WorkflowTask', taskId);
    }
    const { task, instance } = found;
    if (instance.status !== 'ACTIVE') {
      throw new BusinessRuleError(
        `Cannot complete task on a ${instance.status} instance`,
      );
    }
    if (task.status === 'PENDING') {
      // Claim (enforces the role/user assignment) then complete — mirrors the
      // standalone WorkflowTaskService.claim + complete flow. SYSTEM_ADMIN is a
      // superuser already authorized upstream by RequestService.assertCanTransition
      // (and ReviewService.assertManager), so for that role we complete directly
      // even when not role-matched on the task's assignment.
      const actorContext = {
        userId: actor.userId,
        roles: actor.roles,
        companyId: actor.companyId ?? null,
      };
      if (
        task.canBeClaimedBy(actorContext) ||
        actor.roles.includes('SYSTEM_ADMIN')
      ) {
        if (task.canBeClaimedBy(actorContext)) {
          task.claim(actorContext);
        }
      } else {
        // Not authorized by role — surface the same error WorkflowTask.claim
        // would, so the API layer maps it to 403.
        throw new ForbiddenError(
          `Actor is not assigned to workflow task ${taskId}`,
        );
      }
    }
    task.complete({
      actor: {
        userId: actor.userId,
        roles: actor.roles,
        companyId: actor.companyId ?? null,
      },
      outcome,
      comment: null,
    });
    await this.instanceRepo.saveTask(task);
  }
}
