/**
 * Validador de grafo de workflow — puerto 1:1 del backend
 * `apps/api/src/modules/workflows/domain/graph-validator.ts`.
 *
 * Ejecuta las mismas 12 reglas en cliente para feedback inmediato. El backend
 * seguirá rechazando graphs inválidos (frontend NO es barrera de seguridad,
 * solo UX). Cuando se actualice el backend, este archivo debe synchronizarse
 * y los tests deben pasar con los mismos casos que
 * `apps/api/test/workflow/*.spec.ts`.
 */

import {
  type WorkflowAssignment,
  type WorkflowEdge,
  type WorkflowGraph,
  type WorkflowNode,
  type WorkflowNodeType,
  WORKFLOW_SCHEMA_VERSION,
} from "@/lib/workflow-types";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const ALLOWED_NODE_TYPES: WorkflowNodeType[] = [
  "START",
  "END",
  "HUMAN_TASK",
  "SYSTEM",
  "DECISION",
];

const ALLOWED_HUMAN_TASK_OUTCOMES = new Set([
  "APPROVE",
  "REJECT",
  "RETURN_FOR_CORRECTION",
  "RESUBMIT",
  "CANCEL",
  "COMPLETE",
]);

const ALLOWED_SYSTEM_ACTIONS = new Set(["UPDATE_REQUEST_STATUS", "NOOP"]);

const ALLOWED_TARGET_STATUSES = new Set([
  "SUBMITTED",
  "CANCELLED",
  "REJECTED",
  "RETURNED_FOR_CORRECTION",
  "APPROVED",
  "RESUBMITTED",
]);

const CONDITION_FIELD_PREFIXES = [
  "request.",
  "subjectUser.",
  "creatorUser.",
  "company.",
  "context.",
  "task.",
] as const;

const ALLOWED_OPERATORS = new Set([
  "EQUALS",
  "NOT_EQUALS",
  "IN",
  "NOT_IN",
  "GREATER_THAN",
  "GREATER_THAN_OR_EQUAL",
  "LESS_THAN",
  "LESS_THAN_OR_EQUAL",
  "EXISTS",
  "NOT_EXISTS",
]);

/** Acciones permitidas para un ciclo (DFS back-edge). */
const ALLOWED_CYCLE_ACTIONS = new Set([
  "RETURN_FOR_CORRECTION",
  "RESUBMIT",
  "return",
  "resubmit",
]);

/**
 * Valida que `condition` sea un ConditionExpression válido.
 * Puerto de `condition-evaluator.ts::validate`.
 */
export function validateCondition(cond: unknown): string[] {
  const errors: string[] = [];
  if (cond === null || typeof cond !== "object" || Array.isArray(cond)) {
    errors.push("Condition debe ser un objeto");
    return errors;
  }
  const c = cond as Record<string, unknown>;
  if ("op" in c) {
    if (c.op === "AND" || c.op === "OR") {
      const subs = c.conditions;
      if (!Array.isArray(subs) || subs.length === 0) {
        errors.push(`${c.op} requiere un array 'conditions' no vacío`);
      } else {
        for (const s of subs) errors.push(...validateCondition(s));
      }
    } else if (c.op === "NOT") {
      if (!c.condition) errors.push("NOT requiere 'condition'");
      else errors.push(...validateCondition(c.condition));
    } else {
      errors.push(`Operador desconocido: ${String(c.op)}`);
    }
    return errors;
  }
  if (!("field" in c) || typeof c.field !== "string" || c.field.length === 0) {
    errors.push("Condición atómica requiere 'field' (string no vacío)");
    return errors;
  }
  const field = c.field as string;
  // Anti path-traversal / prototype-pollution guards.
  if (/[.[\]]__proto__|prototype|constructor/.test(field)) {
    errors.push(`Campo prohibido: ${field}`);
    return errors;
  }
  if (
    ![...CONDITION_FIELD_PREFIXES].some((p) => field.startsWith(p))
  ) {
    errors.push(`Campo no permitido: ${field}`);
    return errors;
  }
  if (
    !("operator" in c) ||
    typeof c.operator !== "string" ||
    !ALLOWED_OPERATORS.has(c.operator as string)
  ) {
    errors.push(`Operador inválido: ${String(c.operator ?? "")}`);
    return errors;
  }
  const op = c.operator as string;
  if (op === "IN" || op === "NOT_IN") {
    if (!Array.isArray(c.value)) {
      errors.push(`${op} requiere 'value' como array`);
    }
  } else if (op === "EXISTS" || op === "NOT_EXISTS") {
    // value no requerido
  } else {
    if (c.value === undefined) {
      errors.push(`${op} requiere 'value'`);
    }
  }
  return errors;
}

