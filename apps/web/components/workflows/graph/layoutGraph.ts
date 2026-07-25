/**
 * Auto-layout con dagre como fallback cuando un grafo no tiene
 * `metadata.layout`. Solo se usa sobre graphs backend sin coords
 * (versiones publicadas heredadas que ignoran el layout).
 */

import dagre from "dagre";
import type { Edge, Node } from "@xyflow/react";
import type { WorkflowNodeData, WorkflowEdgeData } from "@/lib/workflow-mapping";
import type { WorkflowGraphLayout } from "@/lib/workflow-types";

const NODE_WIDTH = 240;
const NODE_HEIGHT = 100;

export function autoLayout(
  nodes: Node<WorkflowNodeData>[],
  edges: Edge<WorkflowEdgeData>[],
  direction: "LR" | "TB" = "LR",
): { nodes: Node<WorkflowNodeData>[]; layout: WorkflowGraphLayout } {
  const g = new dagre.graphlib.Graph<{ x: number; y: number }>({
    multigraph: true,
  });
  g.setGraph({
    rankdir: direction,
    nodesep: 50,
    ranksep: 80,
    marginx: 30,
    marginy: 30,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const n of nodes) {
    g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT, x: 0, y: 0 });
  }
  for (const e of edges) {
    g.setEdge(e.source, e.target, {}, e.id);
  }

  dagre.layout(g);

  const layout: WorkflowGraphLayout = {};
  const positioned = nodes.map((n) => {
    const p = g.node(n.id);
    const next = {
      ...n,
      position: { x: p.x - NODE_WIDTH / 2, y: p.y - NODE_HEIGHT / 2 },
    };
    layout[n.id] = { x: next.position.x, y: next.position.y };
    return next;
  });

  return { nodes: positioned, layout };
}
