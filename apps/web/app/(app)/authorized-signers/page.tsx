'use client';

import { useState, useMemo } from 'react';
import { Plus, Search, ShieldCheck, MoreHorizontal, Pencil, Power, Eye } from 'lucide-react';
import { useSgaStore, useCurrentUserData } from '@/lib/store';
import { PageHeader, FormSection, DetailSection } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { EntityStatusBadge } from '@/components/shared/StatusBadge';
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
  const [form, setForm] = useState({
    companyId: '',
    personId: '',
    position: '',
    startDate: '',
    endDate: '',
    documentName: '',
    signatureName: '',
  });

  const companyName = (cid: string) => companies.find((c: { id: string; tradeName: string }) => c.id === cid)?.tradeName ?? '—';
  const personName = (pid: string) => {
    const p = people.find((x: { id: string; firstName: string; firstLastName: string }) => x.id === pid);
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
  }, [scopedSigners, search, personName, companyName]);

  const openCreate = () => {
    setEditingId(null);
    setForm({
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
    setForm({
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

  const handleSave = () => {
    if (!form.companyId || !form.personId || !form.position || !form.startDate || !form.endDate) {
      toast({ title: 'Complete los campos obligatorios', variant: 'destructive' });
      return;
    }
    if (editingId) {
      updateSigner(editingId, { ...form });
      toast({ title: 'Firmante actualizado' });
    } else {
      addSigner({ ...form, status: 'ACTIVE' });
      toast({ title: 'Firmante registrado' });
    }
    setDialogOpen(false);
  };

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
    { key: 'end', header: 'Vencimiento', sortable: true, sortValue: (r) => r.endDate, cell: (r) => <span className="text-text-muted">{formatDate(r.endDate)}</span> },
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
              <button className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-surface-muted"><MoreHorizontal className="h-4 w-4" /></button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openEdit(r)}><Pencil className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
              <ConfirmDialog
                trigger={<button className="flex w-full items-center px-2 py-1.5 text-sm text-danger hover:bg-danger-soft"><Power className="mr-2 h-4 w-4" />{r.status === 'ACTIVE' ? 'Revocar' : 'Activar'}</button>}
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Empresa" required>
              <Select value={form.companyId} onValueChange={(v) => setForm({ ...form, companyId: v })} disabled={role === 'ADMIN_EMPRESA'}>
                <SelectTrigger><SelectValue placeholder="Empresa" /></SelectTrigger>
                <SelectContent>
                  {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.tradeName}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Persona" required>
              <Select value={form.personId} onValueChange={(v) => setForm({ ...form, personId: v })}>
                <SelectTrigger><SelectValue placeholder="Persona" /></SelectTrigger>
                <SelectContent>
                  {people.filter((p) => !form.companyId || p.companyId === form.companyId).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.firstName} {p.firstLastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Cargo" required className="sm:col-span-2">
              <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder="Cargo del firmante" />
            </FormField>
            <FormField label="Fecha de inicio" required>
              <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </FormField>
            <FormField label="Fecha de vencimiento" required>
              <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </FormField>
            <FormField label="Documento simulado" className="sm:col-span-2">
              <Input value={form.documentName} onChange={(e) => setForm({ ...form, documentName: e.target.value })} placeholder="poder.pdf" />
            </FormField>
            <FormField label="Firma simulada" className="sm:col-span-2">
              <Input value={form.signatureName} onChange={(e) => setForm({ ...form, signatureName: e.target.value })} placeholder="Nombre de la firma" />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editingId ? 'Guardar' : 'Registrar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FormField({ label, required, children, className }: { label: string; required?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="mb-1.5 flex items-center gap-1 text-sm font-medium text-text-primary">{label}{required && <span className="text-danger">*</span>}</Label>
      {children}
    </div>
  );
}
