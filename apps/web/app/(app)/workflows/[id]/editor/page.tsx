"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { PageSkeleton } from "@/components/shared/LoadingSkeletons";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useSgaStore } from "@/lib/store";
import {
  useCreateDraftVersionMutation,
  useLatestDraftVersionQuery,
  usePublishVersionMutation,
  useUpdateDraftVersionMutation,
  useWorkflowDefinitionQuery,
  useWorkflowVersionsQuery,
  usePublishedVersionQuery,
} from "@/hooks/workflow-hooks";
import {
  type WorkflowEdgeData,
  type WorkflowNodeData,
  createSkeletonGraph,
  flowToGraph,
  generateNodeKey,
  graphToFlow,
} from "@/lib/workflow-mapping";
import type {
  WorkflowGraph,
  WorkflowNode,
  WorkflowNodeType,
} from "@/lib/workflow-types";

import { NodePalette } from "@/components/workflows/NodePalette";
import { PropertyPanel } from "@/components/workflows/PropertyPanel";
import { EditorToolbar } from "@/components/workflows/EditorToolbar";
import { StartNode } from "@/components/workflows/nodes/StartNode";
import { EndNode } from "@/components/workflows/nodes/EndNode";
import { HumanTaskNode } from "@/components/workflows/nodes/HumanTaskNode";
import { SystemNode } from "@/components/workflows/nodes/SystemNode";
import { DecisionNode } from "@/components/workflows/nodes/DecisionNode";
import { autoLayout } from "@/components/workflows/graph/layoutGraph";
import { validateGraph } from "@/components/workflows/graph/validateGraph";

const NODE_TYPES = {
  workflowStart: StartNode,
  workflowEnd: EndNode,
  workflowHumanTask: HumanTaskNode,
  workflowSystem: SystemNode,
  workflowDecision: DecisionNode,
} as const;

/**
 * Componente interno que vive dentro de <ReactFlowProvider>. Maneja el estado
 * RF, las mutaciones y la lógica de guardado/publicar.
 */
