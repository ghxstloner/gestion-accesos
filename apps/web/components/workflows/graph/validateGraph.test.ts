/**
 * Tests del validador de grafo de workflow (puerto cliente del backend).
 *
 * Cobertura: los mismos casos del spec backend
 * `apps/api/src/modules/workflows/domain/graph-validator.spec.ts`,
 * adaptados a los mensajes en español que emite nuestro `validateGraph`.
 *
 * Estos tests garantizan paridad de reglas entre cliente y servidor. Si
 * el backend cambia una regla, este archivo debe actualizarse y
 * `components/workflows/graph/validateGraph.ts` también.
 */
import { describe, expect, it } from "vitest";
import { validateGraph, validateCondition } from "./validateGraph";
import { WORKFLOW_SCHEMA_VERSION } from "@/lib/workflow-types";

function validGraph(
  overrides: Partial<{ nodes: unknown[]; edges: unknown[] }> = {},
) {
  return {
    schemaVersion: WORKFLOW_SCHEMA_VERSION,
    nodes: overrides.nodes ?? [
      { key: "start", type: "START", name: "Start" },
      {
        key: "review",
        type: "HUMAN_TASK",
        name: "Review",
        assignment: { type: "ROLE", roleCode: "ACCESS_DOCUMENTS_MANAGER" },
        config: { outcomes: ["APPROVE", "REJECT"] },
      },
      { key: "end", type: "END", name: "End" },
    ],
    edges: overrides.edges ?? [
      { from: "start", to: "review", action: "SUBMIT" },
      { from: "review", to: "end", action: "APPROVE" },
      { from: "review", to: "end", action: "REJECT" },
    ],
  };
}