/**
 * Ejecuta las 12 reglas del backend y retorna todos los errores encontrados.

/**
 * Ejecuta las 12 reglas del backend y retorna todos los errores encontrados.
 * No es fail-fast (igual que el backend).
 */
export function validateGraph(graph: unknown): ValidationResult {
  const errors: string[] = [];

  // R1
  if (!graph || typeof graph !== "object" || Array.isArray(graph)) {
    return { valid: false, errors: ["definitionJson debe ser un objeto"] };
  }
  const g = graph as Partial<WorkflowGraph>;

  // R2
  if (
    g.schemaVersion !== undefined &&
    g.schemaVersion !== WORKFLOW_SCHEMA_VERSION
  ) {
    errors.push(
      `schemaVersion debe ser ${WORKFLOW_SCHEMA_VERSION} (recibido: ${String(g.schemaVersion)})`,
    );
  }

  // R3
  if (!Array.isArray(g.nodes) || g.nodes.length === 0) {
    errors.push("'nodes' debe ser un array no vacío");
    return { valid: false, errors };
  }
  if (!Array.isArray(g.edges)) {
    errors.push("'edges' debe ser un array");
    return { valid: false, errors };
  }

  const nodes = g.nodes as WorkflowNode[];
  const edges = g.edges as WorkflowEdge[];
  const keySet = new Set<string>();

  // R4 + R5 + R6 + R7 + R8 (per-node)
  let startCount = 0;
  let endCount = 0;
  for (const n of nodes) {
    const errs = validateNode(n, keySet);
    for (const e of errs) errors.push(`Nodo '${String(n.key)}': ${e}`);
    if (n.type === "START") startCount++;
    if (n.type === "END") endCount++;
  }
  if (startCount === 0)
    errors.push("Debe haber exactamente un nodo START (encontrados: 0)");
  if (startCount > 1)
    errors.push(`Debe haber exactamente un nodo START (encontrados: ${startCount})`);
  if (endCount === 0) errors.push("Debe haber al menos un nodo END");

  // R9 (per-edge + condition validation)
  for (const e of edges) {
    const errs = validateEdge(e, keySet);
    for (const er of errs) errors.push(`Edge '${e.from}'→'${e.to}': ${er}`);
  }

  // R10 (reachability from START)
  errors.push(...validateReachability(nodes, edges));

  // R11 (cycle detection)
  errors.push(...detectUnauthorizedCycles(nodes, edges));

  // R12 START tiene ≥1 salida, END tiene 0
  for (const n of nodes) {
    if (n.type === "START") {
      const out = edges.filter((e) => e.from === n.key);
      if (out.length === 0) errors.push(`START '${n.key}' debe tener al menos una arista saliente`);
    }
    if (n.type === "END") {
      const out = edges.filter((e) => e.from === n.key);
      if (out.length > 0) errors.push(`END '${n.key}' no debe tener aristas salientes`);
    }
  }

  return { valid: errors.length === 0, errors };
}

function validateNode(n: WorkflowNode, keySet: Set<string>): string[] {
  const errors: string[] = [];
  if (!n || typeof n !== "object") {
    return ["Nodo debe ser un objeto"];
  }
  if (typeof n.key !== "string" || n.key.length === 0) {
    errors.push("key requerido (string no vacío)");
    return errors;
  }
  if (keySet.has(n.key)) {
    errors.push(`key duplicado: '${n.key}'`);
  }
  keySet.add(n.key);
  if (typeof n.name !== "string" || n.name.length === 0)
    errors.push("name requerido");
  if (!ALLOWED_NODE_TYPES.includes(n.type))
    errors.push(`type inválido: ${String(n.type)}`);

  if (n.type === "HUMAN_TASK") {
    if (!n.assignment) errors.push("HUMAN_TASK requiere 'assignment'");
    else errors.push(...validateAssignment(n.assignment));
    if (!n.config?.outcomes || n.config.outcomes.length === 0)
      errors.push("HUMAN_TASK requiere config.outcomes no vacío");
    else {
      for (const o of n.config.outcomes) {
        if (!ALLOWED_HUMAN_TASK_OUTCOMES.has(o))
          errors.push(`outcome inválido en HUMAN_TASK: ${String(o)}`);
      }
    }
  }

  if (n.type === "SYSTEM") {
    if (!n.config?.systemAction)
      errors.push("SYSTEM requiere config.systemAction");
    else if (!ALLOWED_SYSTEM_ACTIONS.has(n.config.systemAction))
      errors.push(`systemAction inválido: ${String(n.config.systemAction)}`);
    if (n.config?.systemAction === "UPDATE_REQUEST_STATUS") {
      if (!n.config.targetRequestStatus)
        errors.push("UPDATE_REQUEST_STATUS requiere config.targetRequestStatus");
      else if (
        !ALLOWED_TARGET_STATUSES.has(n.config.targetRequestStatus)
      )
        errors.push(
          `targetRequestStatus inválido: ${String(n.config.targetRequestStatus)}`,
        );
    }
  }

  return errors;
}

