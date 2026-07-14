'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  Building2,
  Users,
  UserCog,
  ClipboardList,
  Clock,
  AlertCircle,
  CheckCircle2,
  Plus,
  ArrowRight,
  IdCard,
  FileCheck2,
  RotateCcw,
} from 'lucide-react';
import { useSgaStore, useCurrentUserData, useStoreHydrated } from '@/lib/store';
import { PageHeader, StatCard, DetailSection } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { RequestTypeBadge } from '@/components/shared/RequestTypeBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatDate, formatDateTime } from '@/lib/constants';
import type { RequestStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';

import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardPage() {
  const hydrated = useStoreHydrated();
  const role = useSgaStore((s) => s.currentUser?.role);
  const userData = useCurrentUserData();

  if (!hydrated) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (!role || !userData) return null;

  switch (role) {
    case 'ADMIN_GENERAL':
      return <AdminDashboard />;
    case 'ADMIN_EMPRESA':
      return <CompanyAdminDashboard />;
    case 'SOLICITANTE':
      return <SolicitanteDashboard />;
    case 'REVISOR':
      return <RevisorDashboard />;
    case 'JEFE_DOCUMENTOS':
      return <JefeDashboard />;
    case 'EMISOR_CARNE':
      return <EmisorDashboard />;
    default:
      return <AdminDashboard />;
  }
}

function AdminDashboard() {
  const companies = useSgaStore((s) => s.companies);
  const users = useSgaStore((s) => s.users);
  const people = useSgaStore((s) => s.people);
  const requests = useSgaStore((s) => s.requests);
  const activity = useSgaStore((s) => s.activityHistory);

  const stats = useMemo(() => {
    const now = new Date();
    const monthReqs = requests.filter(
      (r) => new Date(r.createdAt).getMonth() === now.getMonth() && new Date(r.createdAt).getFullYear() === now.getFullYear()
    );
    return {
      activeCompanies: companies.filter((c) => c.status === 'ACTIVE').length,
      users: users.length,
      people: people.length,
      monthRequests: monthReqs.length,
      pending: requests.filter((r) => ['EN_REVISION_DOCUMENTAL', 'PENDIENTE_APROBACION', 'DOCUMENTOS_APROBADOS'].includes(r.status)).length,
      returned: requests.filter((r) => r.status === 'DEVUELTA_PARA_CORRECCION').length,
      approved: requests.filter((r) => r.status === 'APROBADA' || r.status === 'EN_CONFECCION' || r.status === 'LISTA_PARA_ENTREGA' || r.status === 'ENTREGADA').length,
    };
  }, [companies, users, people, requests]);

  const recent = [...requests].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
  const statusDist = useMemo(() => {
    const dist: Record<string, number> = {};
    requests.forEach((r) => { dist[r.status] = (dist[r.status] ?? 0) + 1; });
    return dist;
  }, [requests]);

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Vista general del Sistema de Gestión de Accesos" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Empresas activas" value={stats.activeCompanies} icon={Building2} />
        <StatCard label="Usuarios registrados" value={stats.users} icon={Users} />
        <StatCard label="Personas registradas" value={stats.people} icon={UserCog} />
        <StatCard label="Solicitudes del mes" value={stats.monthRequests} icon={ClipboardList} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Pendientes" value={stats.pending} icon={Clock} tone="warning" />
        <StatCard label="Devueltas" value={stats.returned} icon={AlertCircle} tone="danger" />
        <StatCard label="Aprobadas" value={stats.approved} icon={CheckCircle2} tone="success" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <DetailSection title="Solicitudes recientes" className="lg:col-span-2">
          {recent.length === 0 ? (
            <EmptyState icon={ClipboardList} title="Sin solicitudes" />
          ) : (
            <div className="space-y-1">
              {recent.map((r) => (
                <Link
                  key={r.id}
                  href={`/requests/${r.id}`}
                  className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-surface-muted"
                >
                  <RequestTypeBadge type={r.type} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text-primary">{r.number}</p>
                    <p className="truncate text-xs text-text-muted">{r.reason}</p>
                  </div>
                  <StatusBadge status={r.status} />
                </Link>
              ))}
            </div>
          )}
        </DetailSection>

        <DetailSection title="Distribución por estado">
          <div className="space-y-2.5">
            {Object.entries(statusDist).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <StatusBadge status={status as RequestStatus} />
                <span className="text-sm font-semibold text-text-primary">{count}</span>
              </div>
            ))}
          </div>
        </DetailSection>
      </div>

      <DetailSection title="Actividad reciente">
        <div className="space-y-1">
          {activity.slice(0, 6).map((a) => (
            <div key={a.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-muted">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                <RotateCcw className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-text-primary"><span className="font-medium">{a.actor}</span> {a.action.toLowerCase()}</p>
              </div>
              <span className="text-xs text-text-muted">{formatDateTime(a.timestamp)}</span>
            </div>
          ))}
        </div>
      </DetailSection>

      <DetailSection title="Accesos rápidos">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Empresas', href: '/companies', icon: Building2 },
            { label: 'Usuarios', href: '/users', icon: Users },
            { label: 'Personas', href: '/people', icon: UserCog },
            { label: 'Solicitudes', href: '/requests', icon: ClipboardList },
            { label: 'Revisión', href: '/reviews', icon: FileCheck2 },
            { label: 'Emisión', href: '/issuance', icon: IdCard },
            { label: 'Catálogos', href: '/catalogs', icon: Plus },
            { label: 'Nueva solicitud', href: '/requests/new', icon: Plus },
          ].map((q) => (
            <Link key={q.href} href={q.href}>
              <div className="flex items-center gap-2 rounded-lg border border-border p-3 hover:border-brand-300 hover:bg-brand-50">
                <q.icon className="h-4 w-4 text-brand-600" />
                <span className="text-sm font-medium text-text-primary">{q.label}</span>
                <ArrowRight className="ml-auto h-3.5 w-3.5 text-text-disabled" />
              </div>
            </Link>
          ))}
        </div>
      </DetailSection>
    </div>
  );
}

