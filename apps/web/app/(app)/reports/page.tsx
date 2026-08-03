"use client";

import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Calendar,
  Clock,
  FileText,
  TrendingUp,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/LoadingSkeletons";
import { Badge } from "@/components/shared/StatusBadge";
import { Input } from "@/components/ui/input";
import {
  useCredentialsByStatusReport,
  useCredentialsExpiringReport,
  useCustodyStatusReport,
  useAlertsBreakdownReport,
  useProductivityReport,
  useRequestsByCompanyReport,
  useRequestsByStatusReport,
  useRequestsByTypeReport,
  useReturnedRejectedReport,
  useSlaComplianceReport,
  useStageAverageTimeReport,
  type CompanyCount,
  type CredentialsExpiringReport,
  type CustodyStatusReport,
  type ProductivityRow,
  type ReportRange,
  type StageTimeRow,
  type StatusCount,
  type TypeCount,
  type AlertsBreakdownReport,
  type SlaReport,
  type ReasonOutcome,
} from "@/hooks/api-hooks";
import { formatDateTime } from "@/lib/constants";

/**
 * Operational reports landing — each aggregate report is rendered by its
 * own component, so React Hook rules are respected (hooks at the top of
 * the component, never inside callbacks).
 */
export default function ReportsPage() {
  const [range, setRange] = useState<ReportRange>({});
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reportes operativos"
        description="Agregados por solicitudes, credenciales, custodia, alertas, SLA y productividad."
      />

      <RangeFilter value={range} onChange={setRange} />

      <div className="grid gap-6 lg:grid-cols-2">
        <RequestsByStatusCard range={range} />
        <RequestsByTypeCard range={range} />
        <RequestsByCompanyCard range={range} />
        <StageAverageCard range={range} />
        <ReturnedRejectedCard range={range} />
        <CredentialsByStatusCard range={range} />
        <CredentialsExpiringCard range={range} />
        <CustodyCard />
        <AlertsCard />
        <SlaCard />
        <ProductivityCard range={range} />
      </div>
    </div>
  );
}

function RangeFilter({
  value,
  onChange,
}: {
  value: ReportRange;
  onChange: (next: ReportRange) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-surface-muted p-3 md:grid-cols-3">
      <Input
        type="date"
        placeholder="Desde"
        value={value.from ?? ""}
        onChange={(e) => onChange({ ...value, from: e.target.value })}
      />
      <Input
        type="date"
        placeholder="Hasta"
        value={value.to ?? ""}
        onChange={(e) => onChange({ ...value, to: e.target.value })}
      />
      <Input
        type="number"
        placeholder="Días para expiración"
        value={value.days ?? ""}
        onChange={(e) =>
          onChange({
            ...value,
            days: e.target.value ? Number(e.target.value) : undefined,
          })
        }
      />
    </div>
  );
}

interface ShellProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
}

function CardShell({
  title,
  icon: Icon,
  children,
}: ShellProps & { children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <header className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          <Icon className="h-4 w-4" />
        </span>
        <h2 className="text-sm font-semibold">{title}</h2>
      </header>
      {children}
    </section>
  );
}

function ReportState<T>({
  state,
  data,
  render,
}: {
  state: { isLoading: boolean; isError: boolean };
  data: T | undefined;
  render: (data: T) => React.ReactNode;
}) {
  if (state.isError) {
    return (
      <EmptyState icon={AlertTriangle} title="Error" description="No se pudo cargar el reporte." />
    );
  }
  if (state.isLoading || data === undefined) {
    return <PageSkeleton variant="dashboard" />;
  }
  return <>{render(data)}</>;
}

function CountList({ items }: { items: { label: string; count: number }[] }) {
  if (items.length === 0) return <p className="text-xs text-muted-foreground">Sin datos.</p>;
  return (
    <ul className="space-y-1 text-xs">
      {items.slice(0, 20).map((item, i) => (
        <li
          key={`${item.label}-${i}`}
          className="flex justify-between"
        >
          <span className="truncate text-left">{item.label}</span>
          <span className="font-semibold">{item.count}</span>
        </li>
      ))}
    </ul>
  );
}

