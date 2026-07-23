/**
 * Structured, versioned workflow definition (definitionJson).
 * No eval, no Function, no arbitrary code — only safe structured data.
 */

export const WORKFLOW_SCHEMA_VERSION = 1;
export const MAX_AUTO_TRANSITIONS = 25;

export const WORKFLOW_NODE_TYPES = [
  'START',
  'END',
  'HUMAN_TASK',
  'SYSTEM',
  'DECISION',
] as const;

export type WorkflowNodeType = (typeof WORKFLOW_NODE_TYPES)[number];

export const HUMAN_TASK_OUTCOMES = [
  'APPROVE',
  'REJECT',
  'RETURN_FOR_CORRECTION',
  'RESUBMIT',
  'CANCEL',
  'COMPLETE',
] as const;

export type HumanTaskOutcome = (typeof HUMAN_TASK_OUTCOMES)[number];

export const SYSTEM_ACTIONS = ['UPDATE_REQUEST_STATUS', 'NOOP'] as const;

export type SystemAction = (typeof SYSTEM_ACTIONS)[number];

export type AssignmentType = 'ROLE' | 'USER';

export interface WorkflowAssignment {
  type: AssignmentType;
  roleCode?: string;
  userId?: string;
  /** When true, task is scoped to the request company for ROLE assignment */
  companyScoped?: boolean;
}

export interface WorkflowNodeConfig {
  outcomes?: HumanTaskOutcome[];
  systemAction?: SystemAction;
  targetRequestStatus?: string;
  /** Allow this edge cycle only for RETURN_FOR_CORRECTION loops */
  allowReturnCycle?: boolean;
}

export interface WorkflowNode {
  key: string;
  type: WorkflowNodeType;
  name: string;
  description?: string;
  assignment?: WorkflowAssignment;
  config?: WorkflowNodeConfig;
}

export interface WorkflowEdge {
  key?: string;
  from: string;
  to: string;
  action: string;
  condition?: ConditionExpression;
  priority?: number;
}

export interface WorkflowGraphDefinition {
  schemaVersion: number;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  metadata?: Record<string, unknown>;
}

/* ── Condition DSL (safe structured JSON) ── */

export const CONDITION_OPERATORS = [
  'EQUALS',
  'NOT_EQUALS',
  'IN',
  'NOT_IN',
  'GREATER_THAN',
  'GREATER_THAN_OR_EQUAL',
  'LESS_THAN',
  'LESS_THAN_OR_EQUAL',
  'EXISTS',
  'NOT_EXISTS',
  'AND',
  'OR',
  'NOT',
] as const;

export type ConditionOperator = (typeof CONDITION_OPERATORS)[number];

export const ALLOWED_CONDITION_FIELD_PREFIXES = [
  'request.',
  'subjectUser.',
  'creatorUser.',
  'company.',
  'context.',
  'task.',
] as const;

export type ConditionExpression =
  | {
      op: 'AND' | 'OR';
      conditions: ConditionExpression[];
    }
  | {
      op: 'NOT';
      condition: ConditionExpression;
    }
  | {
      field: string;
      operator: Exclude<ConditionOperator, 'AND' | 'OR' | 'NOT'>;
      value?: unknown;
    };

export interface EvaluationContext {
  request?: Record<string, unknown>;
  subjectUser?: Record<string, unknown>;
  creatorUser?: Record<string, unknown>;
  company?: Record<string, unknown>;
  context?: Record<string, unknown>;
  task?: Record<string, unknown>;
}
