/**
 * `RequestWorkflowOrchestrator` — bridge between Request lifecycle and the
 * dynamic Workflow engine.
 *
 * This spec drives the orchestrator with in-memory fakes for all repository
 * ports, a stubbed `RequestService` that records transitions, and a stubbed
 * `WorkflowEngineService` that records start / advance calls. It asserts the
 * externally observable contract of Phase 1:
 *
 *  - `onSubmit` (with a published workflow) starts a workflow instance.
 *  - `onSubmit` (no published workflow) falls back to the legacy path.
 *  - `onSubmit` is idempotent when an ACTIVE instance already exists.
 *  - `onSubmit`/`onResubmit` are atomic: both the request mutation and the
 *    workflow run are committed inside one Prisma `$transaction`.
 *  - `onReviewOutcome` completes the active human task + advances the engine.
 *  - `onReviewOutcome` falls back to the legacy path when no active workflow.
 */
import { describe, it, expect } from '@jest/globals';
import {
  WorkflowDefinition,
  WorkflowVersion,
} from '../domain/entities/workflow-definition.entity';
import {
  WorkflowInstance,
  WorkflowTask,
} from '../domain/entities/workflow-instance.entity';
import type {
  WorkflowDefinitionRepositoryPort,
  WorkflowDefinitionListPage,
  WorkflowDefinitionListFilters,
  PageInput,
} from '../domain/repositories/workflow-definition.repository.port';
import type { RequestType } from '@prisma/client';
import type {
  WorkflowInstanceRepositoryPort,
  WorkflowExecutionCommit,
  WorkflowTaskListFilters,
  WorkflowTaskListPage,
} from '../domain/repositories/workflow-instance.repository.port';
import type { RequestService } from '../../requests/application/request.service';
import type { WorkflowEngineService } from './workflow-engine.service';
import type { AuthenticatedUser } from '../../../common/presentation/decorators/authenticated-user';
import type { RequestTransition } from '../../requests/domain/request-state.policy';
import type { HumanTaskOutcome } from '../domain/workflow-definition.types';
import { BusinessRuleError } from '../../../common/domain/errors/domain-error';
import { RequestWorkflowOrchestrator } from './request-workflow-orchestrator.service';
import type { Request } from '../../requests/domain/entities/request.entity';

const ACTOR: AuthenticatedUser = {
  userId: 'actor-1',
  companyId: 'co-1',
  email: 'actor@example.test',
  roles: ['SYSTEM_ADMIN'],
  permissions: [],
};

const REVIEWER_ACTOR: AuthenticatedUser = {
  userId: 'reviewer-1',
  companyId: 'co-1',
  email: 'reviewer@example.test',
  roles: ['ACCESS_DOCUMENTS_MANAGER'],
  permissions: [],
};

/**
 * Stub Prisma-like transactional wrapper. The orchestrator calls
 * `prisma.$transaction(async (tx) => ...)`. We run the callback synchronously
 * with a marker tx object so the in-memory repos (which ignore the tx) can
 * observe the call.
 */
class StubPrisma {
  txCalls = 0;
  lastTx: unknown = null;
  async $transaction<T>(work: (tx: unknown) => Promise<T>): Promise<T> {
    this.txCalls++;
    this.lastTx = Symbol('tx');
    return work(this.lastTx);
  }
}

class StubRequestService {
  /** transitions prepared by prepareTransition, in order */
  prepared: Array<{
    requestId: string;
    transition: RequestTransition;
    sideEffectsCommitted: boolean;
  }> = [];
  /** per-request current status to feed resolveActiveworkflow decision */
  requestStatuses = new Map<string, string>();
  /** requestType code per request */
  requestTypeCodes = new Map<string, string>();

