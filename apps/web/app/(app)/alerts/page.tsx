"use client";

import { useState, useMemo } from "react";
import { CheckCircle2, Eye, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Badge } from "@/components/shared/StatusBadge";
import { PageSkeleton } from "@/components/shared/LoadingSkeletons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/constants";
import {
  useAlertsQuery,
  useAcknowledgeAlertMutation,
  useResolveAlertMutation,
  type OperationalAlertResponse,
  type AlertSeverity,
  type AlertStatus,
  type AlertRuleScope,
} from "@/hooks/api-hooks";

const SEVERITY_FILTERS: AlertSeverity[] = ["INFO", "WARN", "CRITICAL"];
const STATUS_FILTERS: AlertStatus[] = ["OPEN", "ACKNOWLEDGED", "RESOLVED"];
const SCOPE_FILTERS: AlertRuleScope[] = [
  "CREDENTIAL",
  "CUSTODY",
  "WORKFLOW",
  "REVIEW",
  "JOB",
];

function severityTone(s: AlertSeverity) {
  if (s === "CRITICAL") return "danger";
  if (s === "WARN") return "warning";
  return "neutral";
}

function statusTone(s: AlertStatus) {
  if (s === "RESOLVED") return "success";
  if (s === "ACKNOWLEDGED") return "neutral";
  return "warning";
}

function scopeLabel(s: string): string {
  const m: Record<string, string> = {
    credential: "Credencial",
    custody: "Custodia",
    workflow_task: "Tarea de flujo",
    review_task: "Tarea de revisión",
    scheduled_job: "Job del sistema",
  };
  return m[s] ?? s;
}

export default function AlertsPage() {
  const [severity, setSeverity] = useState<AlertSeverity | "ALL">("ALL");
  const [status, setStatus] = useState<AlertStatus | "ALL">("ALL");
  const [scope, setScope] = useState<AlertRuleScope | "ALL">("ALL");

  const { data, isLoading, error } = useAlertsQuery({
    severity: severity === "ALL" ? undefined : severity,
    status: status === "ALL" ? undefined : status,
    scope: scope === "ALL" ? undefined : scope,
    page: 1,
    limit: 200,
  });
  const ack = useAcknowledgeAlertMutation();
  const resolve = useResolveAlertMutation();

  const columns: Column<OperationalAlertResponse>[] = useMemo(
    () => [
      {
        key: "severity",
        header: "Severidad",
        cell: (a: OperationalAlertResponse) => (
          <Badge tone={severityTone(a.severity)}>{a.severity}</Badge>
        ),
      },
      {
        key: "title",
        header: "Alerta",
        cell: (a: OperationalAlertResponse) => (
          <div className="max-w-md">
            <p className="font-medium leading-tight">{a.title}</p>
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {a.message}
            </p>
          </div>
        ),
      },
      {
        key: "entityType",
        header: "Tipo",
        cell: (a: OperationalAlertResponse) => (
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            {scopeLabel(a.entityType)}
          </span>
        ),
      },
      {
        key: "observedAt",
        header: "Observada",
        cell: (a: OperationalAlertResponse) => (
          <span className="text-xs">{formatDate(a.observedAt)}</span>
        ),
      },
      {
        key: "status",
        header: "Estado",
        cell: (a: OperationalAlertResponse) => (
          <Badge tone={statusTone(a.status)}>{a.status}</Badge>
        ),
      },
      {
        key: "actions",
        header: "",
        cell: (a: OperationalAlertResponse) => (
          <div className="text-right">
            <DropdownMenu>
              <DropdownMenuTrigger className="rounded p-1 hover:bg-muted">
                <Eye className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  disabled={a.status !== "OPEN" || ack.isPending}
                  onSelect={() => ack.mutate(a.id)}
                >
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Reconocer
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={a.status === "RESOLVED" || resolve.isPending}
                  onSelect={() => resolve.mutate(a.id)}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Resolver
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [ack, resolve],
  );

  const items = useMemo(() => data?.items ?? [], [data]);
  const counts = useMemo(() => {
    const open = items.filter((a) => a.status === "OPEN").length;
    const ackd = items.filter((a) => a.status === "ACKNOWLEDGED").length;
    const resolved = items.filter((a) => a.status === "RESOLVED").length;
    const critical = items.filter((a) => a.severity === "CRITICAL").length;
    return { open, ackd, resolved, critical };
  }, [items]);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Alertas operativas"
        description="Observaciones generadas por las reglas programadas: credenciales por vencer, vencidas, custodia en atraso, tareas fuera de SLA, jobs fallidos."
      />

      {/* Summary tiles */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile
          label="Abiertas"
          value={counts.open}
          tone="warning"
        />
        <SummaryTile
          label="Reconocidas"
          value={counts.ackd}
          tone="neutral"
        />
        <SummaryTile
          label="Resueltas"
          value={counts.resolved}
          tone="success"
        />
        <SummaryTile
          label="Críticas"
          value={counts.critical}
          tone="danger"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select
          value={scope}
          onValueChange={(v) => setScope(v as AlertRuleScope | "ALL")}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Alcance" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los alcances</SelectItem>
            {SCOPE_FILTERS.map((s) => (
              <SelectItem key={s} value={s}>
                {scopeLabel(s.toLowerCase())}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={severity}
          onValueChange={(v) => setSeverity(v as AlertSeverity | "ALL")}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Severidad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas</SelectItem>
            {SEVERITY_FILTERS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as AlertStatus | "ALL")}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            {STATUS_FILTERS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <PageSkeleton />
      ) : error ? (
        <p className="text-sm text-destructive">
          Error al cargar alertas: {(error as Error).message}
        </p>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card p-10 text-center text-muted-foreground">
          No hay alertas activas para los filtros seleccionados.
        </div>
      ) : (
        <DataTable columns={columns} data={items} />
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "warning" | "neutral" | "success" | "danger";
}) {
  const toneClasses: Record<typeof tone, string> = {
    warning: "border-amber-300 bg-amber-50 text-amber-900",
    neutral: "border-slate-300 bg-slate-50 text-slate-900",
    success: "border-emerald-300 bg-emerald-50 text-emerald-900",
    danger: "border-red-300 bg-red-50 text-red-900",
  };
  return (
    <div className={`rounded-lg border p-4 ${toneClasses[tone]}`}>
      <p className="text-xs uppercase tracking-wider opacity-70">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
    </div>
  );
}
