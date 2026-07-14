'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, MoreHorizontal, Eye } from 'lucide-react';
import { useSgaStore } from '@/lib/store';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { StatusBadge, Badge } from '@/components/shared/StatusBadge';
import { RequestTypeBadge } from '@/components/shared/RequestTypeBadge';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import type { AccessRequest } from '@/lib/types';
import { formatDate } from '@/lib/constants';
import { useStoreHydrated } from '@/lib/store';

/** Module-scoped constant — statuses that appear in the review inbox. */
const REVIEWABLE_STATUSES = [
  'EN_REVISION_DOCUMENTAL',
  'PENDIENTE_APROBACION',
  'DOCUMENTOS_APROBADOS',
  'DEVUELTA_PARA_CORRECCION',
  'RECHAZADA',
];

export default function ReviewsPage() {
  const hydrated = useStoreHydrated();
  const requests = useSgaStore((s) => s.requests);
  const companies = useSgaStore((s) => s.companies);
  const users = useSgaStore((s) => s.users);
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');

  const companyName = (cid: string) => companies.find((c) => c.id === cid)?.tradeName ?? '—';
  const assignedName = (uid?: string) => {
    if (!uid) return '—';
    const u = users.find((x) => x.id === uid);
    return u ? `${u.firstName} ${u.lastName}` : '—';
  };

  // Filter to reviewable statuses (constant hoisted to module scope).
  const reviewable = useMemo(() => {
    return requests.filter((r) => REVIEWABLE_STATUSES.includes(r.status));
  }, [requests]);

  const filtered = useMemo(() => {
    return reviewable.filter((r) => {
      const matchesSearch = !search || r.number.toLowerCase().includes(search.toLowerCase()) || r.reason.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
      const matchesType = typeFilter === 'ALL' || r.type === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [reviewable, search, statusFilter, typeFilter]);

  if (!hydrated) {
    return (
      <div className="space-y-6">
        <PageHeader title="Bandeja de Revisión (Cargando...)" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </div>
    );
  }

  const columns: Column<AccessRequest>[] = [
    { key: 'number', header: 'Número', sortable: true, sortValue: (r) => r.number, cell: (r) => <span className="font-medium text-text-primary">{r.number}</span> },
    { key: 'type', header: 'Tipo', cell: (r) => <RequestTypeBadge type={r.type} /> },
    { key: 'company', header: 'Empresa', sortable: true, sortValue: (r) => companyName(r.companyId), cell: (r) => <span className="text-text-secondary">{companyName(r.companyId)}</span> },
    { key: 'date', header: 'Fecha', sortable: true, sortValue: (r) => r.createdAt, cell: (r) => <span className="text-text-muted">{formatDate(r.createdAt)}</span> },
    { key: 'priority', header: 'Prioridad', cell: (r) => r.type === 'CARNE_PERMANENTE' ? <Badge tone="brand">Alta</Badge> : <Badge tone="neutral">Normal</Badge> },
    { key: 'assigned', header: 'Responsable', cell: (r) => <span className="text-text-muted">{assignedName(r.assignedTo)}</span> },
    { key: 'status', header: 'Estado', sortable: true, sortValue: (r) => r.status, cell: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Bandeja de revisión" description="Solicitudes pendientes de revisión y aprobación" />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-disabled" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar solicitud…" className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48 h-9"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos los estados</SelectItem>
              <SelectItem value="EN_REVISION_DOCUMENTAL">En revisión documental</SelectItem>
              <SelectItem value="PENDIENTE_APROBACION">Pendiente de aprobación</SelectItem>
              <SelectItem value="DEVUELTA_PARA_CORRECCION">Devuelta</SelectItem>
              <SelectItem value="RECHAZADA">Rechazada</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos los tipos</SelectItem>
              <SelectItem value="CARNE_PERMANENTE">Carné permanente</SelectItem>
              <SelectItem value="PERMISO_PERSONA">Permiso persona</SelectItem>
              <SelectItem value="PERMISO_VEHICULO">Permiso vehículo</SelectItem>
              <SelectItem value="PERMISO_HERRAMIENTA">Permiso herramienta</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={(r) => router.push(`/reviews/${r.id}`)}
        emptyTitle="Sin solicitudes pendientes"
        rowActions={(r) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label="Opciones" className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-surface-muted"><MoreHorizontal className="h-4 w-4" /></button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(`/reviews/${r.id}`)}><Eye className="mr-2 h-4 w-4" />Revisar</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />
    </div>
  );
}
