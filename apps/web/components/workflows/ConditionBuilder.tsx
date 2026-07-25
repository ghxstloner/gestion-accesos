"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CONDITION_FIELD_PREFIXES,
  type AtomicConditionOperator,
  type ConditionExpression,
} from "@/lib/workflow-types";

const OPERATOR_OPTIONS: { value: AtomicConditionOperator; label: string }[] = [
  { value: "EQUALS", label: "es igual a" },
  { value: "NOT_EQUALS", label: "no es igual a" },
  { value: "IN", label: "está en" },
  { value: "NOT_IN", label: "no está en" },
  { value: "GREATER_THAN", label: "mayor que" },
  { value: "GREATER_THAN_OR_EQUAL", label: "mayor o igual que" },
  { value: "LESS_THAN", label: "menor que" },
  { value: "LESS_THAN_OR_EQUAL", label: "menor o igual que" },
  { value: "EXISTS", label: "existe" },
  { value: "NOT_EXISTS", label: "no existe" },
];

/**
 * Editor visual anidado de ConditionExpression. Solo produce structured data:
 * NO permite texto libre ni JavaScript. Soporta 3 niveles típicos:
 * - atomic (field+operator+value)
 * - NOT (un sub-nodo)
 * - AND/OR (n sub-nodos)
 */
export function ConditionBuilder({
  value,
  onChange,
  onRemove,
}: {
  value: ConditionExpression;
  onChange: (next: ConditionExpression) => void;
  onRemove?: () => void;
}) {
  if ("op" in value) {
    if (value.op === "AND" || value.op === "OR") {
      return (
        <CombinatorNode
          value={value}
          onChange={onChange}
          onRemove={onRemove}
        />
      );
    }
    // value.op === "NOT"
    return (
      <NotNode
        value={value as Extract<ConditionExpression, { op: "NOT" }>}
        onChange={onChange}
        onRemove={onRemove}
      />
    );
  }
  return (
    <AtomicNode value={value} onChange={onChange} onRemove={onRemove} />
  );
}

function AtomicNode({
  value,
  onChange,
  onRemove,
}: {
  value: Extract<ConditionExpression, { field: string }>;
  onChange: (next: ConditionExpression) => void;
  onRemove?: () => void;
}) {
  const op = value.operator;
  const needsValue = op !== "EXISTS" && op !== "NOT_EXISTS";
  const isCollection = op === "IN" || op === "NOT_IN";
  const valueAsString = Array.isArray(value.value)
    ? value.value.join(",")
    : typeof value.value === "string"
      ? value.value
      : JSON.stringify(value.value ?? "");

  return (
    <div className="rounded-lg border border-border bg-white p-3 shadow-sm">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Campo</Label>
          <Input
            value={value.field}
            onChange={(e) =>
              onChange({ ...value, field: e.target.value })
            }
            placeholder="ej: request.priority"
            className="font-mono text-xs"
          />
          <p className="mt-1 text-[10px] text-text-muted">
            Prefijos válidos:{" "}
            {[...CONDITION_FIELD_PREFIXES].map((p) => p.replace(".", "")).join(", ")}
          </p>
        </div>
        <div>
          <Label className="text-xs">Operador</Label>
          <Select
            value={op}
            onValueChange={(v) =>
              onChange({ ...value, operator: v as AtomicConditionOperator })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPERATOR_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {needsValue && (
          <div className="sm:col-span-2">
            <Label className="text-xs">
              Valor
              {isCollection && (
                <span className="font-normal text-text-muted">
                  {" "}
                  (separa por comas)
                </span>
              )}
            </Label>
            <Input
              value={valueAsString}
              onChange={(e) => {
                const raw = e.target.value;
                if (isCollection) {
                  const arr = raw
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean);
                  onChange({ ...value, value: arr });
                } else {
                  // intento de número primero
                  const num = Number(raw);
                  onChange({
                    ...value,
                    value: raw !== "" && !isNaN(num) ? num : raw,
                  });
                }
              }}
            />
          </div>
        )}
      </div>
      {onRemove && (
        <div className="mt-2 text-right">
          <Button size="sm" variant="destructive" onClick={onRemove}>
            <Trash2 className="h-3 w-3" />
            Quitar
          </Button>
        </div>
      )}
    </div>
  );
}

function NotNode({
  value,
  onChange,
  onRemove,
}: {
  value: Extract<ConditionExpression, { op: "NOT" }>;
  onChange: (next: ConditionExpression) => void;
  onRemove?: () => void;
}) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-bold uppercase text-amber-700">NOT</p>
        {onRemove && (
          <Button size="sm" variant="destructive" onClick={onRemove}>
            Quitar
          </Button>
        )}
      </div>
      <ConditionBuilder
        value={value.condition}
        onChange={(next) => onChange({ op: "NOT", condition: next })}
      />
    </div>
  );
}

function CombinatorNode({
  value,
  onChange,
  onRemove,
}: {
  value: Extract<ConditionExpression, { op: "AND" | "OR" }>;
  onChange: (next: ConditionExpression) => void;
  onRemove?: () => void;
}) {
  const items = value.conditions;
  function addAtomic() {
    onChange({
      ...value,
      conditions: [
        ...items,
        { field: "request.type", operator: "EQUALS", value: "X" },
      ],
    });
  }
  function addCombinator(op: "AND" | "OR") {
    onChange({
      ...value,
      conditions: [
        ...items,
        {
          op,
          conditions: [
            { field: "request.type", operator: "EQUALS", value: "X" },
          ],
        },
      ],
    });
  }
  function addNot() {
    onChange({
      ...value,
      conditions: [
        ...items,
        {
          op: "NOT",
          condition: {
            field: "request.type",
            operator: "EQUALS",
            value: "X",
          },
        },
      ],
    });
  }
  function update(idx: number, next: ConditionExpression) {
    const copy = [...items];
    copy[idx] = next;
    onChange({ ...value, conditions: copy });
  }
  function remove(idx: number) {
    const copy = items.filter((_, i) => i !== idx);
    onChange({ ...value, conditions: copy });
  }
  return (
    <div className="rounded-lg border border-brand-200 bg-brand-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <Select
          value={value.op}
          onValueChange={(v) =>
            onChange({
              ...value,
              op: v as "AND" | "OR",
            })
          }
        >
          <SelectTrigger className="h-7 w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AND">AND</SelectItem>
            <SelectItem value="OR">OR</SelectItem>
          </SelectContent>
        </Select>
        {onRemove && (
          <Button size="sm" variant="destructive" onClick={onRemove}>
            Quitar
          </Button>
        )}
      </div>
      <div className="space-y-2">
        {items.map((c, i) => (
          <ConditionBuilder
            key={i}
            value={c}
            onChange={(next) => update(i, next)}
            onRemove={() => remove(i)}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={addAtomic}>
          <Plus className="h-3 w-3" />
          Condición
        </Button>
        <Button size="sm" variant="outline" onClick={() => addCombinator("AND")}>
          <Plus className="h-3 w-3" />
          AND
        </Button>
        <Button size="sm" variant="outline" onClick={() => addCombinator("OR")}>
          <Plus className="h-3 w-3" />
          OR
        </Button>
        <Button size="sm" variant="outline" onClick={addNot}>
          <Plus className="h-3 w-3" />
          NOT
        </Button>
      </div>
    </div>
  );
}