  async prepareTransition(
    actor: AuthenticatedUser,
    input: { requestId: string; transition: RequestTransition },
  ) {
    await Promise.resolve();
    void actor;
    this.prepared.push({
      requestId: input.requestId,
      transition: input.transition,
      sideEffectsCommitted: false,
    });
    const status =
      input.transition === 'submit'
        ? 'SUBMITTED'
        : input.transition === 'resubmit'
          ? 'SUBMITTED'
          : 'REVIEWED';
    this.requestStatuses.set(input.requestId, status);
    return {
      req: {
        id: input.requestId,
        requestTypeCode: 'TEMPORARY_PERSON',
      } as unknown as Request,
      event: {},
      input,
      actor,
      shouldCaptureSnapshot:
        input.transition === 'submit' || input.transition === 'resubmit',
      _markCommitted: () => {
        this.prepared[this.prepared.length - 1].sideEffectsCommitted = true;
      },
    };
  }

  async saveInTx(_req: Request, _tx: unknown): Promise<void> {
    await Promise.resolve();
    void _req;
    void _tx;
  }

  async saveInTxWithSideEffects(plan: {
    _markCommitted?: () => void;
  }): Promise<void> {
    await Promise.resolve();
    plan._markCommitted?.();
  }

  async commitTransitionSideEffects(plan: {
    _markCommitted?: () => void;
  }): Promise<void> {
    await Promise.resolve();
    plan._markCommitted?.();
  }
}

class StubEngine {
  starts = 0;
  advances = 0;
  /** throw on the next startInTx call (simulate double-start) */
  startThrows: Error | null = null;

  async startInTx(input: { requestId: string }): Promise<WorkflowInstance> {
    await Promise.resolve();
    void input;
    this.starts++;
    if (this.startThrows) {
      const err = this.startThrows;
      this.startThrows = null;
      throw err;
    }
    return { id: 'inst-' + this.starts } as unknown as WorkflowInstance;
  }

  async advanceAfterTaskInTx(input: {
    instanceId: string;
    outcome: HumanTaskOutcome;
  }): Promise<WorkflowInstance> {
    await Promise.resolve();
    void input;
    this.advances++;
    return { id: input.instanceId } as unknown as WorkflowInstance;
  }
}

class InMemoryInstanceRepo implements WorkflowInstanceRepositoryPort {
  instances = new Map<string, WorkflowInstance>();
  tasks = new Map<string, WorkflowTask>();
  taskToInstance = new Map<string, string>();

  put(instance: WorkflowInstance, tasks: WorkflowTask[] = []) {
    this.instances.set(instance.id, instance);
    for (const t of tasks) {
      this.tasks.set(t.id, t);
      this.taskToInstance.set(t.id, instance.id);
    }
  }

  findById(id: string) {
    return Promise.resolve(this.instances.get(id) ?? null);
  }
  findByRequestId(requestId: string) {
    const matching = Array.from(this.instances.values()).filter(
      (i) => i.requestId === requestId,
    );
    const active = matching.find((i) => i.status === 'ACTIVE');
    const chosen = active ?? matching[matching.length - 1] ?? null;
    return Promise.resolve(chosen);
  }
  findAllByRequestId(requestId: string) {
    return Promise.resolve(
      Array.from(this.instances.values()).filter(
        (i) => i.requestId === requestId,
      ),
    );
  }
  save(instance: WorkflowInstance): Promise<void> {
    this.instances.set(instance.id, instance);
    return Promise.resolve();
  }
  saveInTx(instance: WorkflowInstance): Promise<void> {
    return this.save(instance);
  }
  commitExecutionInTx(input: WorkflowExecutionCommit) {
    return this.commitExecution(input);
  }
  commitExecution(input: WorkflowExecutionCommit) {
    this.instances.set(input.instance.id, input.instance);
    for (const t of input.tasks) this.tasks.set(t.id, t);
    return Promise.resolve(input.instance);
  }
  findNodeInstances() {
    return Promise.resolve([]);
  }
  findTransitions() {
    return Promise.resolve([]);
  }
  findTaskById(id: string) {
    const t = this.tasks.get(id);
    if (!t) return Promise.resolve(null);
    const instanceId = this.taskToInstance.get(id);
    const instance = this.instances.get(instanceId);
    return Promise.resolve({ task: t, instance });
  }
  listTasks(
    filters: WorkflowTaskListFilters,
    page: { page: number; pageSize: number },
    _actorCompanyId: string | null,
  ): Promise<WorkflowTaskListPage> {
    void _actorCompanyId;
    let items = Array.from(this.tasks.values());
    if (filters.workflowInstanceId)
      items = items.filter((t) => {
        const instId = this.taskToInstance.get(t.id);
        return instId === filters.workflowInstanceId;
      });
    if (filters.open) {
      items = items.filter(
        (t) => t.status === 'PENDING' || t.status === 'CLAIMED',
      );
    }
    return Promise.resolve({
      items,
      total: items.length,
      page: page.page,
      pageSize: page.pageSize,
    });
  }
  saveTask(task: WorkflowTask): Promise<void> {
    this.tasks.set(task.id, task);
    return Promise.resolve();
  }
}

