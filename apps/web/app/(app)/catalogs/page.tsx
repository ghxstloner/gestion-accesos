'use client';

import { useState } from 'react';
import { Plus, Pencil, Power } from 'lucide-react';
import { useSgaStore } from '@/lib/store';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { Badge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { toast } from '@/hooks/use-toast';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import type { CatalogEntry, Catalogs } from '@/lib/types';

type CatalogKey = keyof Catalogs;

const tabConfig: { key: CatalogKey; label: string }[] = [
  { key: 'requestTypes', label: 'Tipos de solicitud' },
  { key: 'idTypes', label: 'Tipos de identificación' },
  { key: 'documentTypes', label: 'Tipos de documentos' },
  { key: 'accessPoints', label: 'Puntos de acceso' },
  { key: 'securityZones', label: 'Zonas de seguridad' },
  { key: 'accessAreas', label: 'Áreas de acceso' },
  { key: 'rejectionReasons', label: 'Motivos de rechazo' },
];

const entrySchema = z.object({
  label: z.string().min(1, 'Nombre obligatorio'),
  code: z.string().min(1, 'Código obligatorio'),
  description: z.string().optional().default(''),
  active: z.boolean().default(true),
});
type EntryForm = z.infer<typeof entrySchema>;

export default function CatalogsPage() {
  const catalogs = useSgaStore((s) => s.catalogs);
  const addCatalogEntry = useSgaStore((s) => s.addCatalogEntry);
  const updateCatalogEntry = useSgaStore((s) => s.updateCatalogEntry);
  const toggleCatalogEntry = useSgaStore((s) => s.toggleCatalogEntry);
  const [activeTab, setActiveTab] = useState<CatalogKey>('requestTypes');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogEntry | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EntryForm>({ resolver: zodResolver(entrySchema) });

  const openCreate = () => {
    setEditing(null);
    reset({ label: '', code: '', description: '', active: true });
    setDialogOpen(true);
  };

  const openEdit = (entry: CatalogEntry) => {
    setEditing(entry);
    reset({ label: entry.label, code: entry.code, description: entry.description ?? '', active: entry.active });
    setDialogOpen(true);
  };

  const onSubmit = (data: EntryForm) => {
    if (editing) {
      updateCatalogEntry(activeTab, editing.id, data);
      toast({ title: 'Catálogo actualizado' });
    } else {
      addCatalogEntry(activeTab, data);
      toast({ title: 'Entrada creada' });
    }
    setDialogOpen(false);
  };

  const columns: Column<CatalogEntry>[] = [
    { key: 'label', header: 'Nombre', sortable: true, sortValue: (r) => r.label, cell: (r) => <span className="font-medium text-text-primary">{r.label}</span> },
    { key: 'code', header: 'Código', sortable: true, sortValue: (r) => r.code, cell: (r) => <span className="text-text-secondary font-mono text-xs">{r.code}</span> },
    { key: 'description', header: 'Descripción', cell: (r) => <span className="text-text-muted">{r.description ?? '—'}</span> },
    { key: 'active', header: 'Estado', sortable: true, sortValue: (r) => (r.active ? '1' : '0'), cell: (r) => r.active ? <Badge tone="success">Activo</Badge> : <Badge tone="neutral">Inactivo</Badge> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Catálogos" description="Administración de catálogos del sistema" />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as CatalogKey)}>
        <TabsList className="flex h-auto flex-wrap gap-1 bg-surface-muted p-1">
          {tabConfig.map((t) => (
            <TabsTrigger key={t.key} value={t.key} className="text-xs">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {tabConfig.map((t) => (
          <TabsContent key={t.key} value={t.key} className="mt-4">
            <div className="mb-4 flex justify-end">
              <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Agregar</Button>
            </div>
            <DataTable
              columns={columns}
              data={catalogs[t.key]}
              emptyTitle="Sin entradas"
              rowActions={(r) => (
                <div className="flex items-center gap-0.5">
                  <button onClick={() => openEdit(r)} title="Editar" className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-surface-muted">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <ConfirmDialog
                    trigger={
                      <button title={r.active ? 'Desactivar' : 'Activar'} className={`flex h-8 w-8 items-center justify-center rounded-md ${r.active ? 'text-text-muted hover:bg-danger-soft hover:text-danger' : 'text-text-muted hover:bg-success-soft hover:text-success'}`}>
                        <Power className="h-4 w-4" />
                      </button>
                    }
                    title={r.active ? 'Desactivar entrada' : 'Activar entrada'}
                    description={`¿Confirmar acción sobre &quot;${r.label}&quot;?`}
                    destructive={r.active}
                    confirmLabel={r.active ? 'Desactivar' : 'Activar'}
                    onConfirm={() => { toggleCatalogEntry(t.key, r.id); toast({ title: r.active ? 'Entrada desactivada' : 'Entrada activada' }); }}
                  />
                </div>
              )}
            />
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar entrada' : 'Nueva entrada'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormField label="Nombre" required error={errors.label?.message}>
              <Input {...register('label')} placeholder="Nombre" />
            </FormField>
            <FormField label="Código" required error={errors.code?.message}>
              <Input {...register('code')} placeholder="Código" />
            </FormField>
            <FormField label="Descripción">
              <Textarea {...register('description')} rows={2} placeholder="Descripción opcional" />
            </FormField>
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input type="checkbox" {...register('active')} className="h-4 w-4 rounded border-border-strong accent-brand-600" />
              Activo
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit">{editing ? 'Guardar' : 'Crear'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FormField({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 flex items-center gap-1 text-sm font-medium text-text-primary">{label}{required && <span className="text-danger">*</span>}</Label>
      {children}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
