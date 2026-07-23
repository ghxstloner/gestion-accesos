// Domain error classes are not directly used as matchers in this spec due to
// the common DomainError prototype quirk; we match messages instead.
import {
  WorkflowInstance,
  WorkflowNodeInstance,
  WorkflowTask,
  WorkflowTransition,
  selectOutgoingEdge,
} from './workflow-instance.entity';
import {
  MAX_AUTO_TRANSITIONS,
  WORKFLOW_SCHEMA_VERSION,
} from '../workflow-definition.types';
import type {
  WorkflowGraphDefinition,
  EvaluationContext,
} from '../workflow-definition.types';

function smallGraph(): WorkflowGraphDefinition {
  return {
    schemaVersion: WORKFLOW_SCHEMA_VERSION,
    nodes: [
      { key: 'start', type: 'START', name: 'Start' },
      {
        key: 'review',
        type: 'HUMAN_TASK',
        name: 'Review',
        assignment: { type: 'ROLE', roleCode: 'ACCESS_DOCUMENTS_MANAGER' },
        config: { outcomes: ['APPROVE', 'REJECT'] },
      },
      { key: 'end', type: 'END', name: 'End' },
    ],
    edges: [
      { from: 'start', to: 'review', action: 'SUBMIT' },
      { from: 'review', to: 'end', action: 'APPROVE' },
      { from: 'review', to: 'end', action: 'REJECT' },
    ],
  };
}

describe('WorkflowNodeInstance', () => {
  it('starts in PENDING and transitions to RUNNING then COMPLETED', () => {
    const n = WorkflowNodeInstance.create({
      workflowInstanceId: 'wi-1',
      nodeKey: 'review',
      nodeType: 'HUMAN_TASK',
    });
    expect(n.status).toBe('PENDING');
    expect(() => n.start()).not.toThrow();
    expect(n.status).toBe('RUNNING');
    expect(() => n.complete({ ok: true })).not.toThrow();
    expect(n.status).toBe('COMPLETED');
    expect(n.outputJson).toEqual({ ok: true });
    expect(n.completedAt).toBeTruthy();
  });

  it('fails with error info', () => {
    const n = WorkflowNodeInstance.create({
      workflowInstanceId: 'wi-1',
      nodeKey: 'sys',
      nodeType: 'SYSTEM',
    });
    n.start();
    n.fail('TIMEOUT', 'External service timed out');
    expect(n.status).toBe('FAILED');
    expect(n.errorCode).toBe('TIMEOUT');
    expect(n.errorMessage).toBe('External service timed out');
  });

  it('retries increment attemptNumber', () => {
    const n = WorkflowNodeInstance.create({
      workflowInstanceId: 'wi-1',
      nodeKey: 'sys',
      nodeType: 'SYSTEM',
    });
    expect(n.attemptNumber).toBe(1);
    n.start();
    n.fail('X', 'Y');
    n.retry();
    expect(n.attemptNumber).toBe(2);
    expect(n.status).toBe('PENDING');
  });

  it('cannot start from non-PENDING state', () => {
    const n = WorkflowNodeInstance.create({
      workflowInstanceId: 'wi-1',
      nodeKey: 'sys',
      nodeType: 'SYSTEM',
    });
    n.start();
    expect(() => n.start()).toThrow('transition from RUNNING to RUNNING');
  });
});

