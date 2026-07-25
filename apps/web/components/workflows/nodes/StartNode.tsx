"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Play } from "lucide-react";
import { type WorkflowNodeData } from "@/lib/workflow-mapping";
import { nodeBaseClass } from "./shared";

export function StartNode({ data, selected }: NodeProps) {
  const nodeData = data as WorkflowNodeData;
  return (
    <div
      className={nodeBaseClass({
        type: "start",
        selected: Boolean(selected),
        invalid: Boolean(nodeData._invalid),
      })}
    >
      <Handle type="source" position={Position.Right} />
      <div className="flex items-center gap-2">
        <Play className="h-4 w-4 text-emerald-600" />
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
            Inicio
          </p>
          <p className="truncate text-sm font-semibold text-text-primary">
            {nodeData.name}
          </p>
        </div>
      </div>
    </div>
  );
}