describe("validateGraph", () => {
  it("acepta un grafo mínimo válido", () => {
    expect(validateGraph(validGraph()).valid).toBe(true);
  });

  it("rechaza un grafo sin START", () => {
    const g = validGraph({
      nodes: [
        {
          key: "review",
          type: "HUMAN_TASK",
          name: "Review",
          assignment: { type: "ROLE", roleCode: "X" },
          config: { outcomes: ["APPROVE"] },
        },
        { key: "end", type: "END", name: "End" },
      ],
    });
    const r = validateGraph(g);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toContain("START");
  });

  it("rechaza un grafo con más de un START", () => {
    const g = validGraph({
      nodes: [
        { key: "start", type: "START", name: "A" },
        { key: "start2", type: "START", name: "B" },
        {
          key: "review",
          type: "HUMAN_TASK",
          name: "Review",
          assignment: { type: "ROLE", roleCode: "X" },
          config: { outcomes: ["APPROVE"] },
        },
        { key: "end", type: "END", name: "End" },
      ],
      edges: [
        { from: "start", to: "review", action: "X" },
        { from: "review", to: "end", action: "APPROVE" },
      ],
    });
    const r = validateGraph(g);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/START/i);
  });

  it("rechaza un grafo sin END", () => {
    const g = validGraph({
      nodes: [
        { key: "start", type: "START", name: "Start" },
        {
          key: "review",
          type: "HUMAN_TASK",
          name: "Review",
          assignment: { type: "ROLE", roleCode: "X" },
          config: { outcomes: ["APPROVE"] },
        },
      ],
      edges: [
        { from: "start", to: "review", action: "SUBMIT" },
        { from: "review", to: "start", action: "APPROVE" },
      ],
    });
    const r = validateGraph(g);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toContain("END");
  });

  it("rechaza nodos huérfanos no alcanzables desde START", () => {
    const g = validGraph({
      nodes: [
        { key: "start", type: "START", name: "Start" },
        { key: "end", type: "END", name: "End" },
        {
          key: "orphan",
          type: "HUMAN_TASK",
          name: "Orphan",
          assignment: { type: "ROLE", roleCode: "X" },
          config: { outcomes: ["APPROVE"] },
        },
      ],
      edges: [
        { from: "start", to: "end", action: "SUBMIT" },
        { from: "orphan", to: "end", action: "APPROVE" },
      ],
    });
    const r = validateGraph(g);
    expect(r.valid).toBe(false);
    // Mensaje habla de "alcanzable" o "huérfano"/ inalcanzable.
    expect(r.errors.join(" ")).toMatch(/alcanzable|huérfano|inalcanzable/i);
  });

  it("rechaza aristas a/desde nodos desconocidos", () => {
    const g = validGraph({
      edges: [
        { from: "start", to: "nope", action: "SUBMIT" },
        { from: "review", to: "end", action: "APPROVE" },
        { from: "review", to: "end", action: "REJECT" },
      ],
    });
    const r = validateGraph(g);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toContain("nope");
  });

  it("rechaza ciclos no autorizados (solo RETURN_FOR_CORRECTION/RESUBMIT permitidos)", () => {
    const g = validGraph({
      nodes: [
        { key: "start", type: "START", name: "Start" },
        {
          key: "review",
          type: "HUMAN_TASK",
          name: "Review",
          assignment: { type: "ROLE", roleCode: "X" },
          config: { outcomes: ["APPROVE", "SOMETHING"] },
        },
        { key: "end", type: "END", name: "End" },
      ],
      edges: [
        { from: "start", to: "review", action: "SUBMIT" },
        { from: "review", to: "review", action: "APPROVE" },
        { from: "review", to: "end", action: "SOMETHING" },
      ],
    });
    const r = validateGraph(g);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/ciclo|cycle/i);
  });

  it("permite ciclo con RETURN_FOR_CORRECTION", () => {
    const g = validGraph({
      nodes: [
        { key: "start", type: "START", name: "Start" },
        {
          key: "first_review",
          type: "HUMAN_TASK",
          name: "First",
          assignment: { type: "ROLE", roleCode: "X" },
          config: { outcomes: ["APPROVE", "RETURN_FOR_CORRECTION"] },
        },
        {
          key: "second_review",
          type: "HUMAN_TASK",
          name: "Second",
          assignment: { type: "ROLE", roleCode: "Y" },
          config: { outcomes: ["RETURN_FOR_CORRECTION", "APPROVE"] },
        },
        { key: "end", type: "END", name: "End" },
      ],
      edges: [
        { from: "start", to: "first_review", action: "SUBMIT" },
        { from: "first_review", to: "second_review", action: "APPROVE" },
        { from: "first_review", to: "end", action: "RETURN_FOR_CORRECTION" },
        {
          from: "second_review",
          to: "first_review",
          action: "RETURN_FOR_CORRECTION",
        },
        { from: "second_review", to: "end", action: "APPROVE" },
      ],
    });
    const r = validateGraph(g);
    if (!r.valid) console.warn("Errores:", r.errors);
    expect(r.valid).toBe(true);
  });

  it("rechaza HUMAN_TASK sin assignment", () => {
    const g = validGraph({
      nodes: [
        { key: "start", type: "START", name: "Start" },
        {
          key: "review",
          type: "HUMAN_TASK",
          name: "X",
          config: { outcomes: ["APPROVE"] },
        },
        { key: "end", type: "END", name: "End" },
      ],
    });
    const r = validateGraph(g);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/HUMAN_TASK.*assignment/i);
  });

  it("rechaza HUMAN_TASK sin outcomes en config", () => {
    const g = validGraph({
      nodes: [
        { key: "start", type: "START", name: "Start" },
        {
          key: "review",
          type: "HUMAN_TASK",
          name: "X",
          assignment: { type: "ROLE", roleCode: "X" },
        },
        { key: "end", type: "END", name: "End" },
      ],
    });
    const r = validateGraph(g);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/outcomes/i);
  });

  it("rechaza SYSTEM sin systemAction", () => {
    const g = validGraph({
      nodes: [
        { key: "start", type: "START", name: "Start" },
        { key: "sys", type: "SYSTEM", name: "Sys" },
        { key: "end", type: "END", name: "End" },
      ],
      edges: [
        { from: "start", to: "sys", action: "SUBMIT" },
        { from: "sys", to: "end", action: "DONE" },
      ],
    });
    const r = validateGraph(g);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/systemAction/i);
  });

  it("rechaza END con aristas salientes", () => {
    const g = validGraph({
      nodes: [
        { key: "start", type: "START", name: "Start" },
        { key: "end", type: "END", name: "End" },
      ],
      edges: [
        { from: "start", to: "end", action: "SUBMIT" },
        { from: "end", to: "start", action: "LOOP" },
      ],
    });
    const r = validateGraph(g);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/salientes|outgoing/i);
  });

  it("rechaza START sin aristas salientes", () => {
    const g = validGraph({
      nodes: [
        { key: "start", type: "START", name: "Start" },
        { key: "end", type: "END", name: "End" },
      ],
      edges: [],
    });
    const r = validateGraph(g);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/saliente|outgoing/i);
  });

  it("rechaza claves de nodo duplicadas", () => {
    const g = validGraph({
      nodes: [
        { key: "start", type: "START", name: "A" },
        { key: "start", type: "END", name: "B" },
      ],
      edges: [{ from: "start", to: "start", action: "SUBMIT" }],
    });
    const r = validateGraph(g);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/duplicad|duplicate/i);
  });

  it("rechaza schemaVersion no soportado", () => {
    const g = {
      ...validGraph(),
      schemaVersion: 99,
    };
    const r = validateGraph(g);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/schemaVersion/i);
  });

  it("rechaza grafo que no es objeto", () => {
    const r = validateGraph(null);
    expect(r.valid).toBe(false);
  });

  it("rechaza grafo con nodes vacío", () => {
    const r = validateGraph({ schemaVersion: 1, nodes: [], edges: [] });
    expect(r.valid).toBe(false);
  });
});

