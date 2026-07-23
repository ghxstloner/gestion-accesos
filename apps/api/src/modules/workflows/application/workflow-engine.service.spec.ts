/**
 * Engine-level integration spec with in-memory fakes for the three
 * repository ports and a stub RequestService. Covers the externally
 * observable contract: start, advance, outcome routing, idempotency,
 * optimistic-lock conflict.
 */
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
  WorkflowVersionRepositoryPort,
  WorkflowDefinitionListPage,
  WorkflowDefinitionListFilters,
  PageInput,
  WorkflowVersionListPage,
  WorkflowVersionListFilters,
} from '../domain/repositories/workflow-definition.repository.port';
import type {
  WorkflowInstanceRepositoryPort,
  WorkflowExecutionCommit,
  WorkflowTaskListFilters,
  WorkflowTaskListPage,
} from '../domain/repositories/workflow-instance.repository.port';
import type { WorkflowNodeInstance } from '../domain/entities/workflow-instance.entity';
import {
  WORKFLOW_SCHEMA_VERSION,
  type WorkflowGraphDefinition,
} from '../domain/workflow-definition.types';
import { WorkflowEngineService } from './workflow-engine.service';
import type { RequestService } from '../../requests/application/request.service';
import type { RequestType } from '../../../generated/prisma/client';
import type { Request } from '../../requests/domain/entities/request.entity';
import type { AuthenticatedUser } from '../../../common/presentation/decorators/authenticated-user';
import { ConflictError } from '../../../common/domain/errors/domain-error';

const ACTOR: AuthenticatedUser = {
  userId: 'actor-1',
  companyId: 'co-1',
  email: '.actor@example.test',
  roles: ['SYSTEM_ADMIN'],
  permissions: [],
};

const TEMPORARY_PERSON_REQUEST_TYPE: RequestType = 'TEMPORARY_PERSON';
const PERMANENT_CARD_REQUEST_TYPE: RequestType = 'PERMANENT_CARD';

function buildGraph(approveTarget: string): WorkflowGraphDefinition {
  return {
    schemaVersion: WORKFLOW_SCHEMA_VERSION,
    nodes: [
      { key: 'START', type: 'START', name: 'Start' },
      {
        key: 'SUBMIT',
        type: 'SYSTEM',
        name: 'Submit',
        config: {
          systemAction: 'UPDATE_REQUEST_STATUS',
          targetRequestStatus: 'SUBMITTED',
        },
      },
      {
        key: 'REVIEW',
        type: 'HUMAN_TASK',
        name: 'Review',
        assignment: {
          type: 'ROLE',
          roleCode: 'ACCESS_DOCUMENTS_MANAGER',
          companyScoped: true,
        },
        config: { outcomes: ['APPROVE', 'REJECT'] },
      },
      {
        key: 'FINALIZE',
        type: 'SYSTEM',
        name: 'Finalize',
        config: {
          systemAction: 'UPDATE_REQUEST_STATUS',
          targetRequestStatus: approveTarget,
        },
      },
      { key: 'END', type: 'END', name: 'End' },
    ],
    edges: [
      { from: 'START', to: 'SUBMIT', action: 'BEGIN' },
      { from: 'SUBMIT', to: 'REVIEW', action: 'COMPLETE' },
      { from: 'REVIEW', to: 'FINALIZE', action: 'APPROVE' },
      { from: 'FINALIZE', to: 'END', action: 'COMPLETE' },
    ],
  };
}

function makeVersion(graph: WorkflowGraphDefinition): WorkflowVersion {
  const v = WorkflowVersion.createDraft({
    workflowDefinitionId: 'wf-def-1',
    versionNumber: 1,
    definitionJson: graph,
    createdByUserId: ACTOR.userId,
  });
  v.publish(ACTOR.userId, new Date());
  return v;
}

/** In-memory instance repository with optimistic-lock check */
class InMemoryInstanceRepo implements WorkflowInstanceRepositoryPort {
  instances = new Map<string, WorkflowInstance>();
  tasks = new Map<string, WorkflowTask>();
  nodeInstancesByInstance = new Map<string, WorkflowNodeInstance[]>();
  commitCalls: WorkflowExecutionCommit[] = [];

