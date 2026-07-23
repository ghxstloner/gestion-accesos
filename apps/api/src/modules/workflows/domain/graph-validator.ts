import { ValidationError } from '../../../common/domain/errors/domain-error';
import { ConditionEvaluator } from './condition-evaluator';
import {
  SYSTEM_ACTIONS,
  WORKFLOW_NODE_TYPES,
  WORKFLOW_SCHEMA_VERSION,
  type WorkflowEdge,
  type WorkflowGraphDefinition,
  type WorkflowNode,
} from './workflow-definition.types';

export interface GraphValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Strict graph validation before publishing a workflow version.
 */
export class GraphValidator {
  static validate(definition: unknown): GraphValidationResult {
    const errors: string[] = [];

    if (!definition || typeof definition !== 'object') {
      return { valid: false, errors: ['definitionJson must be an object'] };
    }

    const graph = definition as Partial<WorkflowGraphDefinition>;

    if (
      graph.schemaVersion !== undefined &&
      graph.schemaVersion !== WORKFLOW_SCHEMA_VERSION
    ) {
      errors.push(
        `Unsupported schemaVersion ${graph.schemaVersion}; expected ${WORKFLOW_SCHEMA_VERSION}`,
      );
    }

    if (!Array.isArray(graph.nodes) || graph.nodes.length === 0) {
      errors.push('nodes must be a non-empty array');
      return { valid: false, errors };
    }
    if (!Array.isArray(graph.edges)) {
      errors.push('edges must be an array');
      return { valid: false, errors };
    }

    const nodes = graph.nodes;
    const edges = graph.edges;
    const keys = new Set<string>();

    for (const node of nodes) {
      if (!node || typeof node !== 'object') {
        errors.push('Each node must be an object');
        continue;
      }
      if (!node.key || typeof node.key !== 'string') {
        errors.push('Each node requires a string key');
        continue;
      }
      if (keys.has(node.key)) {
        errors.push(`Duplicate node key: ${node.key}`);
      }
      keys.add(node.key);

      if (!node.type || !WORKFLOW_NODE_TYPES.includes(node.type)) {
        errors.push(
          `Node ${node.key}: invalid type ${String(node.type)}. Allowed: ${WORKFLOW_NODE_TYPES.join(', ')}`,
        );
      }
      if (!node.name || typeof node.name !== 'string') {
        errors.push(`Node ${node.key}: name is required`);
      }

      if (node.type === 'HUMAN_TASK') {
        if (!node.assignment) {
          errors.push(`Node ${node.key}: HUMAN_TASK requires assignment`);
        } else {
          if (node.assignment.type === 'ROLE' && !node.assignment.roleCode) {
            errors.push(`Node ${node.key}: ROLE assignment requires roleCode`);
          }
          if (node.assignment.type === 'USER' && !node.assignment.userId) {
            errors.push(`Node ${node.key}: USER assignment requires userId`);
          }
        }
        if (
          !node.config?.outcomes ||
          !Array.isArray(node.config.outcomes) ||
          node.config.outcomes.length === 0
        ) {
          errors.push(`Node ${node.key}: HUMAN_TASK requires config.outcomes`);
        }
      }

      if (node.type === 'SYSTEM') {
        const action = node.config?.systemAction;
        if (!action || !SYSTEM_ACTIONS.includes(action)) {
          errors.push(
            `Node ${node.key}: SYSTEM requires config.systemAction in ${SYSTEM_ACTIONS.join(', ')}`,
          );
        }
        if (
          action === 'UPDATE_REQUEST_STATUS' &&
          !node.config?.targetRequestStatus
        ) {
          errors.push(
            `Node ${node.key}: UPDATE_REQUEST_STATUS requires targetRequestStatus`,
          );
        }
      }
    }

    const starts = nodes.filter((n) => n.type === 'START');
    if (starts.length === 0) errors.push('START node is required');
    if (starts.length > 1) errors.push('Only one START node is allowed');

    const ends = nodes.filter((n) => n.type === 'END');
    if (ends.length === 0) errors.push('At least one END node is required');

    for (const edge of edges) {
      if (!edge || typeof edge !== 'object') {
        errors.push('Each edge must be an object');
        continue;
      }
      if (!edge.from || !edge.to || !edge.action) {
        errors.push('Each edge requires from, to, and action');
        continue;
      }
      if (!keys.has(edge.from)) {
        errors.push(`Edge from unknown node: ${edge.from}`);
      }
      if (!keys.has(edge.to)) {
        errors.push(`Edge to unknown node: ${edge.to}`);
      }
      if (edge.condition) {
        try {
          ConditionEvaluator.validate(
            edge.condition,
            `edge ${edge.from}->${edge.to}`,
          );
        } catch (e) {
          errors.push((e as Error).message);
        }
      }
    }

    // Reachability from START
    if (starts.length === 1) {
      const startKey = starts[0].key;
      const adj = new Map<string, string[]>();
      for (const k of keys) adj.set(k, []);
      for (const e of edges) {
        if (keys.has(e.from) && keys.has(e.to)) {
          adj.get(e.from).push(e.to);
        }
      }
      const reachable = new Set<string>();
      const stack = [startKey];
      while (stack.length) {
        const cur = stack.pop();
        if (reachable.has(cur)) continue;
        reachable.add(cur);
        for (const n of adj.get(cur) ?? []) stack.push(n);
      }
      for (const k of keys) {
        if (!reachable.has(k)) {
          errors.push(`Orphan / unreachable node from START: ${k}`);
        }
      }
      const canReachEnd = ends.some((e) => reachable.has(e.key));
      if (!canReachEnd) {
        errors.push('No END node is reachable from START');
      }

      // Cycle detection: only allow cycles that go through RETURN_FOR_CORRECTION edges
      const cycleErrors = this.detectUnauthorizedCycles(nodes, edges);
      errors.push(...cycleErrors);
    }

    // START must have outgoing edges; END must not
    for (const node of nodes) {
      if (node.type === 'START') {
        const out = edges.filter((e) => e.from === node.key);
        if (out.length === 0) {
          errors.push(`START node ${node.key} has no outgoing edges`);
        }
      }
      if (node.type === 'END') {
        const out = edges.filter((e) => e.from === node.key);
        if (out.length > 0) {
          errors.push(`END node ${node.key} must not have outgoing edges`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  static assertValid(
    definition: unknown,
  ): asserts definition is WorkflowGraphDefinition {
    const result = this.validate(definition);
    if (!result.valid) {
      throw new ValidationError(
        `Invalid workflow graph: ${result.errors.join('; ')}`,
      );
    }
  }

  /**
   * Unauthorized cycles are any strongly-connected component that is not
   * exclusively formed by RETURN_FOR_CORRECTION (or RESUBMIT) edges.
   * Simple approach: DFS for back-edges; if a back-edge action is not
   * RETURN_FOR_CORRECTION / RESUBMIT, reject.
   */
  private static detectUnauthorizedCycles(
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
  ): string[] {
    const errors: string[] = [];
    const allowedCycleActions = new Set([
      'RETURN_FOR_CORRECTION',
      'RESUBMIT',
      'return',
      'resubmit',
    ]);

    const adj = new Map<string, WorkflowEdge[]>();
    for (const n of nodes) adj.set(n.key, []);
    for (const e of edges) {
      if (adj.has(e.from)) adj.get(e.from).push(e);
    }

    const WHITE = 0,
      GRAY = 1,
      BLACK = 2;
    const color = new Map<string, number>();
    for (const n of nodes) color.set(n.key, WHITE);

    const visit = (key: string, path: string[]): void => {
      color.set(key, GRAY);
      for (const edge of adj.get(key) ?? []) {
        const c = color.get(edge.to) ?? WHITE;
        if (c === GRAY) {
          // back-edge → cycle
          if (!allowedCycleActions.has(edge.action)) {
            errors.push(
              `Unauthorized cycle via edge ${edge.from} -[${edge.action}]-> ${edge.to}. Only RETURN_FOR_CORRECTION/RESUBMIT cycles are allowed.`,
            );
          }
        } else if (c === WHITE) {
          visit(edge.to, [...path, edge.to]);
        }
      }
      color.set(key, BLACK);
    };

    for (const n of nodes) {
      if (color.get(n.key) === WHITE) visit(n.key, [n.key]);
    }
    return errors;
  }
}