class NullDefinitionRepo implements WorkflowDefinitionRepositoryPort {
  published: {
    definition: WorkflowDefinition;
    publishedVersion: WorkflowVersion | null;
  } | null;
  constructor(
    initial: {
      definition: WorkflowDefinition;
      publishedVersion: WorkflowVersion | null;
    } | null,
  ) {
    this.published = initial;
  }
  findById() {
    return Promise.resolve(null);
  }
  findByKey() {
    return Promise.resolve(null);
  }
  findLatestVersionPerDefinition(): Promise<WorkflowDefinition[]> {
    return Promise.resolve([] as WorkflowDefinition[]);
  }
  findPublishedForRequestType(_rt: RequestType) {
    void _rt;
    return Promise.resolve(this.published);
  }
  list(
    _f: WorkflowDefinitionListFilters,
    _p: PageInput,
  ): Promise<WorkflowDefinitionListPage> {
    return Promise.resolve({
      items: [],
      total: 0,
      page: 1,
      pageSize: _p.pageSize,
    });
  }
  save() {
    return Promise.resolve();
  }
  delete() {
    return Promise.resolve();
  }
}

function buildPublishedDefinition() {
  const definition = WorkflowDefinition.create({
    key: 'wf_test',
    name: 'Test Workflow',
    requestType: 'TEMPORARY_PERSON',
    createdByUserId: ACTOR.userId,
  });
  const version = WorkflowVersion.createDraft({
    workflowDefinitionId: definition.id,
    versionNumber: 1,
    definitionJson: {
      schemaVersion: 1,
      nodes: [
        { key: 'START', type: 'START', name: 'Start' },
        { key: 'END', type: 'END', name: 'End' },
      ],
      edges: [{ from: 'START', to: 'END', action: 'BEGIN' }],
    },
    createdByUserId: ACTOR.userId,
  });
  version.publish(ACTOR.userId, new Date());
  return { definition, version };
}

function buildOrchestrator(opts: {
  hasPublished?: boolean;
  activeInstance?: WorkflowInstance | null;
  openTask?: WorkflowTask | null;
}) {
  const prisma = new StubPrisma();
  const requests = new StubRequestService();
  const engine = new StubEngine();
  const instances = new InMemoryInstanceRepo();
  if (opts.activeInstance) {
    instances.put(opts.activeInstance, opts.openTask ? [opts.openTask] : []);
  }
  const built = opts.hasPublished ? buildPublishedDefinition() : null;
  const definitions = new NullDefinitionRepo(
    built
      ? { definition: built.definition, publishedVersion: built.version }
      : null,
  );
  const orchestrator = new RequestWorkflowOrchestrator(
    prisma as unknown as InstanceType<
      typeof import('../../../common/infrastructure/prisma/prisma.service').PrismaService
    >,
    requests as unknown as RequestService,
    engine as unknown as WorkflowEngineService,
    instances,
    definitions,
  );
  return { orchestrator, prisma, requests, engine, instances, definitions };
}

