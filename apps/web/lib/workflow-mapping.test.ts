/**
 * Tests del adaptador SGA ↔ React Flow.
 *
 * Verifican:
 *  - Round-trip graphToFlow → flowToGraph preserva la estructura semántica.
 *  - El layout (metadata.layout) sobrevive el ciclo en coordenadas correctas.
 *  - createSkeletonGraph() produce un grafo válido por el validator.
 *  - generateNodeKey() evita colisiones.
 *  - RF-specific keys (_invalid, _errorMessages) no se filtran al SGA graph.
 */
import { describe, expect, it } from "vitest";
import {
  graphToFlow,
  flowToGraph,
  createSkeletonGraph,
  generateNodeKey,
  emptyAssignment,
  emptyConfig,
} from "./workflow-mapping";
import { validateGraph } from "@/components/workflows/graph/validateGraph";
import type { WorkflowGraph, WorkflowNode } from "@/lib/workflow-types";

const sampleGraph: WorkflowGraph = {
  schemaVersion: 1,
  nodes: [
    { key: "start", type: "START", name: "Inicio" },
    {
      key: "review",
      type: "HUMAN_TASK",
      name: "Revisión",
      assignment: { type: "ROLE", roleCode: "ACCESS_DOCUMENTS_MANAGER" },
      config: { outcomes: ["APPROVE", "REJECT"] },
    },
    { key: "end", type: "END", name: "Fin" },
  ],
  edges: [
    { from: "start", to: "review", action: "BEGIN" },
    { from: "review", to: "end", action: "APPROVE" },
    { from: "review", to: "end", action: "REJECT" },
  ],
  metadata: {
    layout: {
      start: { x: 0, y: 0 },
      review: { x: 200, y: 0 },
      end: { x: 400, y: 0 },
    },
  },
};

describe("graphToFlow", () => {
  it("convierte nodos preservando key y position", () => {
    const { nodes } = graphToFlow(sampleGraph);
    expect(nodes).toHaveLength(3);
    const start = nodes.find((n) => n.data.key === "start");
    expect(start).toBeDefined();
    expect(start?.position).toEqual({ x: 0, y: 0 });
    expect(start?.type).toBe("workflowStart");
  });

  it("convierte edges preservando action", () => {
    const { edges } = graphToFlow(sampleGraph);
    expect(edges).toHaveLength(3);
    const approveEdge = edges.find(
      (e) => e.source === "review" && e.target === "end" && e.data?.action === "APPROVE",
    );
    expect(approveEdge).toBeDefined();
  });

  it("usa position (0,0) si metadata.layout falta", () => {
    const g: WorkflowGraph = { ...sampleGraph, metadata: {} };
    const { nodes } = graphToFlow(g);
    expect(nodes.every((n) => n.position.x === 0 && n.position.y === 0)).toBe(true);
  });
});

describe("flowToGraph", () => {
  it("round-trip preserva nodos, edges y layout", () => {
    const { nodes, edges } = graphToFlow(sampleGraph);
    const back = flowToGraph(nodes, edges, sampleGraph);

    expect(back.schemaVersion).toBe(sampleGraph.schemaVersion);
    expect(back.nodes).toHaveLength(3);
    expect(back.edges).toHaveLength(3);

    // Layout sobrevive — coordenadas idénticas.
    expect(back.metadata?.layout?.start).toEqual({ x: 0, y: 0 });
    expect(back.metadata?.layout?.review).toEqual({ x: 200, y: 0 });
    expect(back.metadata?.layout?.end).toEqual({ x: 400, y: 0 });

    // Maps preservan por key.
    const originalKeys = sampleGraph.nodes.map((n) => n.key).sort();
    const backKeys = back.nodes.map((n) => n.key).sort();
    expect(backKeys).toEqual(originalKeys);
  });

  it("no filtra claves internas de RF (_invalid/_errorMessages) al SGA graph", () => {
    const { nodes, edges } = graphToFlow(sampleGraph);
    // Marcamos şi/artificiales un nodo como inválido.
    const tainted = nodes.map((n) =>
      n.data.key === "review"
        ? {
            ...n,
            data: { ...n.data, _invalid: true, _errorMessages: ["X"] },
          }
        : n,
    );
    const back = flowToGraph(tainted, edges, sampleGraph);
    const reviewNode = back.nodes.find((n) => n.key === "review") as WorkflowNode;
    expect(JSON.stringify(reviewNode)).not.toContain("_invalid");
    expect(JSON.stringify(reviewNode)).not.toContain("_errorMessages");
  });
});

describe("createSkeletonGraph", () => {
  it("genera un grafo que pasa el validador", () => {
    const g = createSkeletonGraph();
    const r = validateGraph(g);
    if (!r.valid) console.warn("Skeleton inválido:", r.errors);
    expect(r.valid).toBe(true);
  });

  it("incluye START y END", () => {
    const g = createSkeletonGraph();
    expect(g.nodes.some((n) => n.type === "START")).toBe(true);
    expect(g.nodes.some((n) => n.type === "END")).toBe(true);
  });
});

describe("generateNodeKey", () => {
  it("genera keys únicos basados en el tipo", () => {
    const k1 = generateNodeKey("HUMAN_TASK", new Set());
    const k2 = generateNodeKey("HUMAN_TASK", new Set([k1]));
    expect(k1).not.toBe(k2);
  });

  it("usa prefijos legibles por tipo (TASK, SYSTEM, DECISION, START, END)", () => {
    expect(generateNodeKey("HUMAN_TASK", new Set())).toBe("TASK");
    expect(generateNodeKey("SYSTEM", new Set())).toBe("SYSTEM");
    expect(generateNodeKey("DECISION", new Set())).toBe("DECISION");
    expect(generateNodeKey("START", new Set())).toBe("START");
    expect(generateNodeKey("END", new Set())).toBe("END");
  });

  it("evita colisiones agregando sufijo numérico", () => {
    expect(generateNodeKey("SYSTEM", new Set(["SYSTEM"]))).toBe("SYSTEM_2");
    expect(generateNodeKey("SYSTEM", new Set(["SYSTEM", "SYSTEM_2"]))).toBe(
      "SYSTEM_3",
    );
  });
});

describe("emptyAssignment / emptyConfig", () => {
  it("emptyAssignment('ROLE') incluye companyScoped por defecto", () => {
    const a = emptyAssignment("ROLE");
    expect(a.type).toBe("ROLE");
    expect(a.companyScoped).toBe(true);
  });

  it("emptyAssignment('USER') produce shape mínimo", () => {
    const a = emptyAssignment("USER");
    expect(a.type).toBe("USER");
  });

  it("emptyConfig('HUMAN_TASK') retorna outcomes por defecto", () => {
    const c = emptyConfig("HUMAN_TASK");
    expect(c?.outcomes).toBeDefined();
    expect(c?.outcomes?.length).toBeGreaterThan(0);
  });

  it("emptyConfig('SYSTEM') retorna systemAction por defecto", () => {
    const c = emptyConfig("SYSTEM");
    expect(c?.systemAction).toBeDefined();
  });

  it("emptyConfig('START'/'END') retorna undefined", () => {
    expect(emptyConfig("START")).toBeUndefined();
    expect(emptyConfig("END")).toBeUndefined();
  });
});
