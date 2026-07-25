"use client";

import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConditionBuilder } from "./ConditionBuilder";
import {
  emptyAssignment,
  emptyConfig,
  type WorkflowEdgeData,
  type WorkflowNodeData,
} from "@/lib/workflow-mapping";
import {
  type ConditionExpression,
  type EdgeAction,
  type HumanTaskOutcome,
  type RequestStatusTarget,
  type SystemAction,
  type WorkflowAssignment,
  type WorkflowNode,
  type WorkflowNodeType,
} from "@/lib/workflow-types";

const OUTCOME_OPTIONS: { value: HumanTaskOutcome; label: string }[] = [
  { value: "APPROVE", label: "Aprobar" },
  { value: "REJECT", label: "Rechazar" },
  { value: "RETURN_FOR_CORRECTION", label: "Devolver para corrección" },
  { value: "RESUBMIT", label: "Reenviar" },
  { value: "CANCEL", label: "Cancelar" },
  { value: "COMPLETE", label: "Completar" },
];

const TARGET_STATUS_OPTIONS: { value: RequestStatusTarget; label: string }[] = [
  { value: "SUBMITTED", label: "Enviada (SUBMITTED)" },
  { value: "RETURNED_FOR_CORRECTION", label: "Devuelta para corrección" },
  { value: "RESUBMITTED", label: "Reenviada (RESUBMITTED)" },
  { value: "APPROVED", label: "Aprobada (APPROVED)" },
  { value: "REJECTED", label: "Rechazada (REJECTED)" },
  { value: "CANCELLED", label: "Cancelada (CANCELLED)" },
];

const ROLE_CODE_OPTIONS = [
  { value: "DOCUMENT_RECEIVER", label: "Receptor de documentos" },
  { value: "ACCESS_DOCUMENTS_MANAGER", label: "Jefe de documentos" },
  { value: "CARD_ISSUER", label: "Emisor de carné" },
  { value: "COMPANY_ADMIN", label: "Administrador de empresa" },
  { value: "SYSTEM_ADMIN", label: "Administrador del sistema" },
];

// Etiquetas legibles para los tipos de nodo del editor.
const NODE_TYPE_LABELS: Record<WorkflowNodeType, string> = {
  START: "Inicio",
  END: "Fin",
  HUMAN_TASK: "Tarea humana",
  SYSTEM: "Acción del sistema",
  DECISION: "Decisión",
};

/**
 * Panel lateral con las propiedades del nodo o arista seleccionada.
 * Lee y muta localmente; el botón “Guardar” del editor persiste.
 */
export function PropertyPanel({
  selectedNodeId,
  selectedNode,
  selectedEdgeId,
  selectedEdge,
  onUpdateNode,
  onUpdateEdge,
  onDeleteNode,
  onDeleteEdge,
  onClose,
  readOnly,
}: {
  selectedNodeId: string | null;
  selectedNode: WorkflowNodeData | null;
  selectedEdgeId: string | null;
  selectedEdge: WorkflowEdgeData | null;
  onUpdateNode: (id: string, patch: Partial<WorkflowNode>) => void;
  onUpdateEdge: (id: string, patch: Partial<WorkflowEdgeData>) => void;
  onDeleteNode: (id: string) => void;
  onDeleteEdge: (id: string) => void;
  onClose: () => void;
  readOnly?: boolean;
}) {
  return (
    <aside className="flex w-[340px] shrink-0 flex-col border-l border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-text-primary">
          Propiedades
          {readOnly && (
            <span className="ml-2 text-xs font-normal text-text-muted">
              (solo lectura)
            </span>
          )}
        </h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {!selectedNode && !selectedEdge && (
          <p className="text-sm text-text-muted">
            Selecciona un nodo o arista para editar sus propiedades.
          </p>
        )}
        {selectedNode && selectedNodeId && (
          <NodeEditor
            node={selectedNode}
            onUpdate={(patch) => onUpdateNode(selectedNodeId, patch)}
            onDelete={() => onDeleteNode(selectedNodeId)}
            readOnly={readOnly}
          />
        )}
        {selectedEdge && !selectedNode && selectedEdgeId && (
          <EdgeEditor
            edge={selectedEdge}
            onUpdate={(patch) => onUpdateEdge(selectedEdgeId, patch)}
            onDelete={() => onDeleteEdge(selectedEdgeId)}
            readOnly={readOnly}
          />
        )}
      </div>
    </aside>
  );
}

