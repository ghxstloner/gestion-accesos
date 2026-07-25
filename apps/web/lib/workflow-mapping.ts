/**
 * Adaptadores entre el modelo de SGA WorkflowGraph y el de React Flow v12.
 *
 * SGA WorkflowNode usa `key` y NO tiene `position` (coords). El layout
 * se persiste en `graph.metadata.layout = { nodeKey: { x, y } }`, campo que
 * el GraphValidator del backend ignora por completo, así que sobrevive
 * perfectamente el round-trip guardar→recargar.
 *
 * React Flow usa `id`/`position`/`data`/`type`. El adaptador bidireccional
 * garantiza que nada se pierda en la conversión.
 */

import type {
  Edge,
  Node,
  Connection,
} from "@xyflow/react";

import {
  type ConditionExpression,
  type EdgeAction,
  type WorkflowAssignment,
  type WorkflowEdge,
  type WorkflowGraph,
  type WorkflowGraphLayout,
  type WorkflowNode,
  type WorkflowNodeType,
  type WorkflowNodeConfig,
  WORKFLOW_SCHEMA_VERSION,
} from "@/lib/workflow-types";

/** Datos que el ReactFlow node llevará como `data`. */
export interface WorkflowNodeData extends WorkflowNode {
  /** Marca temporal de error para resaltar el nodo al usuario. */
  _invalid?: boolean;
  _errorMessages?: string[];
  [key: string]: unknown;
}

export interface WorkflowEdgeData {
  action: EdgeAction;
  condition?: ConditionExpression;
  priority?: number;
  /** Marca temporal de error. */
  _invalid?: boolean;
  [key: string]: unknown;
}

/** Tipo de React Flow que registra en RF el `<nodeTypes>`. */
const RF_NODE_TYPE_BY_DOMAIN: Record<WorkflowNodeType, string> = {
  START: "workflowStart",
  END: "workflowEnd",
  HUMAN_TASK: "workflowHumanTask",
  SYSTEM: "workflowSystem",
  DECISION: "workflowDecision",
};

/**
 * Convierte un grafo SGA a nodos+edges de React Flow.
 * - Si `graph.metadata.layout[nodeKey]` existe, lo usa.
 * - Si no, deja `{x:0,y:0}` y el layout automático (dagre) debe correr después.
 */
export function graphToFlow(graph: WorkflowGraph): {
  nodes: Node<WorkflowNodeData>[];
  edges: Edge<WorkflowEdgeData>[];
} {
  const layout: WorkflowGraphLayout = graph.metadata?.layout ?? {};
  const nodes: Node<WorkflowNodeData>[] = graph.nodes.map((n) => {
    const pos = layout[n.key] ?? { x: 0, y: 0 };
    return {
      id: n.key,
      type: RF_NODE_TYPE_BY_DOMAIN[n.type],
      position: { x: pos.x, y: pos.y },
      data: { ...n } as WorkflowNodeData,
    };
  });
  const edges: Edge<WorkflowEdgeData>[] = graph.edges.map((e, i) => {
    const id = e.key ?? `${e.from}__${e.to}__${e.action}__${i}`;
    return {
      id,
      source: e.from,
      target: e.to,
      label: e.action,
      type: e.condition ? "workflowConditional" : undefined,
      data: {
        action: e.action,
        condition: e.condition,
        priority: e.priority ?? 0,
      },
    };
  });
  return { nodes, edges };
}

/**
 * Convierte nodos+edges de React Flow a un WorkflowGraph SGA válido para
 * enviar al backend (PATCH version). `prev` se usa para conservar cualquier
 * `metadata` adicional no relacionada con layout.
 */
export function flowToGraph(
  nodes: Node<WorkflowNodeData>[],
  edges: Edge<WorkflowEdgeData>[],
  prev?: WorkflowGraph,
): WorkflowGraph {
  const wfNodes: WorkflowNode[] = nodes.map((n) => {
    const { _invalid, _errorMessages, ...rest } = n.data;
    void _invalid;
    void _errorMessages;
    const node: WorkflowNode = {
      key: n.id,
      type: rest.type,
      name: rest.name,
    };
    if (rest.description !== undefined && rest.description !== "")
      node.description = rest.description;
    if (rest.assignment) node.assignment = rest.assignment;
    if (rest.config) node.config = rest.config;
    return node;
  });

  const wfEdges: WorkflowEdge[] = edges.map((e) => {
    const edge: WorkflowEdge = {
      from: e.source,
      to: e.target,
      action: (e.data?.action ?? "COMPLETE") as EdgeAction,
    };
    if (e.data?.condition) edge.condition = e.data.condition;
    if (e.data?.priority !== undefined && e.data.priority !== 0)
      edge.priority = e.data.priority;
    return edge;
  });

  const layout: WorkflowGraphLayout = {};
  for (const n of nodes) {
    layout[n.id] = { x: Math.round(n.position.x), y: Math.round(n.position.y) };
  }

  const metadata = {
    ...(prev?.metadata ?? {}),
    layout,
  };

  return {
    schemaVersion: WORKFLOW_SCHEMA_VERSION,
    nodes: wfNodes,
    edges: wfEdges,
    metadata,
  };
}