describe('WorkflowTask', () => {
  it('rejects ROLE assignment without roleCode', () => {
    expect(() =>
      WorkflowTask.create({
        workflowInstanceId: 'wi-1',
        nodeInstanceId: 'nd-1',
        assignment: { type: 'ROLE' },
        companyId: null,
      }),
    ).toThrow();
  });

  it('USER task can be completed directly without claim', () => {
    const t = WorkflowTask.create({
      workflowInstanceId: 'wi-1',
      nodeInstanceId: 'nd-1',
      assignment: { type: 'USER', userId: 'u-1' },
      companyId: null,
    });
    const actor = { userId: 'u-1', roles: [], companyId: null };
    expect(t.canBeClaimedBy(actor)).toBe(true);
    t.complete({ actor, outcome: 'APPROVE' });
    expect(t.status).toBe('COMPLETED');
    expect(t.completedByUserId).toBe('u-1');
    expect(t.outcome).toBe('APPROVE');
  });

  it('ROLE task: actor without role cannot claim', () => {
    const t = WorkflowTask.create({
      workflowInstanceId: 'wi-1',
      nodeInstanceId: 'nd-1',
      assignment: { type: 'ROLE', roleCode: 'ACCESS_DOCUMENTS_MANAGER' },
      companyId: null,
    });
    expect(
      t.canBeClaimedBy({
        userId: 'u-1',
        roles: ['APPLICANT'],
        companyId: null,
      }),
    ).toBe(false);
    expect(() =>
      t.claim({ userId: 'u-1', roles: ['APPLICANT'], companyId: null }),
    ).toThrow('not assigned');
  });

  it('ROLE task: actor with role claims and completes', () => {
    const t = WorkflowTask.create({
      workflowInstanceId: 'wi-1',
      nodeInstanceId: 'nd-1',
      assignment: { type: 'ROLE', roleCode: 'ACCESS_DOCUMENTS_MANAGER' },
      companyId: null,
    });
    const actor = {
      userId: 'u-mgr',
      roles: ['ACCESS_DOCUMENTS_MANAGER'],
      companyId: null,
    };
    t.claim(actor);
    expect(t.status).toBe('CLAIMED');
    expect(t.claimedByUserId).toBe('u-mgr');
    t.complete({ actor, outcome: 'APPROVE' });
    expect(t.status).toBe('COMPLETED');
  });

  it('cannot complete twice', () => {
    const t = WorkflowTask.create({
      workflowInstanceId: 'wi-1',
      nodeInstanceId: 'nd-1',
      assignment: { type: 'USER', userId: 'u-1' },
      companyId: null,
    });
    const actor = { userId: 'u-1', roles: [], companyId: null };
    t.complete({ actor, outcome: 'APPROVE' });
    expect(() => t.complete({ actor, outcome: 'REJECT' })).toThrow(
      'already completed',
    );
  });

  it('only claimer can complete', () => {
    const t = WorkflowTask.create({
      workflowInstanceId: 'wi-1',
      nodeInstanceId: 'nd-1',
      assignment: { type: 'ROLE', roleCode: 'X' },
      companyId: null,
    });
    const a1 = { userId: 'a1', roles: ['X'], companyId: null };
    const a2 = { userId: 'a2', roles: ['X'], companyId: null };
    t.claim(a1);
    expect(() => t.complete({ actor: a2, outcome: 'APPROVE' })).toThrow(
      'Another user has claimed',
    );
  });

  it('outcome must be allowed', () => {
    const t = WorkflowTask.create({
      workflowInstanceId: 'wi-1',
      nodeInstanceId: 'nd-1',
      assignment: { type: 'USER', userId: 'u-1' },
      companyId: null,
    });
    const badOutcome = 'BANANA' as unknown as WorkflowTask['outcome'];
    expect(() =>
      t.complete({
        actor: { userId: 'u-1', roles: [], companyId: null },
        outcome: badOutcome,
      }),
    ).toThrow();
  });

  it('outcome must intersect allowedOutcomes config', () => {
    const t = WorkflowTask.create({
      workflowInstanceId: 'wi-1',
      nodeInstanceId: 'nd-1',
      assignment: { type: 'USER', userId: 'u-1' },
      companyId: null,
    });
    expect(() =>
      t.complete({
        actor: { userId: 'u-1', roles: [], companyId: null },
        outcome: 'REJECT',
        allowedOutcomes: ['APPROVE'],
      }),
    ).toThrow();
  });

  it('cancel returns CANCELLED status', () => {
    const t = WorkflowTask.create({
      workflowInstanceId: 'wi-1',
      nodeInstanceId: 'nd-1',
      assignment: { type: 'USER', userId: 'u-1' },
      companyId: null,
    });
    t.cancel('Rolled back');
    expect(t.status).toBe('CANCELLED');
  });
});