function BreakdownList({
  title,
  rows,
}: {
  title: string;
  rows: { scope?: string; severity?: string; status?: string; count: number }[];
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <ul className="mt-1 space-y-0.5">
        {rows.length === 0 ? (
          <li className="text-muted-foreground">—</li>
        ) : (
          rows.map((r, i) => (
            <li key={i} className="flex justify-between">
              <span>{r.scope ?? r.severity ?? r.status}</span>
              <strong>{r.count}</strong>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function RequestsByStatusCard({ range }: { range: ReportRange }) {
  const state = useRequestsByStatusReport(range);
  return (
    <CardShell title="Solicitudes por estado" icon={BarChart3}>
      <ReportState<StatusCount[]>
        state={state}
        data={state.data}
        render={(items) => (
          <CountList
            items={items.map((x) => ({ label: x.status, count: x.count }))}
          />
        )}
      />
    </CardShell>
  );
}

function RequestsByTypeCard({ range }: { range: ReportRange }) {
  const state = useRequestsByTypeReport(range);
  return (
    <CardShell title="Solicitudes por tipo" icon={FileText}>
      <ReportState<TypeCount[]>
        state={state}
        data={state.data}
        render={(items) => (
          <CountList
            items={items.map((x) => ({
              label: `${x.name} (${x.code})`,
              count: x.count,
            }))}
          />
        )}
      />
    </CardShell>
  );
}

function RequestsByCompanyCard({ range }: { range: ReportRange }) {
  const state = useRequestsByCompanyReport(range);
  return (
    <CardShell title="Solicitudes por empresa (top 20)" icon={TrendingUp}>
      <ReportState<CompanyCount[]>
        state={state}
        data={state.data}
        render={(items) => (
          <CountList
            items={items.map((x) => ({ label: x.name, count: x.count }))}
          />
        )}
      />
    </CardShell>
  );
}

function StageAverageCard({ range }: { range: ReportRange }) {
  const state = useStageAverageTimeReport(range);
  return (
    <CardShell title="Tiempo medio por etapa" icon={Clock}>
      <ReportState<StageTimeRow[]>
        state={state}
        data={state.data}
        render={(items) => (
          <CountList
            items={items.map((x) => ({
              label: `${x.taskType} (${x.count})`,
              count: Number((x.avgMs / 86_400_000).toFixed(2)),
            }))}
          />
        )}
      />
    </CardShell>
  );
}

function ReturnedRejectedCard({ range }: { range: ReportRange }) {
  const state = useReturnedRejectedReport(range);
  return (
    <CardShell title="Devoluciones / Rechazos por motivo" icon={Activity}>
      <ReportState<ReasonOutcome[]>
        state={state}
        data={state.data}
        render={(items) => (
          <CountList
            items={items.map((x) => ({
              label: `${x.outcome}: ${x.reason.name}`,
              count: x.count,
            }))}
          />
        )}
      />
    </CardShell>
  );
}

function CredentialsByStatusCard({ range }: { range: ReportRange }) {
  const state = useCredentialsByStatusReport(range);
  return (
    <CardShell title="Credenciales por estado" icon={BarChart3}>
      <ReportState<StatusCount[]>
        state={state}
        data={state.data}
        render={(items) => (
          <CountList
            items={items.map((x) => ({ label: x.status, count: x.count }))}
          />
        )}
      />
    </CardShell>
  );
}

function CredentialsExpiringCard({ range }: { range: ReportRange }) {
  const state = useCredentialsExpiringReport(range);
  return (
    <CardShell title="Credenciales próximas a expirar" icon={Calendar}>
      <ReportState<CredentialsExpiringReport>
        state={state}
        data={state.data}
        render={(d) => (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Total: <strong>{d.total}</strong> · Horizonte: {formatDateTime(d.horizon)}
            </p>
            {d.items.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Sin credenciales próximas a expirar.
              </p>
            ) : (
              <ul className="space-y-1 text-xs">
                {d.items.slice(0, 10).map((c) => (
                  <li
                    key={c.id}
                    className="flex justify-between rounded border border-border p-2"
                  >
                    <span>
                      <strong>{c.credentialNumber}</strong> · {c.holderName ?? "—"}
                    </span>
                    <span className="text-muted-foreground">
                      {formatDateTime(c.expiresAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      />
    </CardShell>
  );
}

function CustodyCard() {
  const state = useCustodyStatusReport();
  return (
    <CardShell title="Custodia activa / atrasada" icon={Clock}>
      <ReportState<CustodyStatusReport>
        state={state}
        data={state.data}
        render={(d) => (
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded border border-border p-2">
              <p className="text-[10px] uppercase text-muted-foreground">Activas</p>
              <p className="text-xl font-semibold">{d.active.total}</p>
            </div>
            <div className="rounded border border-danger-200 bg-danger-50 p-2">
              <p className="text-[10px] uppercase text-muted-foreground">Atrasadas</p>
              <p className="text-xl font-semibold text-danger-700">{d.overdue.total}</p>
            </div>
          </div>
        )}
      />
    </CardShell>
  );
}

function AlertsCard() {
  const state = useAlertsBreakdownReport();
  return (
    <CardShell title="Alertas por dimensión" icon={AlertTriangle}>
      <ReportState<AlertsBreakdownReport>
        state={state}
        data={state.data}
        render={(d) => (
          <div className="space-y-3 text-xs">
            <BreakdownList title="Scope" rows={d.byScope} />
            <BreakdownList title="Severidad" rows={d.bySeverity} />
            <BreakdownList title="Estado" rows={d.byStatus} />
          </div>
        )}
      />
    </CardShell>
  );
}

function SlaCard() {
  const state = useSlaComplianceReport();
  return (
    <CardShell title="Cumplimiento de SLA" icon={Clock}>
      <ReportState<SlaReport>
        state={state}
        data={state.data}
        render={(d) => (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Tareas abiertas:</span>
              <strong>{d.totalOpen}</strong>
            </div>
            <div className="flex justify-between">
              <span>Atrasadas:</span>
              <strong className="text-danger-700">{d.overdue}</strong>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                tone={
                  d.compliancePct >= 80
                    ? "success"
                    : d.compliancePct >= 50
                      ? "warning"
                      : "danger"
                }
              >
                {d.compliancePct}% cumplimiento
              </Badge>
            </div>
          </div>
        )}
      />
    </CardShell>
  );
}

function ProductivityCard({ range }: { range: ReportRange }) {
  const state = useProductivityReport(range);
  return (
    <CardShell title="Productividad por emisor" icon={Users}>
      <ReportState<ProductivityRow[]>
        state={state}
        data={state.data}
        render={(items) => (
          <CountList
            items={items.map((x) => ({
              label: `${x.name} (producidas ${x.produced} / entregadas ${x.delivered})`,
              count: x.produced,
            }))}
          />
        )}
      />
    </CardShell>
  );
}