function NodeEditor({
  node,
  onUpdate,
  onDelete,
  readOnly,
}: {
  node: WorkflowNodeData;
  onUpdate: (patch: Partial<WorkflowNode>) => void;
  onDelete: () => void;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {NODE_TYPE_LABELS[node.type]}
      </div>
      <Field label="Clave (identificador)">
        <Input value={node.key} disabled className="font-mono text-xs" />
      </Field>
      {node.type !== "START" && node.type !== "END" && (
        <Field label="Nombre">
          <Input
            value={node.name}
            disabled={readOnly}
            onChange={(e) => onUpdate({ name: e.target.value })}
          />
        </Field>
      )}
      {node.type !== "START" && node.type !== "END" && (
        <Field label="Descripción">
          <Textarea
            value={node.description ?? ""}
            disabled={readOnly}
            rows={2}
            onChange={(e) => onUpdate({ description: e.target.value })}
          />
        </Field>
      )}
      {node.type === "START" && (
        <Field label="Tipo">
          <Select value="START" disabled>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="START">Inicio</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      )}

      {node.type === "HUMAN_TASK" && !readOnly && (
        <HumanTaskFields node={node} onUpdate={onUpdate} />
      )}
      {node.type === "SYSTEM" && !readOnly && (
        <SystemFields node={node} onUpdate={onUpdate} />
      )}

      {!readOnly && node.type !== "START" && node.type !== "END" && (
        <div className="border-t border-border pt-3">
          <Button variant="destructive" size="sm" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
            Eliminar nodo
          </Button>
        </div>
      )}
    </div>
  );
}

