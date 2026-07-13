'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search, UserCog, MoreHorizontal, Eye, Pencil, Power } from 'lucide-react';
import { useSgaStore, useCurrentUserData } from '@/lib/store';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { EntityStatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Person } from '@/lib/types';
import { formatDate, calcAge, ID_TYPES } from '@/lib/constants';
import { toast } from '@/hooks/use-toast';

export default function PeoplePage() {
  const people = useSgaStore((s) => s.people);
  const companies = useSgaStore((s) => s.companies);
  const togglePersonStatus = useSgaStore((s) => s.togglePersonStatus);
  const userData = useCurrentUserData();
  const role = useSgaStore((s) => s.currentUser?.role);
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const companyName = (cid: string) => companies.find((c) => c.id === cid)?.tradeName ?? '—';

  // Company admin only sees their own people
  const scopedPeople = useMemo(() => {
    if (role === 'ADMIN_EMPRESA' && userData) {
      return people.filter((p) => p.companyId === userData.companyId);
    }
    return people;
  }, [people, role, userData]);

  const filtered = useMemo(() => {
    return scopedPeople.filter((p) => {
      const fullName = `${p.firstName} ${p.middleName ?? ''} ${p.firstLastName} ${p.secondLastName ?? ''}`.toLowerCase();
      const matchesSearch = !search || fullName.includes(search.toLowerCase()) || p.idNumber.toLowerCase().includes(search.toLowerCase());
      const matchesCompany = companyFilter === 'ALL' || p.companyId === companyFilter;
      const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
      return matchesSearch && matchesCompany && matchesStatus;
    });
  }, [scopedPeople, search, companyFilter, statusFilter]);

  const columns: Column<Person>[] = [
    {
      key: 'name',
      header: 'Persona',
      sortable: true,
      sortValue: (r) => `${r.firstName} ${r.firstLastName}`,
      cell: (r) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
            {r.firstName[0]}{r.firstLastName[0]}
          </div>
          <div>
            <p className="font-medium text-text-primary">{r.firstName} {r.firstLastName}</p>
            <p className="text-xs text-text-muted">{ID_TYPES.find((t) => t.value === r.idType)?.label}: {r.idNumber}</p>
          </div>
        </div>
      ),
    },
    { key: 'company', header: 'Empresa', sortable: true, sortValue: (r) => companyName(r.companyId), cell: (r) => <span className="text-text-secondary">{companyName(r.companyId)}</span> },
    { key: 'position', header: 'Cargo', cell: (r) => <div><p className="text-text-secondary">{r.position}</p><p className="text-xs text-text-muted">{r.department}</p></div> },
    { key: 'age', header: 'Edad', sortable: true, sortValue: (r) => calcAge(r.birthDate) ?? 0, cell: (r) => <span className="text-text-muted">{calcAge(r.birthDate) ?? '—'} años</span> },
    { key: 'createdAt', header: 'Registrado', sortable: true, sortValue: (r) => r.createdAt, cell: (r) => <span className="text-text-muted">{formatDate(r.createdAt)}</span> },
    { key: 'status', header: 'Estado', sortable: true, sortValue: (r) => r.status, cell: (r) => <EntityStatusBadge status={r.status} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Personas"
        description="Personas asociadas a empresas"
        actions={<Link href="/people/new"><Button><Plus className="mr-2 h-4 w-4" />Nueva persona</Button></Link>}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-disabled" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre o identificación…" className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-2">
          {role === 'ADMIN_GENERAL' && (
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger className="w-48 h-9"><SelectValue placeholder="Empresa" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas las empresas</SelectItem>
                {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.tradeName}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              <SelectItem value="ACTIVE">Activo</SelectItem>
              <SelectItem value="INACTIVE">Inactivo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={(r) => router.push(`/people/${r.id}`)}
        emptyTitle="Sin personas registradas"
        rowActions={(r) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-surface-muted"><MoreHorizontal className="h-4 w-4" /></button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(`/people/${r.id}`)}><Eye className="mr-2 h-4 w-4" />Ver detalle</DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/people/${r.id}`)}><Pencil className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
              <ConfirmDialog
                trigger={<button className="flex w-full items-center px-2 py-1.5 text-sm text-danger hover:bg-danger-soft"><Power className="mr-2 h-4 w-4" />{r.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}</button>}
                title={r.status === 'ACTIVE' ? 'Desactivar persona' : 'Activar persona'}
                description={`¿Confirmar acción sobre ${r.firstName} ${r.firstLastName}?`}
                destructive={r.status === 'ACTIVE'}
                onConfirm={() => { togglePersonStatus(r.id); toast({ title: 'Estado actualizado' }); }}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />
    </div>
  );
}