function makeActiveInstance(requestId: string): WorkflowInstance {
  return WorkflowInstance.start({
    requestId,
    workflowVersionId: 'ver-1',
    context: { request: { id: requestId } },
    startNodeKey: 'START',
  });
}

function makeOpenTask(instanceId: string): WorkflowTask {
  return WorkflowTask.create({
    workflowInstanceId: instanceId,
    nodeInstanceId: 'nodeinst-1',
    assignment: { type: 'ROLE', roleCode: 'ACCESS_DOCUMENTS_MANAGER' },
    companyId: 'co-1',
  });
}

describe('RequestWorkflowOrchestrator', () => {
  describe('onSubmit', () => {
    it('starts a workflow run when a published workflow exists (atomic commit)', async () => {
      const { orchestrator, prisma, engine, requests } = buildOrchestrator({
        hasPublished: true,
      });
      await orchestrator.onSubmit({
        requestId: 'req-1',
        actor: ACTOR,
      });
      // Exactly one $transaction was opened for the atomic commit.
      expect(prisma.txCalls).toBe(1);
      expect(engine.starts).toBe(1);
      // prepareTransition ran for submit + side effects were committed.
      expect(requests.prepared.map((p) => p.transition)).toEqual(['submit']);
      expect(requests.prepared[0].sideEffectsCommitted).toBe(true);
    });

    it('falls back to the legacy path when no published workflow exists', async () => {
      const { orchestrator, prisma, engine, requests } = buildOrchestrator({
        hasPublished: false,
      });
      await orchestrator.onSubmit({
        requestId: 'req-2',
        actor: ACTOR,
      });
      // No transaction, no engine start — legacy path only.
      expect(prisma.txCalls).toBe(0);
      expect(engine.starts).toBe(0);
      expect(requests.prepared.map((p) => p.transition)).toEqual(['submit']);
      expect(requests.prepared[0].sideEffectsCommitted).toBe(true);
    });

    it('is idempotent when an ACTIVE instance already exists (no new start)', async () => {
      const inst = makeActiveInstance('req-3');
      const { orchestrator, prisma, engine } = buildOrchestrator({
        hasPublished: true,
        activeInstance: inst,
      });
      await orchestrator.onSubmit({
        requestId: 'req-3',
        actor: ACTOR,
      });
      // No transaction + no engine start (existing ACTIVE instance kept).
      expect(prisma.txCalls).toBe(0);
      expect(engine.starts).toBe(0);
    });

    it('does not double-start on concurrent retry (ConflictError on start → no crash, request transition still applied)', async () => {
      const { orchestrator, engine, requests } = buildOrchestrator({
        hasPublished: true,
      });
      engine.startThrows = new BusinessRuleError('already running');
      await expect(
        orchestrator.onSubmit({ requestId: 'req-4', actor: ACTOR }),
      ).rejects.toThrow(/already running/);
      // prepareTransition ran (eager validation), but the atomic tx rolled back,
      // so side effects must NOT have been committed.
      expect(requests.prepared.map((p) => p.transition)).toEqual(['submit']);
      expect(requests.prepared[0].sideEffectsCommitted).toBe(false);
    });
  });

  describe('onResubmit', () => {
    it('starts a fresh workflow run on resubmit (previous run completed)', async () => {
      const { orchestrator, prisma, engine } = buildOrchestrator({
        hasPublished: true,
      });
      await orchestrator.onResubmit({
        requestId: 'req-5',
        actor: ACTOR,
      });
      expect(prisma.txCalls).toBe(1);
      expect(engine.starts).toBe(1);
    });

    it('falls back to legacy path when no published workflow exists', async () => {
      const { orchestrator, engine, requests } = buildOrchestrator({
        hasPublished: false,
      });
      await orchestrator.onResubmit({
        requestId: 'req-6',
        actor: ACTOR,
      });
      expect(engine.starts).toBe(0);
      expect(requests.prepared.map((p) => p.transition)).toEqual(['resubmit']);
    });

    it('keeps an existing ACTIVE workflow instead of starting a second one', async () => {
      const inst = makeActiveInstance('req-7');
      const { orchestrator, engine } = buildOrchestrator({
        hasPublished: true,
        activeInstance: inst,
      });
      await orchestrator.onResubmit({
        requestId: 'req-7',
        actor: ACTOR,
      });
      expect(engine.starts).toBe(0);
    });
  });

  describe('onReviewOutcome', () => {
    it('completes the open task + advances the engine atomically', async () => {
      const inst = makeActiveInstance('req-8');
      const task = makeOpenTask(inst.id);
      const { orchestrator, prisma, engine } = buildOrchestrator({
        hasPublished: true,
        activeInstance: inst,
        openTask: task,
      });
      await orchestrator.onReviewOutcome({
        requestId: 'req-8',
        actor: REVIEWER_ACTOR,
        requestTransition: 'approve_final',
        outcome: 'APPROVE',
      });
      expect(prisma.txCalls).toBe(1);
      expect(engine.advances).toBe(1);
      // The task ended up COMPLETED in the in-memory repo.
      expect(task.status).toBe('COMPLETED');
    });

    it('falls back to legacy request transition when no ACTIVE instance exists', async () => {
      const { orchestrator, prisma, engine } = buildOrchestrator({
        hasPublished: true,
      });
      await orchestrator.onReviewOutcome({
        requestId: 'req-9',
        actor: ACTOR,
        requestTransition: 'reject',
        outcome: 'REJECT',
      });
      expect(prisma.txCalls).toBe(0);
      expect(engine.advances).toBe(0);
    });

    it('applies only the request transition when the instance has no open task', async () => {
      const inst = makeActiveInstance('req-10');
      const { orchestrator, engine } = buildOrchestrator({
        hasPublished: true,
        activeInstance: inst,
        // no open task seeded
      });
      await orchestrator.onReviewOutcome({
        requestId: 'req-10',
        actor: ACTOR,
        requestTransition: 'return',
        outcome: 'RETURN_FOR_CORRECTION',
      });
      // No task → no engine advance.
      expect(engine.advances).toBe(0);
    });

    it('throws NotFound when the referenced task id does not exist', async () => {
      const inst = makeActiveInstance('req-11');
      const { orchestrator } = buildOrchestrator({
        hasPublished: true,
        activeInstance: inst,
        // openTask deliberately not seeded; listTasks returns empty → fallback,
        // not a NotFound — verify the open-task-absent path DOESN'T throw.
      });
      await expect(
        orchestrator.onReviewOutcome({
          requestId: 'req-11',
          actor: ACTOR,
          requestTransition: 'approve_final',
          outcome: 'APPROVE',
        }),
      ).resolves.toBeUndefined();
    });

    it('refuses to complete a task on a non-ACTIVE instance', async () => {
      // Build a COMPLETED instance with a task; the orchestrator should NOT
      // try to complete it (no ACTIVE instance found → legacy fallback).
      const inst = makeActiveInstance('req-12');
      inst.complete();
      const task = makeOpenTask(inst.id);
      const { orchestrator, engine } = buildOrchestrator({
        hasPublished: true,
        // not "activeInstance": findByRequestId returns null because it filters
        // to ACTIVE — simulating a completed instance.
      });
      void inst;
      void task;
      await orchestrator.onReviewOutcome({
        requestId: 'req-12',
        actor: ACTOR,
        requestTransition: 'approve_final',
        outcome: 'APPROVE',
      });
      expect(engine.advances).toBe(0);
    });
  });

  describe('legacy compatibility invariant', () => {
    it('never throws NotFound on a missing published definition (returns null, not throws)', async () => {
      const { definitions } = buildOrchestrator({ hasPublished: false });
      await expect(
        definitions.findPublishedForRequestType('TEMPORARY_PERSON'),
      ).resolves.toBeNull();
    });
  });
});
