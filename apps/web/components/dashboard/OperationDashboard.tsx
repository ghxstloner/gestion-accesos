"use client";

import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock,
  IdCard,
  Lock,
  RotateCcw,
} from "lucide-react";
import {
  PageHeader,
  StatCard,
  DetailSection,
} from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/LoadingSkeletons";
import { Badge } from "@/components/shared/StatusBadge";
import { formatDateTime } from "@/lib/constants";
import { useDashboardSummaryQuery } from "@/hooks/api-hooks";

/**
 * Operation dashboard driven by the single aggregated endpoint
 * `GET /dashboard/summary`. The server enforces the actor's scope
 * (GLOBAL/COMPANY/OWN); this component only renders what the backend
 * returns — no client-side filtering of operational numbers.
 */
export interface OperationDashboardProps {
  /** Title shown in the page header. */
  title: string;
  /** Subtitle shown under the title. */
  description?: string;
  /** Optional header actions (e.g. "new request" CTA for admins). */
  actions?: React.ReactNode;
  /** Near-expiry window in days (default = server default). */
  nearExpiryDays?: number;
  /** Brief call-to-action cards in the bottom quick-access row. */
  quickAccess?: { label: string; href: string; icon: React.ComponentType<{ className?: string }> }[];
}

export function OperationDashboard({
  title,
  description,
  actions,
  nearExpiryDays,
  quickAccess,
}: OperationDashboardProps) {
  const { data, isLoading, isError, refetch } = useDashboardSummaryQuery(
    nearExpiryDays,
  );

  if (isLoading) return <PageSkeleton variant="dashboard" />;
  if (isError || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title={title} description={description} actions={actions} />
        <EmptyState
          icon={AlertCircle}
          title="No se pudo cargar el dashboard"
          description="Reintente en unos segundos."
          action={
            <button
              type="button"
              onClick={() => refetch()}
              className="text-sm font-semibold text-brand-600"
            >
              Reintentar
            </button>
          }
        />
      </div>
    );
  }

  const isGlobal = data.scope === "GLOBAL";
  const empty =
    data.pendingRequests === 0 &&
    data.pendingIssuance === 0 &&
    data.nearExpiryCredentials === 0 &&
    data.overdueCustody === 0 &&
    data.criticalAlerts === 0 &&
    data.overdueSlaTasks === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={description}
        actions={
          <div className="flex items-center gap-3">
            <ScopeBadge scope={data.scope} />
            {actions}
          </div>
        }
      />

      {empty && (
        <EmptyState
          icon={CheckCircle2}
          title="Sin pendientes operativos"
          description="No hay solicitudes, emisiones, custodia, alertas ni tareas atrasadas en su scope."
        />
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard
          label="Solicitudes pendientes"
          value={data.pendingRequests}
          icon={ClipboardList}
          tone="warning"
        />
        <StatCard
          label="Credenciales en emisión"
          value={data.pendingIssuance}
          icon={IdCard}
          tone="brand"
        />
        <StatCard
          label={`Vencen en ${data.nearExpiryDays} días`}
          value={data.nearExpiryCredentials}
          icon={Clock}
          tone="info"
        />
        <StatCard
          label="Custodia atrasada"
          value={data.overdueCustody}
          icon={RotateCcw}
          tone="danger"
        />
        <StatCard
          label="Tareas SLA atrasadas"
          value={data.overdueSlaTasks}
          icon={Clock}
          tone="danger"
        />
        <StatCard
          label="Alertas críticas abiertas"
          value={data.criticalAlerts}
          icon={AlertCircle}
          tone={data.criticalAlerts > 0 ? "danger" : "success"}
        />
      </div>

      <DetailSection title="Actividad operativa reciente">
        {data.recentActivity.length === 0 ? (
          <EmptyState icon={RotateCcw} title="Sin actividad reciente" />
        ) : (
          <div className="space-y-1">
            {data.recentActivity.map((a) => (
              <Link
                key={a.id}
                href={`/audit?aggregateType=${encodeURIComponent(
                  a.aggregateType,
                )}&aggregateId=${encodeURIComponent(a.aggregateId ?? "")}`}
                className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-muted"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                  <RotateCcw className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-text-primary">
                    <span className="font-medium">
                      {a.actorUserId ?? "Sistema"}
                    </span>{" "}
                    {a.action.toLowerCase()}
                  </p>
                </div>
                <span className="text-xs text-text-muted">
                  {formatDateTime(a.occurredAt)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </DetailSection>

      {quickAccess && quickAccess.length > 0 && (
        <DetailSection title="Accesos rápidos">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {quickAccess.map((q) => (
              <Link key={q.href} href={q.href}>
                <div className="flex items-center gap-2 rounded-lg border border-border p-3 hover:border-brand-300 hover:bg-brand-50">
                  <q.icon className="h-4 w-4 text-brand-600" />
                  <span className="text-sm font-medium text-text-primary">
                    {q.label}
                  </span>
                  <ArrowRight className="ml-auto h-3.5 w-3.5 text-text-disabled" />
                </div>
              </Link>
            ))}
          </div>
        </DetailSection>
      )}

      {!isGlobal && (
        <p className="text-xs text-muted-foreground">
          <Lock className="mr-1 inline h-3 w-3" />
          Los datos están acotados a su empresa por el backend.
        </p>
      )}
    </div>
  );
}

/**
 * Visible company-scope indicator. Reflects the server-side scope returned
 * by `/dashboard/summary`. Used to make auth-scoping transparent in the UI.
 */
export function ScopeBadge({ scope }: { scope: "GLOBAL" | "COMPANY" | "OWN" }) {
  const tone =
    scope === "GLOBAL" ? "info" : scope === "COMPANY" ? "brand" : "neutral";
  const label =
    scope === "GLOBAL"
      ? "Scope: Global"
      : scope === "COMPANY"
        ? "Scope: Empresa"
        : "Scope: Personal";
  return (
    <Badge tone={tone} className="hidden sm:inline-flex">
      {label}
    </Badge>
  );
}
