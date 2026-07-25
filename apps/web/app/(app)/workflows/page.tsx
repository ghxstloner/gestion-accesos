"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Workflow as WorkflowIcon, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/LoadingSkeletons";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWorkflowDefinitionsQuery } from "@/hooks/workflow-hooks";
import { formatDate } from "@/lib/constants";
import type {
  WorkflowStatus,
  WorkflowRequestType,
} from "@/lib/workflow-types";

interface ListRow {
  id: string;
  key: string;
  name: string;
  description: string;
  status: WorkflowStatus;
  requestType: WorkflowRequestType | null;
  updatedAt: string;
}

const STATUS_LABEL: Record<WorkflowStatus, string> = {
  DRAFT: "Borrador",
  PUBLISHED: "Publicado",
  RETIRED: "Retirado",
};

const STATUS_TONE: Record<
  WorkflowStatus,
  "neutral" | "info" | "warning" | "success" | "danger" | "brand"
> = {
  DRAFT: "warning",
  PUBLISHED: "success",
  RETIRED: "neutral",
};

const REQUEST_TYPE_LABEL: Record<WorkflowRequestType, string> = {
  NEW_PERSONNEL: "Persona nueva",
  TEMPORARY_PERSONNEL: "Persona temporal",
  VEHICLE: "Vehículo",
  EQUIPMENT: "Equipo",
};

export default function WorkflowsListPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<WorkflowStatus | "ALL">(
    "ALL",
  );
  const [page, setPage] = useState(1);

  const filters = useMemo(
    () => ({
      search: search.trim() || undefined,
      status: statusFilter === "ALL" ? undefined : statusFilter,
      page,
      pageSize: 20,
    }),
    [search, statusFilter, page],
  );

  const { data, isLoading, isError, error, isFetching } =
    useWorkflowDefinitionsQuery(filters);

  const rows: ListRow[] = (data?.items ?? []).map((d) => ({
    id: d.id,
    key: d.key,
    name: d.name,
    description: d.description ?? "",
    status: d.status as WorkflowStatus,
    requestType: d.requestType,
    updatedAt: d.updatedAt,
  }));

  const columns: Column<ListRow>[] = [
    {
      key: "name",
      header: "Nombre",
      sortable: true,
      sortValue: (r) => r.name,
      cell: (r) => (
        <div className="min-w-0">
          <Link
            href={`/workflows/${r.id}`}
            className="font-semibold text-brand-700 hover:underline"
          >
            {r.name}
          </Link>
          <p className="truncate text-xs text-text-muted">{r.description || "—"}</p>
        </div>
      ),
    },
    {
      key: "key",
      header: "Código",
      sortable: true,
      sortValue: (r) => r.key,
      cell: (r) => (
        <code className="rounded bg-background-subtle px-1.5 py-0.5 text-xs">
          {r.key}
        </code>
      ),
    },
    {
      key: "requestType",
      header: "Tipo de solicitud",
      cell: (r) =>
        r.requestType ? (
          <span className="text-sm">
            {REQUEST_TYPE_LABEL[r.requestType] ?? r.requestType}
          </span>
        ) : (
          <span className="text-sm text-text-muted">—</span>
        ),
    },
    {
      key: "status",
      header: "Estado",
      sortable: true,
      sortValue: (r) => r.status,
      cell: (r) => (
        <Badge tone={STATUS_TONE[r.status]}>
          {STATUS_LABEL[r.status]}
        </Badge>
      ),
    },
    {
      key: "updatedAt",
      header: "Actualizado",
      sortable: true,
      sortValue: (r) => r.updatedAt,
      cell: (r) => (
        <span className="text-sm text-text-muted">{formatDate(r.updatedAt)}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "1%",
      cell: (r) => (
        <Button asChild size="sm" variant="outline">
          <Link href={`/workflows/${r.id}`}>Abrir</Link>
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Flujos de trabajo"
        description="Diseña y publica los flujos de aprobación para cada tipo de solicitud."
        actions={
          <Button asChild>
            <Link href="/workflows/new">
              <Plus className="h-4 w-4" />
              Nuevo flujo
            </Link>
          </Button>
        }
      />

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar por nombre o código…"
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v as WorkflowStatus | "ALL");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los estados</SelectItem>
            <SelectItem value="DRAFT">Borrador</SelectItem>
            <SelectItem value="PUBLISHED">Publicado</SelectItem>
            <SelectItem value="RETIRED">Retirado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <PageSkeleton />
      ) : isError ? (
        <EmptyState
          icon={WorkflowIcon}
          title="No se pudieron cargar los flujos"
          description={
            (error as Error)?.message ?? "Intenta nuevamente en unos segundos."
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={WorkflowIcon}
          title="Aún no hay flujos de trabajo"
          description="Crea tu primer flujo para empezar a modelar las aprobaciones."
          action={
            <Button asChild>
              <Link href="/workflows/new">
                <Plus className="h-4 w-4" />
                Crear flujo
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={rows}
            pageSize={20}
            emptyTitle="Sin resultados"
            emptyDescription="Ajusta los filtros para ver más flujos."
          />
          {/* Paginación server-side */}
          {data && data.total > data.pageSize && (
            <div className="flex items-center justify-between text-sm">
              <p className="text-text-muted">
                Mostrando {(data.page - 1) * data.pageSize + 1}–
                {Math.min(data.page * data.pageSize, data.total)} de {data.total}
                {isFetching ? " · cargando…" : ""}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.page * data.pageSize >= data.total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
