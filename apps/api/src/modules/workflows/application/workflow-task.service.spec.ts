/**
 * WorkflowTaskService spec — covers claim/complete orchestration with
 * in-memory port fakes. Pure domain behavior is already exhaustively
 * tested in workflow-instance.entity.spec.ts.
 */
import {
  WorkflowInstance,
  WorkflowTask,
  WorkflowNodeInstance,
  WorkflowTransition,
} from '../domain/entities/workflow-instance.entity';
import type {
  WorkflowInstanceRepositoryPort,
  WorkflowExecutionCommit,
  WorkflowTaskListFilters,
  WorkflowTaskListPage,
} from '../domain/repositories/workflow-instance.repository.port';
import type { AuthenticatedUser } from '../../../common/presentation/decorators/authenticated-user';
import { WorkflowTaskService } from './workflow-task.service';

const ACTOR: AuthenticatedUser = {
  userId: 'actor-1',
  companyId: 'co-1',
  email: 'actor@example.test',
  roles: ['ACCESS_DOCUMENTS_MANAGER'],
  permissions: [],
};

/** In-memory instance repository with task storage */
class FakeInstanceRepo implements WorkflowInstanceRepositoryPort {
  instances = new Map<string, WorkflowInstance>();
  tasks = new Map<string, WorkflowTask>();
  committed: WorkflowExecutionCommit[] = [];

  trackTask(task: WorkflowTask, instance: WorkflowInstance) {
    this.tasks.set(task.id, task);
    this.instances.set(instance.id, instance);
  }

  findById(id: string) {
    return Promise.resolve(this.instances.get(id) ?? null);
  }
  findByRequestId(r: string) {
    for (const i of this.instances.values())
      if (i.requestId === r) return Promise.resolve(i);
    return Promise.resolve(null);
  }
  save(i: WorkflowInstance) {
    this.instances.set(i.id, i);
    return Promise.resolve();
  }
  commitExecution(c: WorkflowExecutionCommit) {
    this.committed.push(c);
    this.instances.set(c.instance.id, c.instance);
    for (const t of c.tasks) this.tasks.set(t.id, t);
    return Promise.resolve(c.instance);
  }
  saveInTx(instance: WorkflowInstance) {
    return this.save(instance);
  }
  commitExecutionInTx(c: WorkflowExecutionCommit) {
    return this.commitExecution(c);
  }
  findNodeInstances() {
    return Promise.resolve([] as WorkflowNodeInstance[]);
  }
  findTransitions() {
    return Promise.resolve([] as WorkflowTransition[]);
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
    filters: WorkflowTaskListFilters,
    page: { page: number; pageSize: number },
    _actorCompanyId: string | null,
  ): Promise<WorkflowTaskListPage> {
    void _actorCompanyId;
    let items = Array.from(this.tasks.values());
    if (filters.status)
      items = items.filter((t) => t.status === filters.status);
    if (filters.assignedRoleCode)
      items = items.filter(
        (t) => t.assignedRoleCode === filters.assignedRoleCode,
      );
    if (filters.assignedUserId)
      items = items.filter((t) => t.assignedUserId === filters.assignedUserId);
    if (filters.claimed !== undefined)
      items = items.filter((t) =>
        filters.claimed
          ? t.status === 'CLAIMED' || t.status === 'COMPLETED'
          : t.status === 'PENDING',
      );
    const total = items.length;
    const start = (page.page - 1) * page.pageSize;
    items = items.slice(start, start + page.pageSize);
    return Promise.resolve({
      items,
      total,
      page: page.page,
      pageSize: page.pageSize,
    });
  }
  saveTask(t: WorkflowTask) {
    this.tasks.set(t.id, t);
    return Promise.resolve();
  }
}

function makeActiveInstance(): WorkflowInstance {
  return WorkflowInstance.start({
    requestId: 'req-1',
    workflowVersionId: 'v-1',
    context: { request: { id: 'req-1' }, company: { id: 'co-1' } },
    startNodeKey: 'REVIEW',
  });
}

