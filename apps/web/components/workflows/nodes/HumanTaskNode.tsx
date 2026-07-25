"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { UserCheck } from "lucide-react";
import { type WorkflowNodeData } from "@/lib/workflow-mapping";
import { nodeBaseClass } from "./shared";

const OUTCOME_LABEL: Record<string, string> = {
  APPROVE: "Aprobar",
  REJECT: "Rechazar",
  RETURN_FOR_CORRECTION: "Devolver",
  RESUBMIT: "Reenviar",
  CANCEL: "Cancelar",
  COMPLETE: "Completar",
};

const ROLE_LABEL: Record<string, string> = {
  SYSTEM_ADMIN: "Admin general",
  COMPANY_ADMIN: "Admin empresa",
  DOCUMENT_RECEIVER: "Receptor docs",
  ACCESS_DOCUMENTS_MANAGER: "Jefe docs",
  CARD_ISSUER: "Emisor carné",
  APPLICANT: "Solicitante",
};

export function HumanTaskNode({ data, selected }: NodeProps) {
  const nodeData = data as WorkflowNodeData;
  const outcomes = nodeData.config?.outcomes ?? [];
  const role = nodeData.assignment?.roleCode;
  const userId = nodeData.assignment?.userId;
  return (
    <div
      className={nodeBaseClass({
        type: "human",
        selected: Boolean(selected),
        invalid: Boolean(nodeData._invalid),
      })}
    >
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-2">
        <UserCheck className="h-4 w-4 text-brand-600" />
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-brand-700">
            Tarea humana
          </p>
          <p className="truncate text-sm font-semibold text-text-primary">
            {nodeData.name}
          </p>
        </div>
      </div>
      <div className="mt-2 space-y-1 text-xs">
        <p className="text-text-muted">
          {role && (ROLE_LABEL[role] ?? role)}
          {userId && ` · usuario ${userId.slice(0, 8)}…`}
          {!role && !userId && (
            <span className="text-danger">Sin asignación</span>
          )}
        </p>
        {outcomes.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {outcomes.map((o) => (
              <span
                key={o}
                className="rounded bg-background-subtle px-1.5 py-0.5 text-[10px]"
              >
                {OUTCOME_LABEL[o] ?? o}
              </span>
            ))}
          </div>
        )}
        {outcomes.length === 0 && (
          <p className="text-danger">Sin outcomes</p>
        )}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
