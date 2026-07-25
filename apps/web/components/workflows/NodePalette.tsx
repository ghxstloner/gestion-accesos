"use client";

import { UserCheck, Cog, GitFork, Play, Square, Info } from "lucide-react";
import type { WorkflowNodeType } from "@/lib/workflow-types";
import { cn } from "@/lib/utils";

interface PaletteItem {
  type: WorkflowNodeType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  color: string;
}

const ITEMS: PaletteItem[] = [
  {
    type: "START",
    label: "Inicio",
    icon: Play,
    description: "Punto de entrada del flujo (máximo 1).",
    color: "text-emerald-700",
  },
  {
    type: "END",
    label: "Fin",
    icon: Square,
    description: "Cierre del flujo (mínimo 1).",
    color: "text-rose-700",
  },
  {
    type: "HUMAN_TASK",
    label: "Tarea humana",
    icon: UserCheck,
    description: "Revisión/aprobación por un rol o usuario.",
    color: "text-brand-700",
  },
  {
    type: "SYSTEM",
    label: "Acción sistema",
    icon: Cog,
    description: "Actualiza estado de la solicitud automáticamente.",
    color: "text-slate-700",
  },
  {
    type: "DECISION",
    label: "Decisión",
    icon: GitFork,
    description: "Bifurca según condiciones (EVALUATE).",
    color: "text-amber-700",
  },
];

/**
 * Paleta lateral que enumera los tipos de nodo arrastrables. El destino
 * (canvas) escucha el drop y procesa `data-workflow-node-type`. El DnD se
 * implementa con HTML5 nativo para no añadir dependencias.
 */
export function NodePalette({ readOnly = false }: { readOnly?: boolean }) {
  return (
    <aside className="flex w-56 shrink-0 flex-col gap-3 border-r border-border bg-surface p-4">
      <div>
        <h3 className="text-sm font-semibold text-text-primary">
          Tipos de nodo
        </h3>
        <p className="mt-0.5 text-xs text-text-muted">
          {readOnly
            ? "Modo solo lectura: no se puede editar."
            : "Arrastra al lienzo para añadirlos."}
        </p>
      </div>
      <ul className="space-y-2">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <li
              key={item.type}
              draggable={!readOnly}
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  "application/workflow-node-type",
                  item.type,
                );
                e.dataTransfer.effectAllowed = "move";
              }}
              className={cn(
                "flex cursor-grab items-start gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm shadow-sm",
                readOnly && "cursor-not-allowed opacity-60",
              )}
            >
              <Icon className={cn("mt-0.5 h-4 w-4", item.color)} />
              <div>
                <p className="font-medium text-text-primary">{item.label}</p>
                <p className="text-[11px] leading-tight text-text-muted">
                  {item.description}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto rounded-lg bg-background-subtle p-2 text-xs text-text-muted">
        <p className="flex items-center gap-1">
          <Info className="h-3 w-3" />
          Las posiciones se guardan al “Guardar borrador”.
        </p>
      </div>
    </aside>
  );
}
