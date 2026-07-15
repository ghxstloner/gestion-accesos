"use client";

import { useState } from "react";
import { Plus, Pencil, Power, ListTree, ChevronRight } from "lucide-react";
import {
  useCatalogsQuery,
  useCatalogUpsertMutation,
  useToggleCatalogMutation,
  useUpdateCatalogMutation,
} from "@/hooks/api-hooks";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/LoadingSkeletons";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Badge } from "@/components/shared/StatusBadge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { CatalogEntry } from "@/lib/types";

type CatalogKey =
  | "requestTypes"
  | "idTypes"
  | "documentTypes"
  | "accessPoints"
  | "securityZones"
  | "accessAreas"
  | "rejectionReasons"
  | "genders"
  | "maritalStatuses"
  | "bloodTypes"
  | "nationalities";

const tabConfig: { key: CatalogKey; label: string }[] = [
  { key: "requestTypes", label: "Tipos de solicitud" },
  { key: "idTypes", label: "Tipos de identificación" },
  { key: "documentTypes", label: "Tipos de documentos" },
  { key: "accessPoints", label: "Puntos de acceso" },
  { key: "securityZones", label: "Zonas de seguridad" },
  { key: "accessAreas", label: "Áreas de acceso" },
  { key: "rejectionReasons", label: "Motivos de rechazo" },
  { key: "genders", label: "Géneros" },
  { key: "maritalStatuses", label: "Estados civiles" },
  { key: "bloodTypes", label: "Tipos de sangre" },
  { key: "nationalities", label: "Nacionalidades" },
];
const catalogKinds: Record<CatalogKey, string> = {
  requestTypes: "REQUEST_TYPE",
  idTypes: "IDENTIFICATION_TYPE",
  documentTypes: "DOCUMENT_TYPE",
  accessPoints: "ACCESS_POINT",
  securityZones: "SECURITY_ZONE",
  accessAreas: "ACCESS_AREA",
  rejectionReasons: "REJECTION_REASON",
  genders: "GENDER",
  maritalStatuses: "MARITAL_STATUS",
  bloodTypes: "BLOOD_TYPE",
  nationalities: "NATIONALITY",
};

const entrySchema = z.object({
  label: z.string().min(1, "Nombre obligatorio"),
  code: z.string().min(1, "Código obligatorio"),
  description: z.string().optional().default(""),
  active: z.boolean().default(true),
});
type EntryFormInput = z.input<typeof entrySchema>;
type EntryForm = z.output<typeof entrySchema>;