function validateAssignment(a: WorkflowAssignment): string[] {
  const errors: string[] = [];
  if (a.type !== "ROLE" && a.type !== "USER") {
    errors.push(`assignment.type inválido: ${String(a.type)}`);
    return errors;
  }
  if (a.type === "ROLE" && (!a.roleCode || a.roleCode.length === 0))
    errors.push("assignment ROLE requiere roleCode");
  if (a.type === "USER" && (!a.userId || a.userId.length === 0))
    errors.push("assignment USER requiere userId");
  return errors;
}

function validateEdge(e: WorkflowEdge, keySet: Set<string>): string[] {
  const errors: string[] = [];
  if (!e || typeof e !== "object") return ["Edge debe ser un objeto"];
  if (typeof e.from !== "string" || e.from.length === 0)
    errors.push("'from' requerido");
  if (typeof e.to !== "string" || e.to.length === 0)
    errors.push("'to' requerido");
  if (typeof e.action !== "string" || e.action.length === 0)
    errors.push("'action' requerido");
  if (e.from && !keySet.has(e.from))
    errors.push(`'from' no existe: '${e.from}'`);
  if (e.to && !keySet.has(e.to)) errors.push(`'to' no existe: '${e.to}'`);
  if (e.from && e.from === e.to) errors.push("No se permiten loops (from === to)");
  if (e.condition) errors.push(...validateCondition(e.condition));
  return errors;
}

function validateReachability(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): string[] {
  const errors: string[] = [];
  const start = nodes.find((n) => n.type === "START");
  if (!start) return errors;
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n.key, []);
  for (const e of edges) {
    if (adj.has(e.from)) adj.get(e.from)!.push(e.to);
  }
  const visited = new Set<string>();
  const queue: string[] = [start.key];
  while (queue.length) {
    const cur = queue.shift()!;
    if (visited.has(cur)) continue;
    visited.add(cur);
    for (const t of adj.get(cur) ?? []) if (!visited.has(t)) queue.push(t);
  }
  for (const n of nodes) {
    if (!visited.has(n.key))
      errors.push(`Nodo '${n.key}' no es alcanzable desde START`);
  }
  const reachableEnds = nodes.filter(
    (n) => n.type === "END" && visited.has(n.key),
  );
  if (reachableEnds.length === 0)
    errors.push("Al menos un END debe ser alcanzable desde START");
  return errors;
}

/** DFS WHITE/GRAY/BLACK con back-edge action check. */
function detectUnauthorizedCycles(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): string[] {
  const errors: string[] = [];
  const adj = new Map<string, { to: string; action: string }[]>();
  for (const n of nodes) adj.set(n.key, []);
  for (const e of edges) {
    if (adj.has(e.from)) adj.get(e.from)!.push({ to: e.to, action: e.action });
  }
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const n of nodes) color.set(n.key, WHITE);
  const stack: { node: string; idx: number }[] = [];
  const path: string[] = [];

  function dfs(start: string): boolean {
    color.set(start, GRAY);
    path.push(start);
    stack.push({ node: start, idx: 0 });
    while (stack.length) {
      const top = stack[stack.length - 1];
      const neighbors = adj.get(top.node) ?? [];
      if (top.idx >= neighbors.length) {
        color.set(top.node, BLACK);
        path.pop();
        stack.pop();
        continue;
      }
      const e = neighbors[top.idx];
      top.idx++;
      const c = color.get(e.to);
      if (c === GRAY) {
        // back-edge: solo se permite si la action es de ciclo válido.
        if (!ALLOWED_CYCLE_ACTIONS.has(e.action)) {
          errors.push(
            `Ciclo no autorizado detectado en '${e.to}': acción '${e.action}' no permitida (solo RETURN_FOR_CORRECTION/RESUBMIT)`,
          );
          return true;
        }
      } else if (c === WHITE) {
        color.set(e.to, GRAY);
        path.push(e.to);
        stack.push({ node: e.to, idx: 0 });
      }
    }
    return false;
  }
  for (const n of nodes) if (color.get(n.key) === WHITE) dfs(n.key);
  return errors;
}
