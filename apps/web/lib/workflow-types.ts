/**
 * Tipos estrictos del dominio “workflows”.
 *
 * Estos tipos espejan el modelo del backend en
 * `apps/api/src/modules/workflows/domain/workflow-definition.types.ts`,
 * NO los DTOs sueltos (que usan `Record<string, unknown>`). El backend acepta
 * cualquier objeto en `assignment`/`config`/`condition`, pero el editor debe
 * producir únicamente este shape para respetar las 12 reglas de GraphValidator
 * (`apps/api/src/modules/workflows/domain/graph-validator.ts`).
 *
 * Si el backend evoluciona, este archivo debe actualizarse en sincronía.
 */

export const WORKFLOW_SCHEMA_VERSION = 1 as const;

export type WorkflowNodeType =
  | "START"
  | "END"
  | "HUMAN_TASK"
  | "SYSTEM"
  | "DECISION";

export type HumanTaskOutcome =
  | "APPROVE"
  | "REJECT"
  | "RETURN_FOR_CORRECTION"
  | "RESUBMIT"
  | "CANCEL"
  | "COMPLETE";

export type SystemAction = "UPDATE_REQUEST_STATUS" | "NOOP";

export type WorkflowStatus = "DRAFT" | "PUBLISHED" | "RETIRED";

export type WorkflowInstanceStatus =
  | "ACTIVE"
  | "COMPLETED"
  | "CANCELLED"
  | "FAILED";

export type AssignmentType = "ROLE" | "USER";

export type RequestStatusTarget =
  | "SUBMITTED"
  | "CANCELLED"
  | "REJECTED"
  | "RETURNED_FOR_CORRECTION"
  | "APPROVED"
  | "RESUBMITTED";

export type WorkflowRequestType =
  | "NEW_PERSONNEL"
  | "TEMPORARY_PERSONNEL"
  | "VEHICLE"
  | "EQUIPMENT";

/**
 * Valores válidos para `edge.action` según tipo de nodo fuente:
 *   START   → BEGIN (uno)
 *   SYSTEM  → COMPLETE (uno)
 *   DECISION→ EVALUATE (varios, con condition + priority)
 *   HUMAN_TASK → uno de HumanTaskOutcome presente en config.outcomes
 *   END     → ninguno
 */
export type EdgeAction =
  | "BEGIN"
  | "COMPLETE"
  | "EVALUATE"
  | HumanTaskOutcome;

export interface WorkflowAssignment {
  type: AssignmentType;
  /** Requerido cuando `type === 'ROLE'`. */
  roleCode?: string;
  /** Requerido cuando `type === 'USER'`. */
  userId?: string;
  /** Si true, la tarea se asigna al rol en la empresa de la solicitud. */
  companyScoped?: boolean;
}

export interface WorkflowNodeConfig {
  /** Requerido para HUMAN_TASK (no vacío). */
  outcomes?: HumanTaskOutcome[];
  /** Requerido para SYSTEM. */
  systemAction?: SystemAction;
  /** Requerido cuando `systemAction === 'UPDATE_REQUEST_STATUS'`. */
  targetRequestStatus?: RequestStatusTarget;
  /** Permite ciclos RETURN_FOR_CORRECTION/RESUBMIT sobre este nodo HUMAN_TASK. */
  allowReturnCycle?: boolean;
}

export interface WorkflowNode {
  key: string;
  type: WorkflowNodeType;
  name: string;
  description?: string;
  /** Requerido para HUMAN_TASK. */
  assignment?: WorkflowAssignment;
  /** Requerido para HUMAN_TASK y SYSTEM. */
  config?: WorkflowNodeConfig;
}

// ── ConditionExpression DSL ──────────────────────────────────────────────
// Espeja `apps/api/src/modules/workflows/domain/condition-evaluator.ts`.

export type AtomicConditionOperator =
  | "EQUALS"
  | "NOT_EQUALS"
  | "IN"
  | "NOT_IN"
  | "GREATER_THAN"
  | "GREATER_THAN_OR_EQUAL"
  | "LESS_THAN"
  | "LESS_THAN_OR_EQUAL"
  | "EXISTS"
  | "NOT_EXISTS";

export type ConditionCombinator = "AND" | "OR" | "NOT";

export type ConditionExpression =
  | { op: "AND" | "OR"; conditions: ConditionExpression[] }
  | { op: "NOT"; condition: ConditionExpression }
  | {
      field: string;
      operator: AtomicConditionOperator;
      value?: unknown;
    };

/** Prefijos permitidos para `field` en condiciones atómicas. */
export const CONDITION_FIELD_PREFIXES = [
  "request.",
  "subjectUser.",
  "creatorUser.",
  "company.",
  "context.",
  "task.",
] as const;

export type ConditionFieldPrefix = (typeof CONDITION_FIELD_PREFIXES)[number];

export interface WorkflowEdge {
  /** Opcional en wire; calculado `${from}__${to}__${action}` si no se provee. */
  key?: string;
  from: string;
  to: string;
  action: EdgeAction;
  /** Condiciones válidas para DECISION (EVALUATE). */
  condition?: ConditionExpression;
  /** Mayor gana sobre otros edges con mismo `from`+`action`. Default 0. */
  priority?: number;
}

export interface WorkflowGraphLayout {
  [nodeKey: string]: { x: number; y: number };
}

export interface WorkflowGraphMetadata {
  layout?: WorkflowGraphLayout;
  description?: string;
}

export interface WorkflowGraph {
  schemaVersion: typeof WORKFLOW_SCHEMA_VERSION;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  metadata?: WorkflowGraphMetadata;
}

// ── Respuestas del backend (DTOs) ────────────────────────────────────────

export interface WorkflowDefinitionResponse {
  id: string;
  key: string;
  name: string;
  description: string | null;
  requestType: WorkflowRequestType | null;
  status: WorkflowStatus;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowVersionResponse {
  id: string;
  workflowDefinitionId: string;
  versionNumber: number;
  status: WorkflowStatus;
  schemaVersion: number;
  definitionJson: WorkflowGraph;
  checksum: string;
  createdByUserId: string;
  publishedByUserId: string | null;
  createdAt: string;
  publishedAt: string | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