function makePendingRoleTask(
  inst: WorkflowInstance,
  assignment: { type: 'ROLE'; roleCode: string; companyScoped?: boolean },
  companyId: string,
): WorkflowTask {
  return WorkflowTask.create({
    workflowInstanceId: inst.id,
    nodeInstanceId: 'node-' + Math.random().toString(36).slice(2),
    assignment,
    companyId,
  });
}

describe('WorkflowTaskService', () => {
  it('claim() transitions task to CLAIMED when role matches', async () => {
    const repo = new FakeInstanceRepo();
    const inst = makeActiveInstance();
    const task = makePendingRoleTask(
      inst,
      {
        type: 'ROLE',
        roleCode: 'ACCESS_DOCUMENTS_MANAGER',
        companyScoped: true,
      },
      'co-1',
    );
    repo.trackTask(task, inst);
    const svc = new WorkflowTaskService(repo);
    const out = await svc.claim(task.id, ACTOR);
    expect(out.status).toBe('CLAIMED');
    expect(out.claimedByUserId).toBe(ACTOR.userId);
  });

  it('claim() rejects actors whose role does not match the assignment', async () => {
    const repo = new FakeInstanceRepo();
    const inst = makeActiveInstance();
    const task = makePendingRoleTask(
      inst,
      { type: 'ROLE', roleCode: 'CARD_ISSUER', companyScoped: true },
      'co-1',
    );
    repo.trackTask(task, inst);
    const svc = new WorkflowTaskService(repo);
    await expect(svc.claim(task.id, ACTOR)).rejects.toThrow();
  });

  it('complete() requires prior claim by the same actor for ROLE tasks', async () => {
    const repo = new FakeInstanceRepo();
    const inst = makeActiveInstance();
    const task = makePendingRoleTask(
      inst,
      {
        type: 'ROLE',
        roleCode: 'ACCESS_DOCUMENTS_MANAGER',
        companyScoped: true,
      },
      'co-1',
    );
    repo.trackTask(task, inst);
    const svc = new WorkflowTaskService(repo);
    await svc.claim(task.id, ACTOR);
    const { task: done, instanceId } = await svc.complete(task.id, {
      outcome: 'APPROVE',
      comment: 'looks good',
      actor: ACTOR,
    });
    expect(done.status).toBe('COMPLETED');
    expect(done.outcome).toBe('APPROVE');
    expect(done.comment).toBe('looks good');
    expect(instanceId).toBe(inst.id);
  });

  it('complete() rejects when instance is not ACTIVE', async () => {
    const repo = new FakeInstanceRepo();
    const inst = makeActiveInstance();
    inst.complete(); // mark instance done
    const task = makePendingRoleTask(
      inst,
      { type: 'ROLE', roleCode: 'ACCESS_DOCUMENTS_MANAGER' },
      'co-1',
    );
    repo.trackTask(task, inst);
    const svc = new WorkflowTaskService(repo);
    await expect(
      svc.complete(task.id, {
        outcome: 'APPROVE',
        actor: ACTOR,
      }),
    ).rejects.toThrow(/Cannot complete task on a COMPLETED instance/);
  });

  it('list() respects status filter and paginates', async () => {
    const repo = new FakeInstanceRepo();
    const inst = makeActiveInstance();
    for (let i = 0; i < 5; i++) {
      const t = makePendingRoleTask(
        inst,
        { type: 'ROLE', roleCode: 'ACCESS_DOCUMENTS_MANAGER' },
        'co-1',
      );
      repo.trackTask(t, inst);
    }
    const svc = new WorkflowTaskService(repo);
    const page = await svc.list(
      { status: 'PENDING', assignedRoleCode: 'ACCESS_DOCUMENTS_MANAGER' },
      { page: 1, pageSize: 2 },
      ACTOR,
    );
    expect(page.items.length).toBe(2);
    expect(page.total).toBe(5);
    expect(page.page).toBe(1);
  });
});
