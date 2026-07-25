"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Cog } from "lucide-react";
import { type WorkflowNodeData } from "@/lib/workflow-mapping";
import { nodeBaseClass } from "./shared";

export function SystemNode({ data, selected }: NodeProps) {
  const nodeData = data as WorkflowNodeData;
  const action = nodeData.config?.systemAction;
  const target = nodeData.config?.targetRequestStatus;
  return (
    <div
      className={nodeBaseClass({
        type: "system",
        selected: Boolean(selected),
        invalid: Boolean(nodeData._invalid),
      })}
    >
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-2">
        <Cog className="h-4 w-4 text-slate-600" />
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
            Sistema
          </p>
          <p className="truncate text-sm font-semibold text-text-primary">
            {nodeData.name}
          </p>
        </div>
      </div>
      <div className="mt-2 text-xs">
        {action === "UPDATE_REQUEST_STATUS" ? (
          <p className="text-text-muted">
            Estado →{" "}
            <span className="font-medium text-text-primary">{target ?? "—"}</span>
          </p>
        ) : (
          <p className="text-text-muted">Acción: sin cambios (NOOP)</p>
        )}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
