"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { GitFork } from "lucide-react";
import { type WorkflowNodeData } from "@/lib/workflow-mapping";
import { nodeBaseClass } from "./shared";

export function DecisionNode({ data, selected }: NodeProps) {
  const nodeData = data as WorkflowNodeData;
  return (
    <div
      className={nodeBaseClass({
        type: "decision",
        selected: Boolean(selected),
        invalid: Boolean(nodeData._invalid),
      })}
    >
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-2">
        <GitFork className="h-4 w-4 text-amber-600" />
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
            Decisión
          </p>
          <p className="truncate text-sm font-semibold text-text-primary">
            {nodeData.name}
          </p>
        </div>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