describe('WorkflowInstance', () => {
  it('starts with lockVersion=1', () => {
    const i = WorkflowInstance.start({
      requestId: 'req-1',
      workflowVersionId: 'v-1',
      context: {},
      startNodeKey: 'start',
    });
    expect(i.status).toBe('ACTIVE');
    expect(i.lockVersion).toBe(1);
    expect(i.currentNodeKey).toBe('start');
  });

  it('advanceTo increments lockVersion', () => {
    const i = WorkflowInstance.start({
      requestId: 'req-1',
      workflowVersionId: 'v-1',
      context: {},
      startNodeKey: 'start',
    });
    const v0 = i.beginTransition();
    i.advanceTo('review', v0);
    expect(i.lockVersion).toBe(2);
    expect(i.currentNodeKey).toBe('review');
  });

  it('advanceTo throws on stale lockVersion', () => {
    const i = WorkflowInstance.start({
      requestId: 'req-1',
      workflowVersionId: 'v-1',
      context: {},
      startNodeKey: 'start',
    });
    expect(() => i.advanceTo('review', 999)).toThrow('Stale lockVersion');
  });

  it('automatic transitions are capped', () => {
    const i = WorkflowInstance.start({
      requestId: 'req-1',
      workflowVersionId: 'v-1',
      context: {},
      startNodeKey: 'start',
    });
    let lv = i.beginTransition();
    for (let n = 0; n < MAX_AUTO_TRANSITIONS; n++) {
      i.advanceTo('start', lv, { automatic: true });
      lv = i.lockVersion;
    }
    expect(() => i.advanceTo('start', lv, { automatic: true })).toThrow();
  });

  it('complete and cancel transition sets terminal status', () => {
    const i = WorkflowInstance.start({
      requestId: 'req-1',
      workflowVersionId: 'v-1',
      context: {},
      startNodeKey: 'start',
    });
    i.complete();
    expect(i.status).toBe('COMPLETED');
    expect(i.isFinished).toBe(true);
    expect(() => i.cancel()).toThrow();
  });

  it('cannot complete a cancelled instance', () => {
    const i = WorkflowInstance.start({
      requestId: 'req-1',
      workflowVersionId: 'v-1',
      context: {},
      startNodeKey: 'start',
    });
    i.cancel();
    expect(() => i.complete()).toThrow();
  });
});

describe('selectOutgoingEdge', () => {
  const graph = smallGraph();
  const ctx: EvaluationContext = {};

  it('returns edge for action', () => {
    const e = selectOutgoingEdge({
      graph,
      from: 'start',
      action: 'SUBMIT',
      ctx,
    });
    expect(e.to).toBe('review');
  });

  it('throws when node has no outgoing edge for action', () => {
    expect(() =>
      selectOutgoingEdge({ graph, from: 'start', action: 'NOPE', ctx }),
    ).toThrow();
  });

  it('respects priority + condition (priority desc)', () => {
    const g: WorkflowGraphDefinition = {
      schemaVersion: WORKFLOW_SCHEMA_VERSION,
      nodes: [
        { key: 'start', type: 'START', name: 'Start' },
        { key: 'a', type: 'END', name: 'A' },
        { key: 'b', type: 'END', name: 'B' },
      ],
      edges: [
        { from: 'start', to: 'a', action: 'GO', priority: 1 },
        { from: 'start', to: 'b', action: 'GO', priority: 10 },
      ],
    };
    const e = selectOutgoingEdge({
      graph: g,
      from: 'start',
      action: 'GO',
      ctx,
    });
    expect(e.to).toBe('b');
  });

  it('falls back to lower priority when higher condition false', () => {
    const g: WorkflowGraphDefinition = {
      schemaVersion: WORKFLOW_SCHEMA_VERSION,
      nodes: [
        { key: 'start', type: 'START', name: 'Start' },
        { key: 'a', type: 'END', name: 'A' },
        { key: 'b', type: 'END', name: 'B' },
      ],
      edges: [
        {
          from: 'start',
          to: 'a',
          action: 'GO',
          priority: 10,
          condition: {
            field: 'request.flag',
            operator: 'EQUALS',
            value: 'YES',
          },
        },
        { from: 'start', to: 'b', action: 'GO', priority: 1 },
      ],
    };
    const e = selectOutgoingEdge({
      graph: g,
      from: 'start',
      action: 'GO',
      ctx: { request: { flag: 'NO' } },
    });
    expect(e.to).toBe('b');
  });
});

describe('WorkflowTransition', () => {
  it('records with idempotencyKey', () => {
    const t = WorkflowTransition.record({
      workflowInstanceId: 'wi-1',
      sourceNodeKey: 'start',
      targetNodeKey: 'review',
      action: 'SUBMIT',
      actorUserId: 'u-1',
      idempotencyKey: 'abc',
      metadata: { reason: 'auto' },
    });
    const p = t.toProps();
    expect(p.idempotencyKey).toBe('abc');
    expect(p.metadataJson).toEqual({ reason: 'auto' });
  });
});
