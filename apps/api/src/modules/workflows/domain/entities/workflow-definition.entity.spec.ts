import {
  WorkflowDefinition,
  WorkflowVersion,
} from './workflow-definition.entity';
import { WORKFLOW_SCHEMA_VERSION } from '../workflow-definition.types';
import type { WorkflowGraphDefinition } from '../workflow-definition.types';

function minimalGraph(): WorkflowGraphDefinition {
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

describe('WorkflowDefinition', () => {
  it('creates with valid inputs', () => {
    const d = WorkflowDefinition.create({
      key: 'permanent_card_v1',
      name: 'Permanent Card Workflow',
      requestType: 'PERMANENT_CARD',
      createdByUserId: 'usr-1',
    });
    expect(d.id).toBeTruthy();
    expect(d.key).toBe('permanent_card_v1');
    expect(d.status).toBe('DRAFT');
    expect(d.requestType).toBe('PERMANENT_CARD');
  });

  it('rejects invalid key format', () => {
    expect(() =>
      WorkflowDefinition.create({
        key: 'invalid key with spaces',
        name: 'X',
        createdByUserId: 'u',
      }),
    ).toThrow('3-100 chars');
    expect(() =>
      WorkflowDefinition.create({
        key: 'ab',
        name: 'X',
        createdByUserId: 'u',
      }),
    ).toThrow('3-100 chars');
  });

  it('rejects empty name', () => {
    expect(() =>
      WorkflowDefinition.create({
        key: 'k_valid',
        name: '  ',
        createdByUserId: 'u',
      }),
    ).toThrow('name is required');
  });

  it('can retire a non-draft definition', () => {
    const d = WorkflowDefinition.create({
      key: 'k2_test',
      name: 'X',
      createdByUserId: 'u',
    });
    // Mimic published status by reconstitute
    const dr = WorkflowDefinition.reconstitute({
      ...d.toProps(),
      status: 'PUBLISHED',
    });
    dr.retire();
    expect(dr.status).toBe('RETIRED');
  });

  it('refuses to retire a DRAFT', () => {
    const d = WorkflowDefinition.create({
      key: 'k3_test',
      name: 'X',
      createdByUserId: 'u',
    });
    expect(() => d.retire()).toThrow();
  });

  it('refuses to rename a retired definition', () => {
    const d = WorkflowDefinition.create({
      key: 'k4_test',
      name: 'X',
      createdByUserId: 'u',
    });
    const dr = WorkflowDefinition.reconstitute({
      ...d.toProps(),
      status: 'RETIRED',
    });
    expect(() => dr.rename('New')).toThrow();
  });
});

describe('WorkflowVersion', () => {
  it('creates a DRAFT version with computed checksum', () => {
    const v = WorkflowVersion.createDraft({
      workflowDefinitionId: 'wf-1',
      versionNumber: 1,
      definitionJson: minimalGraph(),
      createdByUserId: 'u-1',
    });
    expect(v.status).toBe('DRAFT');
    expect(v.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(v.isDraft).toBe(true);
  });

  it('publishes assigns publisher and sets status to PUBLISHED', () => {
    const v = WorkflowVersion.createDraft({
      workflowDefinitionId: 'wf-1',
      versionNumber: 1,
      definitionJson: minimalGraph(),
      createdByUserId: 'u-1',
    });
    v.publish('u-9', new Date('2026-07-21T10:00:00Z'));
    expect(v.status).toBe('PUBLISHED');
    expect(v.publishedByUserId).toBe('u-9');
    expect(v.publishedAt).toBeTruthy();
  });

  it('refuses graph updates after publish', () => {
    const v = WorkflowVersion.createDraft({
      workflowDefinitionId: 'wf-1',
      versionNumber: 1,
      definitionJson: minimalGraph(),
      createdByUserId: 'u-1',
    });
    v.publish('u-9');
    expect(() => v.updateGraph(minimalGraph())).toThrow('cannot be edited');
  });

  it('checksum is stable under key re-ordering (canonical)', () => {
    const g1 = minimalGraph();
    const g2: WorkflowGraphDefinition = {
      ...g1,
      nodes: [...g1.nodes].reverse(),
      edges: [...g1.edges].reverse(),
    };
    expect(WorkflowVersion.computeChecksum(g1)).toBe(
      WorkflowVersion.computeChecksum(g2),
    );
  });

  it('checksum changes if config changes', () => {
    const g1 = minimalGraph();
    const g2: WorkflowGraphDefinition = {
      ...g1,
      nodes: g1.nodes.map((n) =>
        n.key === 'review'
          ? {
              ...n,
              config: {
                outcomes: ['APPROVE', 'REJECT', 'RETURN_FOR_CORRECTION'],
              },
            }
          : n,
      ),
    };
    expect(WorkflowVersion.computeChecksum(g1)).not.toBe(
      WorkflowVersion.computeChecksum(g2),
    );
  });

  it('publish is idempotent on second call (throws Conflict)', () => {
    const v = WorkflowVersion.createDraft({
      workflowDefinitionId: 'wf-1',
      versionNumber: 1,
      definitionJson: minimalGraph(),
      createdByUserId: 'u-1',
    });
    v.publish('u-9');
    expect(() => v.publish('u-9')).toThrow('already');
  });

  it('rejects draft version with invalid versionNumber', () => {
    expect(() =>
      WorkflowVersion.createDraft({
        workflowDefinitionId: 'wf-1',
        versionNumber: 0,
        definitionJson: minimalGraph(),
        createdByUserId: 'u-1',
      }),
    ).toThrow('must be >= 1');
  });
});
