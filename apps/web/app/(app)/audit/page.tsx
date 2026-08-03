"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Eye, Filter, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  DataTable,
  type Column,
} from "@/components/shared/DataTable";
import { Badge } from "@/components/shared/StatusBadge";
import { PageSkeleton } from "@/components/shared/LoadingSkeletons";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatDateTime } from "@/lib/constants";
import {
  useAuditAdvancedQueryQuery,
  useAuditEventDetailQuery,
  useAuditExportCsvMutation,
  type AuditEventDetailResponse,
  type AuditQueryFilters,
} from "@/hooks/api-hooks";

/**
 * Operational audit page: filtered table, paginated, with side-by-side
 * previous/new payload diff drawer and CSV export. No synthetic data —
 * every row comes from the read-only /audit/query endpoint.
 */
const ACTION_OPTIONS = [
  { value: "", label: "Todas las acciones" },
  { value: "create", label: "Crear" },
  { value: "update", label: "Actualizar" },
  { value: "delete", label: "Eliminar" },
  { value: "export", label: "Exportar" },
];
const AGG_OPTIONS = [
  { value: "", label: "Todos los tipos" },
  { value: "request", label: "Solicitudes" },
  { value: "credential", label: "Credenciales" },
  { value: "custody", label: "Custodia" },
  { value: "user", label: "Usuarios" },
  { value: "company", label: "Empresas" },
  { value: "workflow", label: "Flujos" },
];
const RESULT_OPTIONS = [
  { value: "", label: "Todos los resultados" },
  { value: "SUCCESS", label: "Éxito" },
  { value: "FAILURE", label: "Fallo" },
];

const PAGE_SIZE = 20;

function aggTypeTone(s: string) {
  if (s === "credential" || s === "custody") return "info" as const;
  if (s === "request" || s === "workflow") return "brand" as const;
  return "neutral" as const;
}

function aggTypeLabel(s: string): string {
  const m: Record<string, string> = {
    request: "Solicitud",
    credential: "Credencial",
    custody: "Custodia",
    user: "Usuario",
    company: "Empresa",
    workflow: "Flujo",
    audit: "Auditoría",
  };
  return m[s] ?? s;
}

function relatedLink(a: AuditEventDetailResponse) {
  if (!a.aggregateId) return null;
  const id = a.aggregateId;
  switch (a.aggregateType) {
    case "request":
      return `/requests/${id}`;
    case "credential":
      return `/credentials/${id}`;
    case "user":
      return `/users/${id}`;
    case "company":
      return `/companies/${id}`;
    case "workflow":
      return `/workflows/${id}`;
    default:
      return null;
  }
}