describe("validateCondition", () => {
  it("acepta condición atómica válida", () => {
    const errs = validateCondition({
      field: "request.priority",
      operator: "EQUALS",
      value: 5,
    });
    expect(errs).toEqual([]);
  });

  it("rechaza campo con prefijo no permitido", () => {
    const errs = validateCondition({
      field: "secret.token",
      operator: "EQUALS",
      value: "x",
    });
    expect(errs.length).toBeGreaterThan(0);
    expect(errs.join(" ")).toContain("secret.token");
  });

  it("rechaza operador inválido", () => {
    const errs = validateCondition({
      field: "request.priority",
      operator: "WEIRD",
      value: 1,
    });
    expect(errs.length).toBeGreaterThan(0);
    expect(errs.join(" ")).toMatch(/operador|operator/i);
  });

  it("requiere value array para IN/NOT_IN", () => {
    const errs = validateCondition({
      field: "request.priority",
      operator: "IN",
      value: "not-an-array",
    });
    expect(errs.length).toBeGreaterThan(0);
    expect(errs.join(" ")).toMatch(/array/i);
  });

  it("valida recursivamente en AND/OR", () => {
    const errs = validateCondition({
      op: "AND",
      conditions: [
        { field: "request.priority", operator: "EQUALS", value: 1 },
        { field: "weird.field", operator: "EQUALS", value: 2 },
      ],
    });
    expect(errs.length).toBeGreaterThan(0);
  });

  it("valida NOT", () => {
    const errs = validateCondition({
      op: "NOT",
      condition: { field: "weird.x", operator: "EQUALS", value: 1 },
    });
    expect(errs.length).toBeGreaterThan(0);
  });

  it("bloquea prototype-pollution", () => {
    const errs = validateCondition({
      field: "request.__proto__",
      operator: "EQ",
      value: 1,
    });
    expect(errs.length).toBeGreaterThan(0);
    expect(errs.join(" ")).toMatch(/prohibido|forbidden|__proto__/i);
  });
});