function EditorInner({ definitionId }: { definitionId: string }) {
  const router = useRouter();
  const currentUser = useSgaStore((s) => s.currentUser);
  const canManage =
    currentUser?.profile?.permissions?.includes("workflows.manage") ?? false;
  const canPublish =
    currentUser?.profile?.permissions?.includes("workflows.publish") ?? false;

  const defQuery = useWorkflowDefinitionQuery(definitionId);
  const draftQuery = useLatestDraftVersionQuery(definitionId);
  const publishedQuery = usePublishedVersionQuery(definitionId);
  const versionsQuery = useWorkflowVersionsQuery(definitionId, {
    page: 1,
    pageSize: 50,
  });
  const createDraft = useCreateDraftVersionMutation(definitionId);
  const updateDraft = useUpdateDraftVersionMutation(
    definitionId,
    draftQuery.data?.id ?? "",
  );
  const publishVersion = usePublishVersionMutation(
    definitionId,
    draftQuery.data?.id ?? "",
  );

  // Carga inicial → si no hay draft, mostrar opción de crear uno.
  const isInitialEditMode = Boolean(draftQuery.data);
  const [creatingDraft, setCreatingDraft] = useState(false);

  // Estado local RF.
  const [nodes, setNodes] = useState<Node<WorkflowNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge<WorkflowEdgeData>[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [baseGraph, setBaseGraph] = useState<WorkflowGraph | undefined>(
    undefined,
  );

  // Inicializar estado RF cuando llega el draft (o publicado si no hay draft).
  // Usamos setState dentro del effect porque estamos sincronizando un snapshot
  // remoto (definitionJson) con estado local editable. La cascada es de un solo
  // salto y ocurre solo cuando cambia la data remota (no en cada render).
  useEffect(() => {
    let g: WorkflowGraph | undefined;
    if (draftQuery.data) g = draftQuery.data.definitionJson;
    else if (publishedQuery.data) g = publishedQuery.data.definitionJson;
    if (!g) return;

    const { nodes: n, edges: e } = graphToFlow(g);
    const finalNodes =
      !g.metadata?.layout || Object.keys(g.metadata.layout).length === 0
        ? autoLayout(n, e).nodes
        : n;
    setNodes(finalNodes); // eslint-disable-line react-hooks/set-state-in-effect
    setEdges(e);
    setBaseGraph(g);
    setDirty(false);
  }, [draftQuery.data, publishedQuery.data]);

  // Determinar modo solo lectura: cuando NO hay draft activo (vista de la
  // publicada) o cuando el actor no tiene permiso workflows.manage.
  const readOnly = !isInitialEditMode || !canManage;

  const currentGraph = useMemo(
    () => flowToGraph(nodes, edges, baseGraph),
    [nodes, edges, baseGraph],
  );

  const validationResult = useMemo(
    () => validateGraph(currentGraph),
    [currentGraph],
  );

  // Validar y marcar nodos inválidos en base al resultado de validación.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNodes((prev) => {
      if (validationResult.valid) {
        const anyInvalid = prev.some(
          (n) => n.data._invalid || n.data._errorMessages,
        );
        if (!anyInvalid) return prev;
        return prev.map((n) =>
          n.data._invalid || n.data._errorMessages
            ? {
                ...n,
                data: {
                  ...n.data,
                  _invalid: false,
                  _errorMessages: undefined,
                },
              }
            : n,
        );
      }
      const errorsByKey = new Map<string, string[]>();
      for (const err of validationResult.errors) {
        const m = err.match(/Nodo '([^']+)'/);
        if (m) {
          const k = m[1];
          if (!errorsByKey.has(k)) errorsByKey.set(k, []);
          errorsByKey.get(k)!.push(err);
        }
      }
      return prev.map((n) => {
        const errs = errorsByKey.get(n.id) ?? [];
        return {
          ...n,
          data: {
            ...n.data,
            _invalid: errs.length > 0,
            _errorMessages: errs,
          },
        };
      });
    });
  }, [validationResult]);

  // ── Handlers RF ──
  const onNodesChange: OnNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (readOnly) return;
      setNodes((prev) => applyNodeChanges(changes, prev) as Node<WorkflowNodeData>[]);
      // Si se movió un nodo, marcamos dirty.
      if (changes.some((c) => c.type === "position")) setDirty(true);
      if (changes.some((c) => c.type === "remove")) setDirty(true);
    },
    [readOnly],
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (readOnly) return;
      setEdges((prev) => applyEdgeChanges(changes, prev) as Edge<WorkflowEdgeData>[]);
      if (changes.some((c) => c.type === "remove")) setDirty(true);
    },
    [readOnly],
  );

  const onConnect: OnConnect = useCallback(
    (conn: Connection) => {
      if (readOnly) return;
      const newEdge: Edge<WorkflowEdgeData> = {
        id: `${conn.source}__${conn.target}__COMPLETE__${Date.now()}`,
        source: conn.source!,
        target: conn.target!,
        label: "COMPLETE",
        data: { action: "COMPLETE", priority: 0 },
      };
      setEdges((prev) => addEdge(newEdge, prev) as Edge<WorkflowEdgeData>[]);
      setDirty(true);
    },
    [readOnly],
  );

  // ── DnD desde la paleta ──
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      if (readOnly) return;
      e.preventDefault();
      const type = e.dataTransfer.getData(
        "application/workflow-node-type",
      ) as WorkflowNodeType;
      if (!type) return;
      const bounds = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const position = {
        x: e.clientX - bounds.left - 120,
        y: e.clientY - bounds.top - 50,
      };
      const existingKeys = new Set(nodes.map((n) => n.id));
      const key = generateNodeKey(type, existingKeys);
      const newNode: Node<WorkflowNodeData> = {
        id: key,
        type: RF_TYPE_BY_DOMAIN[type],
        position,
        data: {
          key,
          type,
          name: NEW_NODE_NAME[type],
          ...(type === "HUMAN_TASK"
            ? {
                assignment: { type: "ROLE", roleCode: "DOCUMENT_RECEIVER", companyScoped: true },
                config: { outcomes: ["APPROVE"] },
              }
            : {}),
          ...(type === "SYSTEM"
            ? {
                config: {
                  systemAction: "UPDATE_REQUEST_STATUS",
                  targetRequestStatus: "SUBMITTED",
                },
              }
            : {}),
        },
      };
      setNodes((prev) => [...prev, newNode]);
      setDirty(true);
    },
    [nodes, readOnly],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  // ── Handlers del PropertyPanel ──
  function updateNodeData(id: string, patch: Partial<WorkflowNode>) {
    setNodes((prev) =>
      prev.map((n) =>
        n.id === id
          ? { ...n, data: { ...n.data, ...patch } as WorkflowNodeData }
          : n,
      ),
    );
    setDirty(true);
  }
  function deleteNode(id: string) {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setEdges((prev) => prev.filter((e) => e.source !== id && e.target !== id));
    if (selectedNodeId === id) setSelectedNodeId(null);
    setDirty(true);
  }
  function updateEdgeData(id: string, patch: Partial<WorkflowEdgeData>) {
    setEdges((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e;
        const next = { ...e.data, ...patch } as WorkflowEdgeData;
        return {
          ...e,
          data: next,
          label: next.action,
          type: next.condition ? "workflowConditional" : undefined,
        };
      }),
    );
    setDirty(true);
  }
  function deleteEdge(id: string) {
    setEdges((prev) => prev.filter((e) => e.id !== id));
    if (selectedEdgeId === id) setSelectedEdgeId(null);
    setDirty(true);
  }

  // ── Save / Publish ──
  async function handleSave() {
    if (!validationResult.valid) {
      toast({
        title: "No se puede guardar",
        description: "Revisa los errores de validación.",
        variant: "destructive",
      });
      return;
    }
    const graph = flowToGraph(nodes, edges, baseGraph);
    try {
      // Si ya existía draft, PATCH. Si no, POST crear draft.
      if (draftQuery.data) {
        await updateDraft.mutateAsync({ graph });
      } else {
        await createDraft.mutateAsync({ graph });
      }
      setBaseGraph(graph);
      setDirty(false);
    } catch (e) {
      toast({
        title: "Error al guardar",
        description: (e as Error).message,
        variant: "destructive",
      });
    }
  }

  async function handlePublish() {
    if (!validationResult.valid) {
      toast({
        title: "No se puede publicar",
        description: "El grafo no pasa la validación.",
        variant: "destructive",
      });
      return;
    }
    if (dirty) {
      toast({
        title: "Guarda primero",
        description: "Debes guardar el borrador antes de publicar.",
        variant: "destructive",
      });
      return;
    }
    if (!draftQuery.data) {
      toast({
        title: "Sin borrador",
        description: "No hay un borrador activo para publicar.",
        variant: "destructive",
      });
      return;
    }
    try {
      await publishVersion.mutateAsync();
      router.push(`/workflows/${definitionId}`);
    } catch (e) {
      // El hook ya muestra el toast adecuado por status code.
      void e;
    }
  }

  async function handleCreateInitialDraft() {
    setCreatingDraft(true);
    try {
      const skeleton = createSkeletonGraph();
      await createDraft.mutateAsync({ graph: skeleton });
      const { nodes: n, edges: e } = graphToFlow(skeleton);
      setNodes(n);
      setEdges(e);
      setBaseGraph(skeleton);
    } catch (e) {
      toast({
        title: "No se pudo crear el borrador",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setCreatingDraft(false);
    }
  }

  // Aviso al cerrar con cambios sin guardar.
  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // Estado de carga.
  if (defQuery.isLoading || draftQuery.isLoading || versionsQuery.isLoading) {
    return <PageSkeleton />;
  }
  if (defQuery.isError || !defQuery.data) {
    return (
      <EmptyState
        title="Flujo no encontrado"
        description="Verifica que el flujo exista y tengas permiso de lectura."
      />
    );
  }

  // Caso: no hay draft – ofrecemos crear uno.
  if (!draftQuery.data && !creatingDraft) {
    return (
      <div className="space-y-6">
        <EditorToolbar
          title={defQuery.data.name}
          versionLabel="Sin borrador activo"
          dirty={false}
          readOnly
          validationErrors={[]}
          validationValid
          saving={false}
          publishing={false}
          canPublish={false}
          onSave={() => undefined}
          onPublish={() => undefined}
        />
        <div className="mx-auto max-w-xl">
          <EmptyState
            icon={undefined}
            title="Aún no hay nada que editar"
            description={
              publishedQuery.data
                ? "Crea un borrador a partir de la versión publicada o empieza uno en blanco."
                : "Crea tu primer borrador para empezar a diseñar el flujo."
            }
            action={
              canManage && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={async () => {
                      setCreatingDraft(true);
                      try {
                        const g = publishedQuery.data!.definitionJson;
                        await createDraft.mutateAsync({ graph: g });
                        const { nodes: n, edges: e } = graphToFlow(g);
                        const laid = autoLayout(n, e);
                        setNodes(laid.nodes);
                        setEdges(e);
                        setBaseGraph({
                          ...g,
                          metadata: { ...(g.metadata ?? {}), layout: laid.layout },
                        });
                      } catch (e) {
                        toast({
                          title: "No se pudo crear el borrador",
                          description: (e as Error).message,
                          variant: "destructive",
                        });
                      } finally {
                        setCreatingDraft(false);
                      }
                    }}
                    disabled={!publishedQuery.data}
                  >
                    Desde publicado
                  </Button>
                  <Button
                    onClick={handleCreateInitialDraft}
                    disabled={creatingDraft}
                  >
                    En blanco
                  </Button>
                </div>
              )
            }
          />
        </div>
      </div>
    );
  }

  // Si está creando el draft, mostramos esqueleto.
  if (creatingDraft) return <PageSkeleton />;

  const selectedNode = selectedNodeId
    ? (nodes.find((n) => n.id === selectedNodeId)?.data ?? null)
    : null;
  const selectedEdge = selectedEdgeId
    ? (edges.find((e) => e.id === selectedEdgeId)?.data ?? null)
    : null;
  const versionLabel = draftQuery.data
    ? `Borrador v${draftQuery.data.versionNumber} · definición ${defQuery.data.key}`
    : `Vista de la versión publicada`;

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col overflow-hidden rounded-2xl border border-border bg-surface">
      <EditorToolbar
        title={defQuery.data.name}
        versionLabel={versionLabel}
        dirty={dirty}
        readOnly={readOnly}
        validationErrors={validationResult.errors}
        validationValid={validationResult.valid}
        saving={updateDraft.isPending || createDraft.isPending}
        publishing={publishVersion.isPending}
        canPublish={canPublish}
        onSave={handleSave}
        onPublish={handlePublish}
      />
      <div className="flex min-h-0 flex-1">
        {!readOnly && <NodePalette />}
        <div
          className="relative flex-1"
          onDrop={onDrop}
          onDragOver={onDragOver}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, n) => {
              setSelectedNodeId(n.id);
              setSelectedEdgeId(null);
            }}
            onEdgeClick={(_, e) => {
              setSelectedEdgeId(e.id);
              setSelectedNodeId(null);
            }}
            onPaneClick={() => {
              setSelectedNodeId(null);
              setSelectedEdgeId(null);
            }}
            nodesDraggable={!readOnly}
            nodesConnectable={!readOnly}
            elementsSelectable={!readOnly}
            deleteKeyCode={readOnly ? null : ["Backspace", "Delete"]}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
            <MiniMap pannable zoomable />
            <Controls showInteractive={!readOnly} />
          </ReactFlow>
        </div>
        <PropertyPanel
          selectedNodeId={selectedNodeId}
          selectedNode={selectedNode}
          selectedEdgeId={selectedEdgeId}
          selectedEdge={selectedEdge}
          onUpdateNode={updateNodeData}
          onUpdateEdge={updateEdgeData}
          onDeleteNode={deleteNode}
          onDeleteEdge={deleteEdge}
          onClose={() => {
            setSelectedNodeId(null);
            setSelectedEdgeId(null);
          }}
          readOnly={readOnly}
        />
      </div>
    </div>
  );
}

const RF_TYPE_BY_DOMAIN: Record<WorkflowNodeType, string> = {
  START: "workflowStart",
  END: "workflowEnd",
  HUMAN_TASK: "workflowHumanTask",
  SYSTEM: "workflowSystem",
  DECISION: "workflowDecision",
};

const NEW_NODE_NAME: Record<WorkflowNodeType, string> = {
  START: "Inicio",
  END: "Fin",
  HUMAN_TASK: "Nueva tarea",
  SYSTEM: "Acción sistema",
  DECISION: "Decisión",
};

export default function WorkflowEditorPage() {
  const params = useParams<{ id: string }>();
  if (!params.id) return <PageSkeleton />;
  return (
    <ReactFlowProvider>
      <EditorInner definitionId={params.id} />
    </ReactFlowProvider>
  );
}
