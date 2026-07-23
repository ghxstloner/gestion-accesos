import { GraphValidator } from './graph-validator';
import { WORKFLOW_SCHEMA_VERSION } from './workflow-definition.types';

function validGraph(
  overrides: Partial<{
    nodes: any[];
    edges: any[];
  }> = {},
) {
  return {
    schemaVersion: WORKFLOW_SCHEMA_VERSION,
    nodes: overrides.nodes ?? [
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
    edges: overrides.edges ?? [
      { from: 'start', to: 'review', action: 'SUBMIT' },
      { from: 'review', to: 'end', action: 'APPROVE' },
      { from: 'review', to: 'end', action: 'REJECT' },
    ],
  };
}

describe('GraphValidator', () => {
  it('accepts a minimal valid graph', () => {
    expect(GraphValidator.validate(validGraph()).valid).toBe(true);
  });

  it('rejects a graph without START', () => {
    const g = validGraph({
      nodes: [
        {
          key: 'review',
          type: 'HUMAN_TASK',
          name: 'Review',
          assignment: { type: 'ROLE', roleCode: 'X' },
          config: { outcomes: ['APPROVE'] },
        },
        { key: 'end', type: 'END', name: 'End' },
      ],
    });
    const r = GraphValidator.validate(g);
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toContain('START node is required');
  });

  it('rejects a graph with more than one START', () => {
    const g = validGraph({
      nodes: [
        { key: 'start', type: 'START', name: 'A' },
        { key: 'start2', type: 'START', name: 'B' },
        {
          key: 'review',
          type: 'HUMAN_TASK',
          name: 'Review',
          assignment: { type: 'ROLE', roleCode: 'X' },
          config: { outcomes: ['APPROVE'] },
        },
        { key: 'end', type: 'END', name: 'End' },
      ],
      edges: [
        { from: 'start', to: 'review', action: 'X' },
        { from: 'review', to: 'end', action: 'APPROVE' },
      ],
    });
    const r = GraphValidator.validate(g);
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toContain('Only one START');
  });

  it('rejects a graph without END', () => {
    const g = validGraph({
      nodes: [
        { key: 'start', type: 'START', name: 'Start' },
        {
          key: 'review',
          type: 'HUMAN_TASK',
          name: 'Review',
          assignment: { type: 'ROLE', roleCode: 'X' },
          config: { outcomes: ['APPROVE'] },
        },
      ],
      edges: [
        { from: 'start', to: 'review', action: 'SUBMIT' },
        { from: 'review', to: 'start', action: 'APPROVE' },
      ],
    });
    const r = GraphValidator.validate(g);
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toContain('END');
  });

  it('rejects orphan nodes unreachable from START', () => {
    const g = validGraph({
      nodes: [
        { key: 'start', type: 'START', name: 'Start' },
        { key: 'end', type: 'END', name: 'End' },
        {
          key: 'orphan',
          type: 'HUMAN_TASK',
          name: 'Orphan',
          assignment: { type: 'ROLE', roleCode: 'X' },
          config: { outcomes: ['APPROVE'] },
        },
      ],
      edges: [
        { from: 'start', to: 'end', action: 'SUBMIT' },
        { from: 'orphan', to: 'end', action: 'APPROVE' },
      ],
    });
    const r = GraphValidator.validate(g);
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toContain('orphan');
  });

  it('rejects edges to/from unknown nodes', () => {
    const g = validGraph({
      edges: [
        { from: 'start', to: 'nope', action: 'SUBMIT' },
        { from: 'review', to: 'end', action: 'APPROVE' },
      ],
    });
    const r = GraphValidator.validate(g);
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toContain('unknown node: nope');
  });

  it('rejects unauthorized cycles (only RETURN_FOR_CORRECTION/RESUBMIT allowed)', () => {
    const g = validGraph({
      nodes: [
        { key: 'start', type: 'START', name: 'Start' },
        {
          key: 'review',
          type: 'HUMAN_TASK',
          name: 'Review',
          assignment: { type: 'ROLE', roleCode: 'X' },
          config: { outcomes: ['APPROVE', 'SOMETHING'] },
        },
        { key: 'end', type: 'END', name: 'End' },
      ],
      edges: [
        { from: 'start', to: 'review', action: 'SUBMIT' },
        { from: 'review', to: 'review', action: 'APPROVE' },
        { from: 'review', to: 'end', action: 'SOMETHING' },
      ],
    });
    const r = GraphValidator.validate(g);
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toContain('Unauthorized cycle');
  });

  it('allows RETURN_FOR_CORRECTION cycle', () => {
    const g = validGraph({
      nodes: [
        { key: 'start', type: 'START', name: 'Start' },
        {
          key: 'first_review',
          type: 'HUMAN_TASK',
          name: 'First',
          assignment: { type: 'ROLE', roleCode: 'X' },
          config: { outcomes: ['APPROVE', 'RETURN_FOR_CORRECTION'] },
        },
        {
          key: 'second_review',
          type: 'HUMAN_TASK',
          name: 'Second',
          assignment: { type: 'ROLE', roleCode: 'Y' },
          config: { outcomes: ['RETURN_FOR_CORRECTION', 'APPROVE'] },
        },
        { key: 'end', type: 'END', name: 'End' },
      ],
      edges: [
        { from: 'start', to: 'first_review', action: 'SUBMIT' },
        { from: 'first_review', to: 'second_review', action: 'APPROVE' },
        { from: 'first_review', to: 'end', action: 'RETURN_FOR_CORRECTION' },
        {
          from: 'second_review',
          to: 'first_review',
          action: 'RETURN_FOR_CORRECTION',
        },
        { from: 'second_review', to: 'end', action: 'APPROVE' },
      ],
    });
    const r = GraphValidator.validate(g);
    expect(r.valid).toBe(true);
  });

  it('rejects HUMAN_TASK without assignment', () => {
    const g = validGraph({
      nodes: [
        { key: 'start', type: 'START', name: 'Start' },
        {
          key: 'review',
          type: 'HUMAN_TASK',
          name: 'X',
          config: { outcomes: ['APPROVE'] },
        },
        { key: 'end', type: 'END', name: 'End' },
      ],
    });
    const r = GraphValidator.validate(g);
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toContain('HUMAN_TASK requires assignment');
  });

  it('rejects HUMAN_TASK without outcomes config', () => {
    const g = validGraph({
      nodes: [
        { key: 'start', type: 'START', name: 'Start' },
        {
          key: 'review',
          type: 'HUMAN_TASK',
          name: 'X',
          assignment: { type: 'ROLE', roleCode: 'X' },
        },
        { key: 'end', type: 'END', name: 'End' },
      ],
    });
    const r = GraphValidator.validate(g);
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toContain('config.outcomes');
  });

  it('rejects SYSTEM without systemAction', () => {
    const g = validGraph({
      nodes: [
        { key: 'start', type: 'START', name: 'Start' },
        { key: 'sys', type: 'SYSTEM', name: 'Sys' },
        { key: 'end', type: 'END', name: 'End' },
      ],
      edges: [
        { from: 'start', to: 'sys', action: 'SUBMIT' },
        { from: 'sys', to: 'end', action: 'DONE' },
      ],
    });
    const r = GraphValidator.validate(g);
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toContain('SYSTEM requires config.systemAction');
  });

  it('rejects END with outgoing edges', () => {
    const g = validGraph({
      nodes: [
        { key: 'start', type: 'START', name: 'Start' },
        { key: 'end', type: 'END', name: 'End' },
      ],
      edges: [
        { from: 'start', to: 'end', action: 'SUBMIT' },
        { from: 'end', to: 'start', action: 'LOOP' },
      ],
    });
    const r = GraphValidator.validate(g);
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toContain('must not have outgoing edges');
  });

  it('rejects START without outgoing edges', () => {
    const g = validGraph({
      nodes: [
        { key: 'start', type: 'START', name: 'Start' },
        { key: 'end', type: 'END', name: 'End' },
      ],
      edges: [],
    });
    const r = GraphValidator.validate(g);
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toContain('no outgoing edges');
  });

  it('rejects duplicate node keys', () => {
    const g = validGraph({
      nodes: [
        { key: 'start', type: 'START', name: 'A' },
        { key: 'start', type: 'END', name: 'B' },
      ],
      edges: [{ from: 'start', to: 'start', action: 'SUBMIT' }],
    });
    const r = GraphValidator.validate(g);
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toContain('Duplicate node key');
  });

  it('rejects unsupported schemaVersion', () => {
    const g = {
      ...validGraph(),
      schemaVersion: 99,
    };
    const r = GraphValidator.validate(g);
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toContain('Unsupported schemaVersion');
  });
});