export default function CatalogsPage() {
  const [activeTab, setActiveTab] = useState<CatalogKey>("requestTypes");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogEntry | null>(null);
  const kind = catalogKinds[activeTab];
  const { data: catalogRows = [], isLoading } = useCatalogsQuery(kind);
  const createEntry = useCatalogUpsertMutation();
  const updateEntry = useUpdateCatalogMutation();
  const toggleEntry = useToggleCatalogMutation();
  const entries: CatalogEntry[] = catalogRows.map((row) => ({
    id: row.id,
    label: row.name,
    code: row.code,
    description: row.description ?? undefined,
    active: row.isActive,
  }));

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EntryFormInput, unknown, EntryForm>({
    resolver: zodResolver(entrySchema),
  });

  const openCreate = () => {
    setEditing(null);
    reset({ label: "", code: "", description: "", active: true });
    setDialogOpen(true);
  };

  const openEdit = (entry: CatalogEntry) => {
    setEditing(entry);
    reset({
      label: entry.label,
      code: entry.code,
      description: entry.description ?? "",
      active: entry.active,
    });
    setDialogOpen(true);
  };

  const onSubmit = async (data: EntryForm) => {
    if (editing) {
      await updateEntry.mutateAsync({
        kind,
        id: editing.id,
        name: data.label,
        code: data.code,
        description: data.description,
      });
      toast({ title: "Catálogo actualizado" });
    } else {
      await createEntry.mutateAsync({
        kind,
        name: data.label,
        code: data.code,
        description: data.description,
      });
      toast({ title: "Entrada creada" });
    }
    setDialogOpen(false);
  };

  const columns: Column<CatalogEntry>[] = [
    {
      key: "code",
      header: "Código",
      sortable: true,
      sortValue: (r) => r.code,
      cell: (r) => (
        <span className="text-text-secondary font-mono text-xs">{r.code}</span>
      ),
    },
    {
      key: "description",
      header: "Descripción",
      cell: (r) => (
        <span className="text-text-muted">{r.description ?? "—"}</span>
      ),
    },
    {
      key: "active",
      header: "Estado",
      sortable: true,
      sortValue: (r) => (r.active ? "1" : "0"),
      cell: (r) =>
        r.active ? (
          <Badge tone="success">Activo</Badge>
        ) : (
          <Badge tone="neutral">Inactivo</Badge>
        ),
    },
  ];

  if (isLoading) return <PageSkeleton variant="table" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Catálogos"
        description="Administración de catálogos del sistema"
      />

      <div className="lg:hidden">
        <Label className="mb-2 block text-xs font-bold text-text-secondary">
          Catálogo activo
        </Label>
        <Select
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as CatalogKey)}
        >
          <SelectTrigger className="h-11 rounded-xl bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {tabConfig.map((item) => (
              <SelectItem key={item.key} value={item.key}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="premium-card hidden self-start overflow-hidden rounded-2xl border border-border bg-white lg:block">
          <div className="border-b border-border-subtle px-4 py-4">
            <div className="flex items-center gap-2 text-sm font-bold text-brand-950">
              <ListTree className="h-4 w-4 text-brand-600" />
              Tipos de catálogo
            </div>
            <p className="mt-1 text-xs text-text-muted">
              Selecciona una categoría para administrarla.
            </p>
          </div>
          <nav className="space-y-1 p-2">
            {tabConfig.map((item) => {
              const selected = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveTab(item.key)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition ${selected ? "bg-brand-600 text-white shadow-md shadow-brand-600/20" : "text-text-secondary hover:bg-brand-50 hover:text-brand-800"}`}
                >
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${selected ? "bg-white" : "bg-brand-200"}`}
                  />
                  <span className="min-w-0 flex-1">{item.label}</span>
                  <ChevronRight
                    className={`h-3.5 w-3.5 ${selected ? "text-white/70" : "text-text-disabled"}`}
                  />
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="min-w-0 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.12em] text-brand-600">
                Catálogo
              </p>
              <h2 className="mt-1 text-xl font-bold text-text-primary">
                {tabConfig.find((item) => item.key === activeTab)?.label}
              </h2>
            </div>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Agregar entrada
            </Button>
          </div>
          <DataTable
            columns={columns}
            data={entries}
            emptyTitle="Sin entradas"
            rowActions={(r) => (
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => openEdit(r)}
                  title="Editar"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-surface-muted"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <ConfirmDialog
                  trigger={
                    <button
                      type="button"
                      title={r.active ? "Desactivar" : "Activar"}
                      className={`flex h-8 w-8 items-center justify-center rounded-md ${r.active ? "text-text-muted hover:bg-danger-soft hover:text-danger" : "text-text-muted hover:bg-success-soft hover:text-success"}`}
                    >
                      <Power className="h-4 w-4" />
                    </button>
                  }
                  title={r.active ? "Desactivar entrada" : "Activar entrada"}
                  description={`¿Confirmar acción sobre &quot;${r.label}&quot;?`}
                  destructive={r.active}
                  confirmLabel={r.active ? "Desactivar" : "Activar"}
                  onConfirm={async () => {
                    await toggleEntry.mutateAsync({
                      kind,
                      id: r.id,
                      activate: !r.active,
                    });
                    toast({
                      title: r.active
                        ? "Entrada desactivada"
                        : "Entrada activada",
                    });
                  }}
                />
              </div>
            )}
          />
        </section>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar entrada" : "Nueva entrada"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormField label="Nombre" required error={errors.label?.message}>
              <Input {...register("label")} placeholder="Nombre" />
            </FormField>
            <FormField label="Código" required error={errors.code?.message}>
              <Input {...register("code")} placeholder="Código" />
            </FormField>
            <FormField label="Descripción">
              <Textarea
                {...register("description")}
                rows={2}
                placeholder="Descripción opcional"
              />
            </FormField>
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                {...register("active")}
                className="h-4 w-4 rounded border-border-strong accent-brand-600"
              />
              Activo
            </label>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">{editing ? "Guardar" : "Crear"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FormField({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="mb-1.5 flex items-center gap-1 text-sm font-medium text-text-primary">
        {label}
        {required && <span className="text-danger">*</span>}
      </Label>
      {children}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