function CompanyAdminDashboard() {
  const userData = useCurrentUserData();
  const companies = useSgaStore((s) => s.companies);
  const people = useSgaStore((s) => s.people);
  const requests = useSgaStore((s) => s.requests);

  const company = companies.find((c) => c.id === userData?.companyId);
  const myPeople = people.filter((p) => p.companyId === userData?.companyId);
  const myReqs = requests.filter((r) => r.companyId === userData?.companyId);
  const recent = [...myReqs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);

  const stats = {
    draft: myReqs.filter((r) => r.status === 'BORRADOR').length,
    sent: myReqs.filter((r) => r.status === 'ENVIADA').length,
    pending: myReqs.filter((r) => ['EN_REVISION_DOCUMENTAL', 'PENDIENTE_APROBACION', 'DOCUMENTOS_APROBADOS'].includes(r.status)).length,
    returned: myReqs.filter((r) => r.status === 'DEVUELTA_PARA_CORRECCION').length,
    approved: myReqs.filter((r) => ['APROBADA', 'EN_CONFECCION', 'LISTA_PARA_ENTREGA', 'ENTREGADA'].includes(r.status)).length,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Panel — ${company?.tradeName ?? 'Empresa'}`}
        description={company?.legalName}
        actions={
          <Link href="/requests/new">
            <Button><Plus className="mr-2 h-4 w-4" />Nueva solicitud</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Personas registradas" value={myPeople.length} icon={UserCog} />
        <StatCard label="Solicitudes en borrador" value={stats.draft} icon={ClipboardList} tone="neutral" />
        <StatCard label="Solicitudes enviadas" value={stats.sent} icon={ArrowRight} tone="info" />
        <StatCard label="Pendientes" value={stats.pending} icon={Clock} tone="warning" />
        <StatCard label="Devueltas" value={stats.returned} icon={AlertCircle} tone="danger" />
        <StatCard label="Aprobadas" value={stats.approved} icon={CheckCircle2} tone="success" />
      </div>

      <DetailSection title="Solicitudes recientes">
        {recent.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Sin solicitudes" description="Cree su primera solicitud." action={<Link href="/requests/new"><Button><Plus className="mr-2 h-4 w-4" />Nueva solicitud</Button></Link>} />
        ) : (
          <div className="space-y-1">
            {recent.map((r) => (
              <Link key={r.id} href={`/requests/${r.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-surface-muted">
                <RequestTypeBadge type={r.type} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">{r.number}</p>
                  <p className="truncate text-xs text-text-muted">{r.reason}</p>
                </div>
                <span className="hidden text-xs text-text-muted sm:block">{formatDate(r.createdAt)}</span>
                <StatusBadge status={r.status} />
              </Link>
            ))}
          </div>
        )}
      </DetailSection>
    </div>
  );
}