function HumanTaskFields({
  node,
  onUpdate,
}: {
  node: WorkflowNodeData;
  onUpdate: (patch: Partial<WorkflowNode>) => void;
}) {
  const assignment = node.assignment ?? emptyAssignment("ROLE");
  const setAssignment = (next: WorkflowAssignment) =>
    onUpdate({ assignment: next });
  const outcomes = node.config?.outcomes ?? [];
  const toggleOutcome = (o: HumanTaskOutcome) => {
    const next = outcomes.includes(o)
      ? outcomes.filter((x) => x !== o)
      : [...outcomes, o];
    onUpdate({ config: { ...(node.config ?? {}), outcomes: next } });
  };
  return (
    <div className="space-y-4 rounded-lg border border-border p-3">
      <Field label="Asignación">
        <Select
          value={assignment.type}
          onValueChange={(v) => {
            const next = emptyAssignment(v as "ROLE" | "USER");
            setAssignment(next);
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ROLE">Por rol</SelectItem>
            <SelectItem value="USER">Por usuario específico</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      {assignment.type === "ROLE" && (
        <Field label="Rol">
          <Select
            value={assignment.roleCode ?? ""}
            onValueChange={(v) =>
              setAssignment({ ...assignment, roleCode: v })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un rol" />
            </SelectTrigger>
            <SelectContent>
              {ROLE_CODE_OPTIONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
      {assignment.type === "USER" && (
        <Field label="ID usuario">
          <Input
            value={assignment.userId ?? ""}
            placeholder="UUID del usuario"
            onChange={(e) =>
              setAssignment({ ...assignment, userId: e.target.value })
            }
          />
        </Field>
      )}

      <Field label="Restringir a empresa de la solicitud">
        <div className="flex items-center gap-2">
          <Switch
            checked={assignment.companyScoped ?? false}
            onCheckedChange={(v) =>
              setAssignment({ ...assignment, companyScoped: v })
            }
          />
          <span className="text-xs text-text-muted">
            Solo crea tareas en la empresa del solicitante.
          </span>
        </div>
      </Field>

      <div>
        <p className="mb-1 text-xs font-medium text-text-secondary">
          Resultados posibles (outcomes)
        </p>
        <div className="space-y-1">
          {OUTCOME_OPTIONS.map((o) => (
            <label
              key={o.value}
              className="flex items-center gap-2 text-xs"
            >
              <input
                type="checkbox"
                checked={outcomes.includes(o.value)}
                onChange={() => toggleOutcome(o.value)}
              />
              {o.label}
              <code className="text-text-muted">{o.value}</code>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function SystemFields({
  node,
  onUpdate,
}: {
  node: WorkflowNodeData;
  onUpdate: (patch: Partial<WorkflowNode>) => void;
}) {
  const action: SystemAction = node.config?.systemAction ?? "NOOP";
  return (
    <div className="space-y-4 rounded-lg border border-border p-3">
      <Field label="Acción del sistema">
        <Select
          value={action}
          onValueChange={(v) => {
            const next = emptyConfig("SYSTEM");
            onUpdate({
              config: {
                ...next,
                systemAction: v as SystemAction,
                ...(v === "UPDATE_REQUEST_STATUS"
                  ? {
                      targetRequestStatus: "SUBMITTED",
                    }
                  : {}),
              },
            });
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="UPDATE_REQUEST_STATUS">
              Actualizar estado de la solicitud
            </SelectItem>
            <SelectItem value="NOOP">No hacer nada (NOOP)</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      {action === "UPDATE_REQUEST_STATUS" && (
        <Field label="Estado destino">
          <Select
            value={node.config?.targetRequestStatus ?? "SUBMITTED"}
            onValueChange={(v) =>
              onUpdate({
                config: {
                  ...node.config,
                  systemAction: "UPDATE_REQUEST_STATUS",
                  targetRequestStatus: v as RequestStatusTarget,
                },
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TARGET_STATUS_OPTIONS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
    </div>
  );
}

function EdgeEditor({
  edge,
  onUpdate,
  onDelete,
  readOnly,
}: {
  edge: WorkflowEdgeData;
  onUpdate: (patch: Partial<WorkflowEdgeData>) => void;
  onDelete: () => void;
  readOnly?: boolean;
}) {
  const isConditional = Boolean(edge.condition);
  const toggleCondition = () => {
    if (isConditional) {
      onUpdate({ condition: undefined });
    } else {
      const seed: ConditionExpression = {
        field: "request.type",
        operator: "EQUALS",
        value: "X",
      };
      onUpdate({ condition: { op: "AND", conditions: [seed] } });
    }
  };
  return (
    <div className="space-y-4">
      <Field label="Acción">
        <Input
          value={edge.action}
          disabled={readOnly}
          onChange={(e) =>
            onUpdate({ action: e.target.value as EdgeAction })
          }
        />
        <p className="mt-1 text-[10px] text-text-muted">
          BEGIN (START) · COMPLETE (SYSTEM) · EVALUATE (DECISION) · APPROVE/REJECT/… (HUMAN_TASK) · ver §2.2 del diseño.
        </p>
      </Field>
      <Field label="Prioridad">
        <Input
          type="number"
          value={edge.priority ?? 0}
          disabled={readOnly}
          onChange={(e) =>
            onUpdate({ priority: Number(e.target.value) || 0 })
          }
        />
        <p className="mt-1 text-[10px] text-text-muted">
          Mayor número = mayor prioridad. Para EVALUATE con varias aristas.
        </p>
      </Field>
      {!readOnly && (
        <div className="border-t border-border pt-3">
          <label className="mb-2 flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={isConditional}
              onChange={toggleCondition}
            />
            Arista condicional (EVALUATE)
          </label>
          {isConditional && edge.condition && (
            <ConditionBuilder
              value={edge.condition}
              onChange={(next) => onUpdate({ condition: next })}
            />
          )}
        </div>
      )}
      {!readOnly && (
        <Button variant="destructive" size="sm" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
          Eliminar arista
        </Button>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-text-secondary">{label}</Label>
      {children}
    </div>
  );
}
