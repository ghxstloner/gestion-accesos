"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Square } from "lucide-react";
import { type WorkflowNodeData } from "@/lib/workflow-mapping";
import { nodeBaseClass } from "./shared";

export function EndNode({ data, selected }: NodeProps) {
  const nodeData = data as WorkflowNodeData;
  return (
    <div
      className={nodeBaseClass({
        type: "end",
        selected: Boolean(selected),
        invalid: Boolean(nodeData._invalid),
      })}
    >
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-2">
        <Square className="h-4 w-4 text-rose-600" />
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700">
            Fin
          </p>
          <p className="truncate text-sm font-semibold text-text-primary">
            {nodeData.name}
          </p>
        </div>
      </div>
    </div>
  );
}