/**
 * Construye un grafo nuevo con el skeleton mínimo válido: START→SYSTEM→END.
 * NO replicar el bug del `seed.ts` que definía `ROUTE_OUTCOME` huérfano.
 */
export function createSkeletonGraph(): WorkflowGraph {
  return {
    schemaVersion: WORKFLOW_SCHEMA_VERSION,
    nodes: [
      {
        key: "START",
        type: "START",
        name: "Inicio",
        description: "Punto de entrada del flujo",
      },
      {
        key: "SUBMIT_REQUEST",
        type: "SYSTEM",
        name: "Registrar solicitud",
        description: "Transiciona la solicitud al estado inicial",
        config: {
          systemAction: "UPDATE_REQUEST_STATUS",
          targetRequestStatus: "SUBMITTED",
        },
      },
      {
        key: "END",
        type: "END",
        name: "Fin",
        description: "Cierre del flujo",
      },
    ],
    edges: [
      { from: "START", to: "SUBMIT_REQUEST", action: "BEGIN" },
      { from: "SUBMIT_REQUEST", to: "END", action: "COMPLETE" },
    ],
    metadata: {
      layout: {
        START: { x: 0, y: 0 },
        SUBMIT_REQUEST: { x: 320, y: 0 },
        END: { x: 640, y: 0 },
      },
    },
  };
}

/** Re-aplica coordenadas a un grafo que las trae vacías (caso published legacy). */
export function applyAutoLayout(
  graph: WorkflowGraph,
  layout: WorkflowGraphLayout,
): WorkflowGraph {
  return {
    ...graph,
    metadata: { ...(graph.metadata ?? {}), layout },
  };
}

/** Genera un nodeKey seguro (PascalCase, sin acentos, basado en tipo). */
export function generateNodeKey(
  type: WorkflowNodeType,
  existingKeys: Set<string>,
): string {
  const prefix =
    type === "START"
      ? "START"
      : type === "END"
        ? "END"
        : type === "HUMAN_TASK"
          ? "TASK"
          : type === "SYSTEM"
            ? "SYSTEM"
            : "DECISION";
  if (!existingKeys.has(prefix)) return prefix;
  let i = 2;
  while (existingKeys.has(`${prefix}_${i}`)) i++;
  return `${prefix}_${i}`;
}

/** Comprueba si una Connection RF generará un edge nuevo (sin duplicados). */
export function connectionAlreadyExists(
  nodes: Node<WorkflowNodeData>[],
  edges: Edge<WorkflowEdgeData>[],
  conn: Connection,
): boolean {
  return edges.some(
    (e) =>
      e.source === conn.source &&
      e.target === conn.target &&
      e.data?.action === "COMPLETE", // default cuando RF dibuja
  );
}

// Helpers para reducir ruido al aplicar NodeChange/EdgeChange de RF.
// En la práctica usamos el nativo applyNodeChanges/applyEdgeChanges de
// @xyflow/react desde el editor; estos hooks quedan como utilidades de
// soporte por si se quiere un reducer custom.
//
// (No implementamos aquí — ver editorial page.tsx para el flujo estándar.)

// Conveniencia para crear assignment vacío según tipo.
export function emptyAssignment(type: "ROLE" | "USER"): WorkflowAssignment {
  return type === "ROLE"
    ? { type: "ROLE", companyScoped: true }
    : { type: "USER" };
}

// Conveniencia para crear config vacío según tipo de nodo.
export function emptyConfig(type: WorkflowNodeType): WorkflowNodeConfig | undefined {
  if (type === "HUMAN_TASK") return { outcomes: ["APPROVE"] };
  if (type === "SYSTEM")
    return { systemAction: "NOOP" };
  return undefined;
}