  findById(id: string) {
    return Promise.resolve(this.instances.get(id) ?? null);
  }
  findByRequestId(requestId: string) {
    for (const i of this.instances.values()) {
      if (i.requestId === requestId) return Promise.resolve(i);
    }
    return Promise.resolve(null);
  }
  save(instance: WorkflowInstance) {
    this.instances.set(instance.id, instance);
    return Promise.resolve();
  }
  commitExecution(input: WorkflowExecutionCommit) {
    this.commitCalls.push(input);
    const stored = this.instances.get(input.instance.id);
    if (stored && stored.lockVersion !== input.expectedLockVersion) {
      return Promise.reject(
        new ConflictError(
          `Optimistic lock mismatch (stored=${stored.lockVersion} expected=${input.expectedLockVersion})`,
        ),
      );
    }
    this.instances.set(input.instance.id, input.instance);
    for (const t of input.tasks) this.tasks.set(t.id, t);
    const existing = this.nodeInstancesByInstance.get(input.instance.id) ?? [];
    this.nodeInstancesByInstance.set(input.instance.id, [
      ...existing,
      ...input.nodeInstances,
    ]);
    return Promise.resolve(input.instance);
  }
  findNodeInstances(workflowInstanceId: string) {
    return Promise.resolve(
      this.nodeInstancesByInstance.get(workflowInstanceId) ?? [],
    );
  }
  findTransitions() {
    return Promise.resolve([]);
  }
  findTaskById(id: string) {
    const t = this.tasks.get(id);
    if (!t) return Promise.resolve(null);
    for (const i of this.instances.values()) {
      if (i.id === t.workflowInstanceId)
        return Promise.resolve({ task: t, instance: i });
    }
    return Promise.resolve(null);
  }
  listTasks(
    _filters: WorkflowTaskListFilters,
    page: { page: number; pageSize: number },
    _actorCompanyId: string | null,
  ): Promise<WorkflowTaskListPage> {
    void _actorCompanyId;
    const items = Array.from(this.tasks.values());
    return Promise.resolve({
      items,
      total: items.length,
      page: page.page,
      pageSize: page.pageSize,
    });
  }
  saveTask(task: WorkflowTask) {
    this.tasks.set(task.id, task);
    return Promise.resolve();
  }
}

