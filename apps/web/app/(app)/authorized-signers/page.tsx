'use client';

import { useState, useMemo } from 'react';
import { Plus, Search, ShieldCheck, MoreHorizontal, Pencil, Power } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSgaStore, useCurrentUserData } from '@/lib/store';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { EntityStatusBadge, Badge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { AuthorizedSigner } from '@/lib/types';
import { formatDate } from '@/lib/constants';
import { toast } from '@/hooks/use-toast';

const signerSchema = z
  .object({
    companyId: z.string().min(1, 'Empresa obligatoria'),
    personId: z.string().min(1, 'Persona obligatoria'),
    position: z.string().min(1, 'Cargo obligatorio'),
    startDate: z.string().min(1, 'Fecha de inicio obligatoria'),
    endDate: z.string().min(1, 'Fecha de vencimiento obligatoria'),
    documentName: z.string().optional(),
    signatureName: z.string().optional(),
  })
  .refine((d) => !d.endDate || d.endDate >= d.startDate, {
    path: ['endDate'],
    message: 'El vencimiento debe ser posterior al inicio',
  });
type SignerForm = z.infer<typeof signerSchema>;

export default function AuthorizedSignersPage() {
  const signers = useSgaStore((s) => s.authorizedSigners);
  const companies = useSgaStore((s) => s.companies);
  const people = useSgaStore((s) => s.people);
  const addSigner = useSgaStore((s) => s.addSigner);
  const updateSigner = useSgaStore((s) => s.updateSigner);
  const toggleSignerStatus = useSgaStore((s) => s.toggleSignerStatus);
  const userData = useCurrentUserData();
  const role = useSgaStore((s) => s.currentUser?.role);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<SignerForm>({
    resolver: zodResolver(signerSchema),
    defaultValues: {
      companyId: '',
      personId: '',
      position: '',
      startDate: '',
      endDate: '',
      documentName: '',
      signatureName: '',
    },
  });

  const companyName = (cid: string) => companies.find((c) => c.id === cid)?.tradeName ?? '—';
  const personName = (pid: string) => {
    const p = people.find((x) => x.id === pid);
    return p ? `${p.firstName} ${p.firstLastName}` : '—';
  };

  const scopedSigners = useMemo(() => {
    if (role === 'ADMIN_EMPRESA' && userData) {
      return signers.filter((s) => s.companyId === userData.companyId);
    }
    return signers;
  }, [signers, role, userData]);

  const filtered = useMemo(() => {
    return scopedSigners.filter((s) => {
      const name = personName(s.personId).toLowerCase();
      return !search || name.includes(search.toLowerCase()) || companyName(s.companyId).toLowerCase().includes(search.toLowerCase());
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedSigners, search]);

  const today = new Date().toISOString().slice(0, 10);

  const openCreate = () => {
    setEditingId(null);
    reset({
      companyId: role === 'ADMIN_EMPRESA' && userData ? userData.companyId : '',
      personId: '',
      position: '',
      startDate: '',
      endDate: '',
      documentName: '',
      signatureName: '',
    });
    setDialogOpen(true);
  };

  const openEdit = (s: AuthorizedSigner) => {
    setEditingId(s.id);
    reset({
      companyId: s.companyId,
      personId: s.personId,
      position: s.position,
      startDate: s.startDate,
      endDate: s.endDate,
      documentName: s.documentName ?? '',
      signatureName: s.signatureName ?? '',
    });
    setDialogOpen(true);
  };

  const onSubmit = (data: SignerForm) => {
    if (editingId) {
      updateSigner(editingId, { ...data });
      toast({ title: 'Firmante actualizado' });
    } else {
      addSigner({ ...data, status: 'ACTIVE' });
      toast({ title: 'Firmante registrado' });
    }
    setDialogOpen(false);
  };

  const watchCompanyId = watch('companyId');

  const columns: Column<AuthorizedSigner>[] = [
    {
      key: 'person',
      header: 'Firmante',
      sortable: true,
      sortValue: (r) => personName(r.personId),
      cell: (r) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-700">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <p className="font-medium text-text-primary">{personName(r.personId)}</p>
            <p className="text-xs text-text-muted">{r.position}</p>
          </div>
        </div>
      ),
    },
    { key: 'company', header: 'Empresa', sortable: true, sortValue: (r) => companyName(r.companyId), cell: (r) => <span className="text-text-secondary">{companyName(r.companyId)}</span> },
    { key: 'start', header: 'Inicio', sortable: true, sortValue: (r) => r.startDate, cell: (r) => <span className="text-text-muted">{formatDate(r.startDate)}</span> },
    { key: 'end', header: 'Vencimiento', sortable: true, sortValue: (r) => r.endDate, cell: (r) => {
      const expired = r.status === 'ACTIVE' && r.endDate < today;
      return (
        <span className="flex items-center gap-1.5">
          <span className={expired ? 'text-danger' : 'text-text-muted'}>{formatDate(r.endDate)}</span>
          {expired && <Badge tone="danger">Vencido</Badge>}
        </span>
      );
    } },
    { key: 'status', header: 'Estado', sortable: true, sortValue: (r) => r.status, cell: (r) => <EntityStatusBadge status={r.status} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Firmantes autorizados"
        description="Gestión de firmantes autorizados por empresa"
        actions={<Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Nuevo firmante</Button>}
      />

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-disabled" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar firmante…" className="pl-9" />
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        emptyTitle="Sin firmantes registrados"
        rowActions={(r) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label="Opciones" className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-surface-muted"><MoreHorizontal className="h-4 w-4" /></button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openEdit(r)}><Pencil className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
              <ConfirmDialog
                trigger={<button type="button" className="flex w-full items-center px-2 py-1.5 text-sm text-danger hover:bg-danger-soft"><Power className="mr-2 h-4 w-4" />{r.status === 'ACTIVE' ? 'Revocar' : 'Activar'}</button>}
                title={r.status === 'ACTIVE' ? 'Revocar firmante' : 'Activar firmante'}
                description="¿Confirmar acción?"
                destructive={r.status === 'ACTIVE'}
                onConfirm={() => { toggleSignerStatus(r.id); toast({ title: 'Estado actualizado' }); }}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar firmante' : 'Nuevo firmante'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Empresa" required error={errors.companyId?.message}>
              <Select value={watchCompanyId} onValueChange={(v) => setValue('companyId', v)} disabled={role === 'ADMIN_EMPRESA'}>
                <SelectTrigger><SelectValue placeholder="Empresa" /></SelectTrigger>
                <SelectContent>
                  {(role === 'ADMIN_EMPRESA' ? companies.filter((c) => c.id === userData?.companyId) : companies).map((c) => <SelectItem key={c.id} value={c.id}>{c.tradeName}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Persona" required error={errors.personId?.message}>
              <Select value={watch('personId')} onValueChange={(v) => setValue('personId', v)}>
                <SelectTrigger><SelectValue placeholder="Persona" /></SelectTrigger>
                <SelectContent>
                  {people.filter((p) => !watchCompanyId || p.companyId === watchCompanyId).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.firstName} {p.firstLastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Cargo" required error={errors.position?.message} className="sm:col-span-2">
              <Input {...register('position')} placeholder="Cargo del firmante" />
            </FormField>
            <FormField label="Fecha de inicio" required error={errors.startDate?.message}>
              <Input type="date" {...register('startDate')} />
            </FormField>
            <FormField label="Fecha de vencimiento" required error={errors.endDate?.message}>
              <Input type="date" {...register('endDate')} />
            </FormField>
            <FormField label="Documento simulado" className="sm:col-span-2">
              <Input {...register('documentName')} placeholder="poder.pdf" />
            </FormField>
            <FormField label="Firma simulada" className="sm:col-span-2">
              <Input {...register('signatureName')} placeholder="Nombre de la firma" />
            </FormField>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit">{editingId ? 'Guardar' : 'Registrar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FormField({ label, required, error, children, className }: { label: string; required?: boolean; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="mb-1.5 flex items-center gap-1 text-sm font-medium text-text-primary">
        {label}{required && <span className="text-danger">*</span>}
      </Label>
      {children}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