export default function AuditPage() {
  const [filters, setFilters] = useState<AuditQueryFilters>({ page: 1, pageSize: PAGE_SIZE });
  const [detailId, setDetailId] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const { data, isLoading, isError, refetch } = useAuditAdvancedQueryQuery(filters);
  const exportMutation = useAuditExportCsvMutation();
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const page = filters.page ?? 1;
  const pageCount = Math.max(1, Math.ceil(total / (filters.pageSize ?? PAGE_SIZE)));

  const update = (patch: Partial<AuditQueryFilters>) =>
    setFilters((f) => ({ ...f, ...patch, page: 1 }));

  const columns: Column<AuditEventDetailResponse>[] = useMemo(
    () => [
      {
        key: "occurredAt",
        header: "Fecha",
        cell: (a) => (
          <span className="text-xs text-muted-foreground">
            {formatDateTime(a.occurredAt)}
          </span>
        ),
      },
      {
        key: "actorUserId",
        header: "Actor",
        cell: (a) => (
          <span className="text-xs">
            {a.actorUserId ? (
              <Link
                href={`/users/${a.actorUserId}`}
                className="text-brand-700 hover:underline"
              >
                {a.actorUserId.slice(0, 8)}…
              </Link>
            ) : (
              "Sistema"
            )}
          </span>
        ),
      },
      {
        key: "action",
        header: "Acción",
        cell: (a) => (
          <Badge tone={a.action.endsWith(".failure") ? "danger" : "neutral"}>
            {a.action}
          </Badge>
        ),
      },
      {
        key: "aggregateType",
        header: "Tipo",
        cell: (a) => (
          <Badge tone={aggTypeTone(a.aggregateType)}>
            {aggTypeLabel(a.aggregateType)}
          </Badge>
        ),
      },
      {
        key: "aggregateId",
        header: "Entity ID",
        cell: (a) => {
          const link = relatedLink(a);
          return a.aggregateId && link ? (
            <Link
              href={link}
              className="text-xs font-medium text-brand-700 hover:underline"
            >
              {a.aggregateId.slice(0, 8)}…
            </Link>
          ) : a.aggregateId ? (
            <span className="text-xs text-muted-foreground">
              {a.aggregateId.slice(0, 8)}…
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          );
        },
      },
      {
        key: "correlationId",
        header: "Correlación",
        cell: (a) => (
          <span className="font-mono text-[10px] text-muted-foreground">
            {a.correlationId ? a.correlationId.slice(0, 8) : "—"}
          </span>
        ),
      },
      {
        key: "actions",
        header: "",
        cell: (a) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDetailId(a.id)}
            aria-label="Ver detalle"
          >
            <Eye className="h-4 w-4" />
          </Button>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Auditoría"
        description="Registro inmutable de eventos: filtros avanzados, detalle con diff y exportación CSV."
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Refrescar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvanced((v) => !v)}
            >
              <Filter className="mr-2 h-4 w-4" />
              Filtros avanzados
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() =>
                exportMutation.mutate(filters, {
                  onSuccess: (blob) => {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `audit-${new Date()
                      .toISOString()
                      .slice(0, 19)}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  },
                })
              }
              disabled={exportMutation.isPending}
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <Select
          value={filters.action ?? ""}
          onValueChange={(v) => update({ action: v || undefined })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Acción" />
          </SelectTrigger>
          <SelectContent>
            {ACTION_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.aggregateType ?? ""}
          onValueChange={(v) => update({ aggregateType: v || undefined })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Tipo de entidad" />
          </SelectTrigger>
          <SelectContent>
            {AGG_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.result ?? ""}
          onValueChange={(v) => update({ result: (v || undefined) as AuditQueryFilters["result"] })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Resultado" />
          </SelectTrigger>
          <SelectContent>
            {RESULT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Usuario (id)"
          value={filters.actorUserId ?? ""}
          onChange={(e) => update({ actorUserId: e.target.value || undefined })}
        />
        <Input
          placeholder="Correlation ID"
          value={filters.correlationId ?? ""}
          onChange={(e) =>
            update({ correlationId: e.target.value || undefined })
          }
        />
      </div>

      {showAdvanced && (
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-surface-muted p-3 md:grid-cols-2">
          <Input
            type="datetime-local"
            placeholder="Desde"
            value={filters.from ? filters.from.slice(0, 16) : ""}
            onChange={(e) =>
              update({ from: e.target.value ? new Date(e.target.value).toISOString() : undefined })
            }
          />
          <Input
            type="datetime-local"
            placeholder="Hasta"
            value={filters.to ? filters.to.slice(0, 16) : ""}
            onChange={(e) =>
              update({ to: e.target.value ? new Date(e.target.value).toISOString() : undefined })
            }
          />
          <Input
            placeholder="Entity ID"
            value={filters.aggregateId ?? ""}
            onChange={(e) => update({ aggregateId: e.target.value || undefined })}
          />
          <Input
            placeholder="Empresa (id)"
            value={filters.actorCompanyId ?? ""}
            onChange={(e) =>
              update({ actorCompanyId: e.target.value || undefined })
            }
          />
        </div>
      )}

      {isError ? (
        <EmptyState
          icon={Filter}
          title="Error al cargar auditoría"
          description="Reintenta o ajusta los filtros."
        />
      ) : isLoading ? (
        <PageSkeleton variant="table" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Filter}
          title="Sin eventos"
          description="No hay eventos que coincidan con los filtros seleccionados."
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={items}
          />
          <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
            <span>
              Mostrando {(page - 1) * (filters.pageSize ?? PAGE_SIZE) + 1}–
              {Math.min(page * (filters.pageSize ?? PAGE_SIZE), total)} de {total}
            </span>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setFilters((f) => ({ ...f, page: page - 1 }))}
              >
                Anterior
              </Button>
              <span className="flex h-9 items-center px-3 text-xs">
                Página {page} de {pageCount}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= pageCount}
                onClick={() => setFilters((f) => ({ ...f, page: page + 1 }))}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </>
      )}

      <AuditDetailDrawer id={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}

function AuditDetailDrawer({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}) {
  const { data, isLoading } = useAuditEventDetailQuery(id);
  return (
    <Sheet open={Boolean(id)} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Detalle de evento de auditoría</SheetTitle>
        </SheetHeader>
        {!id || isLoading ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            Cargando…
          </div>
        ) : data ? (
          <div className="space-y-4 px-4">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Field label="Acción" value={data.action} />
              <Field label="Tipo" value={aggTypeLabel(data.aggregateType)} />
              <Field label="Entity ID" value={data.aggregateId ?? "—"} />
              <Field
                label="Fecha"
                value={formatDateTime(data.occurredAt)}
              />
              <Field label="IP" value={data.ipAddress ?? "—"} />
              <Field
                label="Correlación"
                value={data.correlationId ?? "—"}
              />
            </div>
            <PayloadDiff
              title="Estado anterior"
              payload={data.previousData}
            />
            <PayloadDiff title="Estado nuevo" payload={data.newData} />
            <PayloadDiff title="Metadatos" payload={data.metadata} />
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            Evento no encontrado.
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

function PayloadDiff({
  title,
  payload,
}: {
  title: string;
  payload: Record<string, unknown> | null;
}) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <pre className="max-h-48 overflow-auto rounded-md bg-surface-muted p-2 text-[10px]">
        {payload ? JSON.stringify(payload, null, 2) : "—"}
      </pre>
    </div>
  );
}
