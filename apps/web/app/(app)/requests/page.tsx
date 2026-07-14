'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Search, MoreHorizontal, Eye, Download, Filter } from 'lucide-react';
import { useSgaStore, useCurrentUserData } from '@/lib/store';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { RequestTypeBadge } from '@/components/shared/RequestTypeBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import type { AccessRequest, RequestStatus } from '@/lib/types';
import { REQUEST_STATUS_META, formatDate } from '@/lib/constants';
import { toast } from '@/hooks/use-toast';

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: 'ALL', label: 'Todas' },
  { value: 'BORRADOR', label: 'Borradores' },
  { value: 'ENVIADA', label: 'Enviadas' },
  { value: 'EN_REVISION_DOCUMENTAL', label: 'En revisión' },
  { value: 'DEVUELTA_PARA_CORRECCION', label: 'Devueltas' },
  { value: 'PENDIENTE_APROBACION', label: 'Pendientes de aprobación' },
  { value: 'APROBADA', label: 'Aprobadas' },
  { value: 'EN_CONFECCION', label: 'En confección' },
  { value: 'LISTA_PARA_ENTREGA', label: 'Listas para entrega' },
  { value: 'ENTREGADA', label: 'Entregadas' },
  { value: 'RECHAZADA', label: 'Rechazadas' },
];

export default function RequestsPage() {
  const requests = useSgaStore((s) => s.requests);
  const companies = useSgaStore((s) => s.companies);
  const people = useSgaStore((s) => s.people);
  const users = useSgaStore((s) => s.users);
  const userData = useCurrentUserData();
  const role = useSgaStore((s) => s.currentUser?.role);
  const router = useRouter();
  const searchParams = useSearchParams();
  const querySearch = searchParams.get('search') ?? '';
  const [search, setSearch] = useState(querySearch);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [companyFilter, setCompanyFilter] = useState('ALL');

  // Reflect ?search= changes (e.g. browser back/forward) into local state
  useEffect(() => {
    setSearch(querySearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [querySearch]);

  const companyName = (cid: string) => companies.find((c) => c.id === cid)?.tradeName ?? '—';
  const personName = (pid?: string) => {
    if (!pid) return '—';
    const p = people.find((x) => x.id === pid);
    return p ? `${p.firstName} ${p.firstLastName}` : '—';
  };
  const assignedName = (uid?: string) => {
    if (!uid) return '—';
    const u = users.find((x) => x.id === uid);
    return u ? `${u.firstName} ${u.lastName}` : '—';
  };

  // Scope by role
  const scopedRequests = useMemo(() => {
    if (role === 'ADMIN_EMPRESA' && userData) {
      return requests.filter((r) => r.companyId === userData.companyId);
    }
    if (role === 'SOLICITANTE' && userData) {
      return requests.filter((r) => r.createdBy === userData.id);
    }
    return requests;
  }, [requests, role, userData]);

  const filtered = useMemo(() => {
    return scopedRequests.filter((r) => {
      const matchesSearch = !search || r.number.toLowerCase().includes(search.toLowerCase()) || r.reason.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
      const matchesType = typeFilter === 'ALL' || r.type === typeFilter;
      const matchesCompany = companyFilter === 'ALL' || r.companyId === companyFilter;
      return matchesSearch && matchesStatus && matchesType && matchesCompany;
    });
  }, [scopedRequests, search, statusFilter, typeFilter, companyFilter]);

  const columns: Column<AccessRequest>[] = [
    {
      key: 'number',
      header: 'Número',
      sortable: true,
      sortValue: (r) => r.number,
      cell: (r) => <span className="font-medium text-text-primary">{r.number}</span>,
    },
    {
      key: 'type',
      header: 'Tipo',
      sortable: true,
      sortValue: (r) => r.type,
      cell: (r) => <RequestTypeBadge type={r.type} />,
    },
    { key: 'company', header: 'Empresa', sortable: true, sortValue: (r) => companyName(r.companyId), cell: (r) => <span className="text-text-secondary">{companyName(r.companyId)}</span> },
    { key: 'person', header: 'Persona principal', cell: (r) => <span className="text-text-secondary">{personName(r.primaryPersonId)}</span> },
    { key: 'date', header: 'Fecha', sortable: true, sortValue: (r) => r.createdAt, cell: (r) => <span className="text-text-muted">{formatDate(r.createdAt)}</span> },
    { key: 'validity', header: 'Vigencia', cell: (r) => <span className="text-text-muted">{formatDate(r.startDate)} — {formatDate(r.endDate)}</span> },
    { key: 'status', header: 'Estado', sortable: true, sortValue: (r) => r.status, cell: (r) => <StatusBadge status={r.status} /> },
    { key: 'assigned', header: 'Responsable', cell: (r) => <span className="text-text-muted">{assignedName(r.assignedTo)}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Solicitudes"
        description="Listado de solicitudes de acceso"
        actions={<Link href="/requests/new"><Button><Plus className="mr-2 h-4 w-4" />Nueva solicitud</Button></Link>}
      />

      {/* Quick status tabs */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((sf) => {
          const count = sf.value === 'ALL' ? scopedRequests.length : scopedRequests.filter((r) => r.status === sf.value).length;
          return (
            <button
              key={sf.value}
              onClick={() => setStatusFilter(sf.value)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === sf.value
                  ? 'border-brand-300 bg-brand-50 text-brand-700'
                  : 'border-border bg-surface text-text-muted hover:bg-surface-muted'
              }`}
            >
              {sf.label}
              <span className={`rounded-full px-1.5 text-[10px] ${statusFilter === sf.value ? 'bg-brand-200 text-brand-800' : 'bg-surface-muted text-text-muted'}`}>{count}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-disabled" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por número o motivo…" className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos los tipos</SelectItem>
              <SelectItem value="CARNE_PERMANENTE">Carné permanente</SelectItem>
              <SelectItem value="PERMISO_PERSONA">Permiso persona</SelectItem>
              <SelectItem value="PERMISO_VEHICULO">Permiso vehículo</SelectItem>
              <SelectItem value="PERMISO_HERRAMIENTA">Permiso herramienta</SelectItem>
            </SelectContent>
          </Select>
          {role === 'ADMIN_GENERAL' && (
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Empresa" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas las empresas</SelectItem>
                {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.tradeName}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" onClick={() => toast({ title: 'Exportación simulada' })}>
            <Download className="mr-2 h-4 w-4" />Exportar
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={(r) => router.push(`/requests/${r.id}`)}
        emptyTitle="Sin solicitudes"
        emptyDescription="No hay solicitudes que coincidan con los filtros."
        rowActions={(r) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-surface-muted"><MoreHorizontal className="h-4 w-4" /></button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(`/requests/${r.id}`)}><Eye className="mr-2 h-4 w-4" />Ver detalle</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />
    </div>
  );
}