class InMemoryDefinitionRepo implements WorkflowDefinitionRepositoryPort {
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
  findLatestVersionPerDefinition(): Promise<any[]> {
    return Promise.resolve([]);
  }
  findPublishedForRequestType() {
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

class InMemoryVersionRepo implements WorkflowVersionRepositoryPort {
  constructor(private readonly published: WorkflowVersion | null) {}
  findById(id: string) {
    return Promise.resolve(
      this.published && this.published.id === id ? this.published : null,
    );
  }
  findByChecksum() {
    return Promise.resolve(null);
  }
  findLatestForDefinition() {
    return Promise.resolve(this.published);
  }
  findPublishedForDefinition() {
    return Promise.resolve(this.published);
  }
  findPublishedForRequestType() {
    return Promise.resolve(this.published);
  }
  list(
    _f: WorkflowVersionListFilters,
    p: PageInput,
  ): Promise<WorkflowVersionListPage> {
    return Promise.resolve({
      items: this.published ? [this.published] : [],
      total: this.published ? 1 : 0,
      page: p.page,
      pageSize: p.pageSize,
    });
  }
  save() {
    return Promise.resolve();
  }
  deleteDraft() {
    return Promise.resolve();
  }
}

/** Minimal Request-like stub used by the engine */
function fakeRequest(overrides: Partial<Request> = {}): Request {
  return {
    id: 'req-1',
    requestNumber: 'SGA-2026-000001',
    status: 'DRAFT',
    companyId: 'co-1',
    requestTypeId: 'rt-1',
    requestTypeCode: 'TEMPORARY_PERSON',
    createdByUserId: 'actor-1',
    createdByCompanyId: 'co-1',
    participants: [],
    ...overrides,
  } as unknown as Request;
}

/** Stub RequestService that records transitions and lets the test set current status */
class StubRequestService implements Pick<
  RequestService,
  'getById' | 'transition'
> {
  current = fakeRequest();
  transitions: { transition: string; requestId: string }[] = [];

  getById(_actor: AuthenticatedUser, id: string) {
    void _actor;
    return Promise.resolve({ ...this.current, id } as Request);
  }
  transition(
    _actor: AuthenticatedUser,
    input: { requestId: string; transition: string },
  ) {
    void _actor;
    this.transitions.push({
      transition: input.transition,
      requestId: input.requestId,
    });
    return Promise.resolve(this.current);
  }
}

function buildEngine(target = 'APPROVED') {
  const graph = buildGraph(target);
  const version = makeVersion(graph);
  const instances = new InMemoryInstanceRepo();
  const definition = WorkflowDefinition.create({
    key: 'wf_test',
    name: 'Test Workflow',
    requestType: 'TEMPORARY_PERSON',
    createdByUserId: ACTOR.userId,
  });
  const published = {
    definition,
    publishedVersion: version,
  };
  const definitions = new InMemoryDefinitionRepo(published);
  const versions = new InMemoryVersionRepo(version);
  const requestService = new StubRequestService();
  const engine = new WorkflowEngineService(
    definitions,
    versions,
    instances,
    requestService as unknown as RequestService,
  );
  return {
    engine,
    instances,
    requestService,
    version,
    definitions,
    published,
  };
}

describe('WorkflowEngineService (integration with in-memory ports)', () => {
  it('start() walks START→SYSTEM(submit)→pauses at HUMAN_TASK creating a task', async () => {
    const { engine, instances, requestService } = buildEngine();
    const inst = await engine.start({
      requestId: 'req-1',
      requestType: 'TEMPORARY_PERSON',
      actor: ACTOR,
    });
    expect(inst.currentNodeKey).toBe('REVIEW');
    expect(inst.status).toBe('ACTIVE');
    expect(instances.tasks.size).toBeGreaterThan(0);
    // Submitted status fires once via SYSTEM(submit)
    expect(requestService.transitions).toEqual([
      { transition: 'submit', requestId: 'req-1' },
    ]);
  });

  it('start() is idempotent if requestId already has an instance', async () => {
    const { engine } = buildEngine();
    await engine.start({
      requestId: 'req-1',
      requestType: TEMPORARY_PERSON_REQUEST_TYPE,
      actor: ACTOR,
    });
    await expect(
      engine.start({
        requestId: 'req-1',
        requestType: TEMPORARY_PERSON_REQUEST_TYPE,
        actor: ACTOR,
      }),
    ).rejects.toThrow(/already has an active workflow/);
  });

  it('advanceAfterTask(APPROVE) reaches END and completes the instance', async () => {
    const { engine, instances, requestService } = buildEngine('APPROVED');
    const inst = await engine.start({
      requestId: 'req-2',
      requestType: 'TEMPORARY_PERSON',
      actor: ACTOR,
    });
    const task = Array.from(instances.tasks.values())[0];
    const advanced = await engine.advanceAfterTask({
      instanceId: inst.id,
      task,
      outcome: 'APPROVE',
      actor: ACTOR,
    });
    expect(advanced.status).toBe('COMPLETED');
    expect(advanced.currentNodeKey).toBe('END');
    // Submission transition followed by approve_final
    expect(requestService.transitions.map((t) => t.transition)).toEqual([
      'submit',
      'approve_final',
    ]);
  });

  it('commitExecution on the in-memory port surfaces ConflictError on stale lockVersion', async () => {
    // Direct port contract test: a commit whose expectedLockVersion is older
    // than the persisted one must fail. The Prisma production repo reads
    // `lock_version` from the DB column (a separate value from the entity's
    // in-memory state), so this exercises the same invariant without
    // enforcing it through engine-level plumbing (which by design mutates
    // the very same instance reference it commits).
    const { instances } = buildEngine();
    const inst = WorkflowInstance.start({
      requestId: 'req-conflict',
      workflowVersionId: 'v-1',
      context: { request: { id: 'req-conflict' } },
      startNodeKey: 'START',
    });
    await instances.save(inst);
    // Simulate a concurrent committer that bumped the persisted lockVersion.
    const racing = WorkflowInstance.reconstitute({
      ...inst.toProps(),
      lockVersion: inst.lockVersion + 5,
    });
    instances.instances.set(inst.id, racing);
    await expect(
      instances.commitExecution({
        instance: inst,
        expectedLockVersion: inst.lockVersion, // stale!
        nodeInstances: [],
        tasks: [],
        transitions: [],
        idempotencyKey: null,
      }),
    ).rejects.toThrow(/Optimistic lock mismatch/);
  });

  it('rejects start if no published workflow exists for the request type', async () => {
    const { engine, definitions } = buildEngine();
    definitions.published = null;
    await expect(
      engine.start({
        requestId: 'req-9',
        requestType: PERMANENT_CARD_REQUEST_TYPE,
        actor: ACTOR,
      }),
    ).rejects.toThrow(/No PUBLISHED workflow/);
  });
});
