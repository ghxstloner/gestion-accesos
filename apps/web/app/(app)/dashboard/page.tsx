"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Building2,
  ClipboardList,
  FileCheck2,
  IdCard,
  Plus,
  Users,
} from "lucide-react";
import { useSgaStore, useCurrentUserData, useStoreHydrated } from "@/lib/store";
import { useRequestsQuery } from "@/hooks/api-workflow-hooks";
import { toAccessRequestSummary } from "@/lib/request-mapping";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { RequestTypeBadge } from "@/components/shared/RequestTypeBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/LoadingSkeletons";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/constants";
import { OperationDashboard } from "@/components/dashboard/OperationDashboard";

export default function DashboardPage() {
  const hydrated = useStoreHydrated();
  const role = useSgaStore((s) => s.currentUser?.role);
  const userData = useCurrentUserData();

  if (!hydrated) return <PageSkeleton variant="dashboard" />;
  if (!role || !userData) return null;

  switch (role) {
    case "ADMIN_GENERAL":
      return (
        <OperationDashboard
          title="Dashboard"
          description="Vista general del Sistema de Gestión de Accesos"
          quickAccess={[
            { label: "Empresas", href: "/companies", icon: Building2 },
            { label: "Usuarios", href: "/users", icon: Users },
            { label: "Solicitudes", href: "/requests", icon: ClipboardList },
            { label: "Revisión", href: "/reviews", icon: FileCheck2 },
            { label: "Emisión", href: "/issuance", icon: IdCard },
          ]}
        />
      );
    case "ADMIN_EMPRESA":
      return (
        <OperationDashboard
          title={`Panel — ${userData.firstName} ${userData.lastName}`}
          description="Los datos están acotados a su empresa por el backend."
          actions={
            <Link href="/requests/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nueva solicitud
              </Button>
            </Link>
          }
          quickAccess={[
            { label: "Mis solicitudes", href: "/requests", icon: ClipboardList },
            { label: "Nueva solicitud", href: "/requests/new", icon: Plus },
          ]}
        />
      );
    case "SOLICITANTE":
      return <SolicitanteDashboard />;
    case "REVISOR":
      return <RoleBandDashboard title="Bandeja de revisión" />;
    case "JEFE_DOCUMENTOS":
      return <RoleBandDashboard title="Aprobación de solicitudes" />;
    case "EMISOR_CARNE":
      return <RoleBandDashboard title="Emisión de carnés" />;
    default:
      return (
        <OperationDashboard
          title="Dashboard"
          description="Vista general del Sistema de Gestión de Accesos"
        />
      );
  }
}

function SolicitanteDashboard() {
  const userData = useCurrentUserData();
  const { data: requestPage } = useRequestsQuery({
    createdByUserId: userData?.id,
    pageSize: 200,
  });
  const requests = (requestPage?.items ?? []).map(toAccessRequestSummary);
  const myReqs = requests.filter((r) => r.createdBy === userData?.id);
  const recent = [...myReqs]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6);

  const counts = useMemo(
    () => ({
      draft: myReqs.filter((r) => r.status === "BORRADOR").length,
      returned: myReqs.filter(
        (r) => r.status === "DEVUELTA_PARA_CORRECCION",
      ).length,
      approved: myReqs.filter((r) =>
        [
          "APROBADA",
          "EN_CONFECCION",
          "LISTA_PARA_ENTREGA",
          "ENTREGADA",
        ].includes(r.status),
      ).length,
    }),
    [myReqs],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mis solicitudes"
        description={`${userData?.firstName} ${userData?.lastName}`}
        actions={
          <Link href="/requests/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Crear solicitud
            </Button>
          </Link>
        }
      />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SolicitanteStat label="Total" value={myReqs.length} />
        <SolicitanteStat label="Borradores" value={counts.draft} />
        <SolicitanteStat label="Devueltas" value={counts.returned} />
        <SolicitanteStat label="Aprobadas" value={counts.approved} />
      </div>
      <RecentRequestsList requests={recent} emptyHint="Cree su primera solicitud." />
    </div>
  );
}

function RoleBandDashboard({ title }: { title: string }) {
  const { data: requestPage } = useRequestsQuery({ pageSize: 200 });
  const requests = (requestPage?.items ?? []).map(toAccessRequestSummary);
  const recent = [...requests]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6);
  return (
    <div className="space-y-6">
      <OperationDashboard title={title} nearExpiryDays={30} />
      <RecentRequestsList
        title="Solicitudes recientes"
        requests={recent}
        emptyHint="Sin solicitudes en su ámbito."
      />
    </div>
  );
}

function SolicitanteStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}

function RecentRequestsList({
  title = "Solicitudes recientes",
  requests,
  emptyHint,
}: {
  title?: string;
  requests: ReturnType<typeof toAccessRequestSummary>[];
  emptyHint: string;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {requests.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Sin solicitudes"
          description={emptyHint}
          action={
            <Link href="/requests/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Crear solicitud
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-1">
          {requests.map((r) => (
            <Link
              key={r.id}
              href={`/requests/${r.id}`}
              className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-surface-muted"
            >
              <RequestTypeBadge type={r.type} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-primary">
                  {r.number}
                </p>
                <p className="truncate text-xs text-text-muted">{r.reason}</p>
              </div>
              <span className="hidden text-xs text-text-muted sm:block">
                {formatDate(r.createdAt)}
              </span>
              <StatusBadge status={r.status} />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
