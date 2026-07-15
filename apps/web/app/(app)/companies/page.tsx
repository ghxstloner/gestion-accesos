'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search, Building2, MoreHorizontal, Eye, Pencil, Power } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { EntityStatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import type { Company } from '@/lib/types';
import { formatDate } from '@/lib/constants';
import { toast } from '@/hooks/use-toast';
import {
  useCompaniesQuery,
  useToggleCompanyStatusMutation,
} from '@/hooks/api-hooks';

export default function CompaniesPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const { data: companies, isLoading } = useCompaniesQuery({
    search: search.trim() || undefined,
    status: statusFilter === 'ALL' ? undefined : statusFilter,
  });
  const toggleMutation = useToggleCompanyStatusMutation();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Empresas (Cargando...)" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </div>
    );
  }

  const filtered = companies ?? [];

  const columns: Column<Company>[] = [
    {
      key: 'name',
      header: 'Empresa',
      sortable: true,
      sortValue: (r) => r.legalName,
      cell: (r) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-text-primary">{r.legalName}</p>
            <p className="truncate text-xs text-text-muted">{r.tradeName}</p>
          </div>
        </div>
      ),
    },
    { key: 'taxId', header: 'Identificador fiscal', sortable: true, sortValue: (r) => r.taxId, cell: (r) => <span className="text-text-secondary">{r.taxId}</span> },
    { key: 'contact', header: 'Contacto principal', cell: (r) => <span className="text-text-secondary">{r.primaryContact}</span> },
    { key: 'email', header: 'Correo', cell: (r) => <span className="text-text-secondary">{r.email}</span> },
    { key: 'createdAt', header: 'Creada', sortable: true, sortValue: (r) => r.createdAt, cell: (r) => <span className="text-text-muted">{formatDate(r.createdAt)}</span> },
    { key: 'status', header: 'Estado', sortable: true, sortValue: (r) => r.status, cell: (r) => <EntityStatusBadge status={r.status} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Empresas"
        description="Administración de empresas registradas"
        actions={
          <Link href="/companies/new">
            <Button><Plus className="mr-2 h-4 w-4" />Crear empresa</Button>
          </Link>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-disabled" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o identificador…"
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {['ALL', 'ACTIVE', 'INACTIVE'].map((s) => (
            <button type="button" key={s}
               onClick={() => setStatusFilter(s)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                statusFilter === s
                  ? 'border-brand-300 bg-brand-50 text-brand-700'
                  : 'border-border bg-surface text-text-muted hover:bg-surface-muted'
              }`}
            >
              {s === 'ALL' ? 'Todas' : s === 'ACTIVE' ? 'Activas' : 'Inactivas'}
            </button>
          ))}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={(r) => router.push(`/companies/${r.id}`)}
        emptyTitle="Sin empresas"
        rowActions={(r) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label="Opciones" className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-surface-muted">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(`/companies/${r.id}`)}>
                <Eye className="mr-2 h-4 w-4" /> Ver detalle
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/companies/${r.id}`)}>
                <Pencil className="mr-2 h-4 w-4" /> Editar
              </DropdownMenuItem>
              <ConfirmDialog
                trigger={
                  <button type="button" className="flex w-full items-center px-2 py-1.5 text-sm text-danger hover:bg-danger-soft">
                    <Power className="mr-2 h-4 w-4" /> {r.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}
                  </button>
                }
                title={r.status === 'ACTIVE' ? 'Desactivar empresa' : 'Activar empresa'}
                description={`¿Desea ${r.status === 'ACTIVE' ? 'desactivar' : 'activar'} la empresa "${r.tradeName}"?`}
                confirmLabel={r.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}
                destructive={r.status === 'ACTIVE'}
                onConfirm={() => {
                  toggleMutation.mutate(
                    { id: r.id, activate: r.status !== 'ACTIVE' },
                    {
                      onSuccess: () =>
                        toast({
                          title:
                            r.status === 'ACTIVE'
                              ? 'Empresa desactivada'
                              : 'Empresa activada',
                        }),
                      onError: (err) =>
                        toast({
                          title: 'No se pudo actualizar',
                          description:
                            err instanceof Error ? err.message : undefined,
                          variant: 'destructive',
                        }),
                    },
                  );
                }}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />
    </div>
  );
}