function SolicitanteDashboard() {
  const userData = useCurrentUserData();
  const requests = useSgaStore((s) => s.requests);

  const myReqs = requests.filter((r) => r.createdBy === userData?.id);
  const recent = [...myReqs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);

  const stats = {
    total: myReqs.length,
    draft: myReqs.filter((r) => r.status === 'BORRADOR').length,
    returned: myReqs.filter((r) => r.status === 'DEVUELTA_PARA_CORRECCION').length,
    approved: myReqs.filter((r) => ['APROBADA', 'EN_CONFECCION', 'LISTA_PARA_ENTREGA', 'ENTREGADA'].includes(r.status)).length,
    pendingDocs: myReqs.filter((r) => r.documents.some((d) => d.status === 'PENDIENTE' || d.status === 'RECHAZADO')).length,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mis solicitudes"
        description={`${userData?.firstName} ${userData?.lastName}`}
        actions={<Link href="/requests/new"><Button><Plus className="mr-2 h-4 w-4" />Crear solicitud</Button></Link>}
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total" value={stats.total} icon={ClipboardList} />
        <StatCard label="Borradores" value={stats.draft} icon={ClipboardList} tone="neutral" />
        <StatCard label="Devueltas" value={stats.returned} icon={AlertCircle} tone="danger" />
        <StatCard label="Aprobadas" value={stats.approved} icon={CheckCircle2} tone="success" />
      </div>
      <DetailSection title="Solicitudes recientes">
        {recent.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Sin solicitudes" description="Cree su primera solicitud." action={<Link href="/requests/new"><Button><Plus className="mr-2 h-4 w-4" />Crear solicitud</Button></Link>} />
        ) : (
          <div className="space-y-1">
            {recent.map((r) => (
              <Link key={r.id} href={`/requests/${r.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-surface-muted">
                <RequestTypeBadge type={r.type} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">{r.number}</p>
                  <p className="truncate text-xs text-text-muted">{r.reason}</p>
                </div>
                <StatusBadge status={r.status} />
              </Link>
            ))}
          </div>
        )}
      </DetailSection>
    </div>
  );
}

function RevisorDashboard() {
  const requests = useSgaStore((s) => s.requests);
  const pending = requests.filter((r) => r.status === 'EN_REVISION_DOCUMENTAL');
  const returned = requests.filter((r) => r.status === 'DEVUELTA_PARA_CORRECCION');
  const incomplete = requests.filter((r) => r.documents.some((d) => d.status === 'RECHAZADO'));
  const priority = pending.filter((r) => r.type === 'CARNE_PERMANENTE');

  return (
    <div className="space-y-6">
      <PageHeader title="Bandeja de revisión" description="Revisión documental de solicitudes" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Pendientes de revisión" value={pending.length} icon={Clock} tone="warning" />
        <StatCard label="Documentos incompletos" value={incomplete.length} icon={AlertCircle} tone="danger" />
        <StatCard label="Solicitudes devueltas" value={returned.length} icon={RotateCcw} tone="neutral" />
        <StatCard label="Prioritarias" value={priority.length} icon={FileCheck2} tone="brand" />
      </div>
      <DetailSection title="Bandeja de trabajo">
        {pending.length === 0 ? (
          <EmptyState icon={FileCheck2} title="Sin solicitudes pendientes" />
        ) : (
          <div className="space-y-1">
            {pending.map((r) => (
              <Link key={r.id} href={`/reviews/${r.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-surface-muted">
                <RequestTypeBadge type={r.type} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">{r.number}</p>
                  <p className="truncate text-xs text-text-muted">{r.reason}</p>
                </div>
                <span className="text-xs text-text-muted">{formatDate(r.createdAt)}</span>
                <ArrowRight className="h-4 w-4 text-text-disabled" />
              </Link>
            ))}
          </div>
        )}
      </DetailSection>
    </div>
  );
}

function JefeDashboard() {
  const requests = useSgaStore((s) => s.requests);
  const pending = requests.filter((r) => r.status === 'PENDIENTE_APROBACION');
  const approved = requests.filter((r) => ['APROBADA', 'EN_CONFECCION', 'LISTA_PARA_ENTREGA', 'ENTREGADA'].includes(r.status));
  const rejected = requests.filter((r) => r.status === 'RECHAZADA');

  return (
    <div className="space-y-6">
      <PageHeader title="Aprobación de solicitudes" description="Jefatura de documentos de acceso" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Pendientes de aprobación" value={pending.length} icon={Clock} tone="warning" />
        <StatCard label="Aprobadas" value={approved.length} icon={CheckCircle2} tone="success" />
        <StatCard label="Rechazadas" value={rejected.length} icon={AlertCircle} tone="danger" />
        <StatCard label="En emisión" value={requests.filter((r) => ['EN_CONFECCION', 'LISTA_PARA_ENTREGA'].includes(r.status)).length} icon={IdCard} tone="brand" />
      </div>
      <DetailSection title="Solicitudes por aprobar">
        {pending.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="Sin solicitudes pendientes" />
        ) : (
          <div className="space-y-1">
            {pending.map((r) => (
              <Link key={r.id} href={`/reviews/${r.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-surface-muted">
                <RequestTypeBadge type={r.type} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">{r.number}</p>
                  <p className="truncate text-xs text-text-muted">{r.reason}</p>
                </div>
                <StatusBadge status={r.status} />
                <ArrowRight className="h-4 w-4 text-text-disabled" />
              </Link>
            ))}
          </div>
        )}
      </DetailSection>
    </div>
  );
}

function EmisorDashboard() {
  const requests = useSgaStore((s) => s.requests);
  const pending = requests.filter((r) => r.status === 'APROBADA');
  const inProgress = requests.filter((r) => r.status === 'EN_CONFECCION');
  const ready = requests.filter((r) => r.status === 'LISTA_PARA_ENTREGA');
  const delivered = requests.filter((r) => r.status === 'ENTREGADA');

  return (
    <div className="space-y-6">
      <PageHeader title="Emisión de carnés" description="Confección y entrega de carnés" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Pendientes de confección" value={pending.length} icon={Clock} tone="warning" />
        <StatCard label="En confección" value={inProgress.length} icon={IdCard} tone="brand" />
        <StatCard label="Listas para entrega" value={ready.length} icon={FileCheck2} tone="info" />
        <StatCard label="Entregadas" value={delivered.length} icon={CheckCircle2} tone="success" />
      </div>
      <DetailSection title="Pendientes de confección">
        {pending.length === 0 ? (
          <EmptyState icon={IdCard} title="Sin solicitudes pendientes" />
        ) : (
          <div className="space-y-1">
            {pending.map((r) => (
              <Link key={r.id} href={`/issuance`} className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-surface-muted">
                <RequestTypeBadge type={r.type} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">{r.number}</p>
                  <p className="truncate text-xs text-text-muted">{r.reason}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-text-disabled" />
              </Link>
            ))}
          </div>
        )}
      </DetailSection>
    </div>
  );
}
