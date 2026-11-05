"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Download, Eye, Save, Search } from "lucide-react";
import { PageHeader, FormSection } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
  useCreateCompanyMutation,
  useImportAitsaCompanyMutation,
  useSearchAitsaCompaniesMutation,
  type AitsaCompany,
} from "@/hooks/api-hooks";

const schema = z.object({
  legalName: z.string().min(1, "Razón social obligatoria"),
  tradeName: z.string(),
  taxId: z.string(),
  email: z.string().email("Correo inválido").or(z.literal("")),
  phone: z.string(),
  address: z.string(),
  primaryContact: z.string(),
  logoUrl: z.string().url("Ingresa una URL válida").or(z.literal("")),
});

type FormData = z.infer<typeof schema>;

export default function NewCompanyPage() {
  const router = useRouter();
  const createMutation = useCreateCompanyMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      legalName: "",
      tradeName: "",
      taxId: "",
      email: "",
      phone: "",
      address: "",
      primaryContact: "",
      logoUrl: "",
    },
  });

  const onSubmit = (data: FormData) => {
    createMutation.mutate(
      {
        legalName: data.legalName,
        tradeName: data.tradeName,
        taxIdentifier: data.taxId,
        email: data.email,
        phone: data.phone,
        address: data.address,
        mainContactName: data.primaryContact,
        logoUrl: data.logoUrl || undefined,
      },
      {
        onSuccess: (created) => {
          toast({
            title: "Empresa creada",
            description: created.tradeName ?? created.legalName,
          });
          router.push(`/companies/${created.id}`);
        },
        onError: (err) =>
          toast({
            title: "No se pudo crear la empresa",
            description: err instanceof Error ? err.message : undefined,
            variant: "destructive",
          }),
      },
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Crear empresa"
        description="Registro de una nueva empresa"
        actions={
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
        }
      />

      <AitsaSearchPanel />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="rounded-xl border border-border bg-surface p-6">
          <FormSection
            title="Información general"
            description="Datos básicos de la empresa"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Razón social"
                required
                error={errors.legalName?.message}
              >
                <Input {...register("legalName")} placeholder="Empresa S.A." />
              </Field>
              <Field label="Nombre comercial" error={errors.tradeName?.message}>
                <Input
                  {...register("tradeName")}
                  placeholder="Nombre comercial"
                />
              </Field>
              <Field label="Identificador fiscal" error={errors.taxId?.message}>
                <Input {...register("taxId")} placeholder="RUC / ID fiscal" />
              </Field>
              <Field
                label="Contacto principal"
                error={errors.primaryContact?.message}
              >
                <Input
                  {...register("primaryContact")}
                  placeholder="Nombre del contacto"
                />
              </Field>
            </div>
          </FormSection>

          <div className="mt-8">
            <FormSection title="Contacto" description="Datos de comunicación">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Correo" error={errors.email?.message}>
                  <Input
                    type="email"
                    {...register("email")}
                    placeholder="correo@empresa.com"
                  />
                </Field>
                <Field label="Teléfono" error={errors.phone?.message}>
                  <Input {...register("phone")} placeholder="+507 000-0000" />
                </Field>
                <Field
                  label="Dirección"
                  error={errors.address?.message}
                  className="sm:col-span-2"
                >
                  <Input
                    {...register("address")}
                    placeholder="Dirección física"
                  />
                </Field>
                <Field
                  label="Logo de la empresa (URL)"
                  error={errors.logoUrl?.message}
                  className="sm:col-span-2"
                >
                  <Input
                    {...register("logoUrl")}
                    placeholder="https://empresa.com/logo.svg"
                  />
                  <p className="mt-1 text-xs text-text-muted">
                    Opcional. SVG o PNG transparente ofrece el mejor resultado.
                  </p>
                </Field>
              </div>
            </FormSection>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            <Save className="mr-2 h-4 w-4" />
            {createMutation.isPending ? "Guardando…" : "Guardar empresa"}
          </Button>
        </div>
      </form>
    </div>
  );
}

/**
 * Busca la empresa en el padrón de AITSA (get-consulta-empresas) e importa el
 * registro tal cual; las empresas importadas quedan enlazadas por cliente_Id y
 * se mantienen al día con la sincronización.
 */
function AitsaSearchPanel() {
  const router = useRouter();
  const [mode, setMode] = useState<"ruc" | "nombre">("ruc");
  const [term, setTerm] = useState("");
  const searchMutation = useSearchAitsaCompaniesMutation();
  const importMutation = useImportAitsaCompanyMutation();
  const results = searchMutation.data;

  const runSearch = () => {
    const value = term.trim();
    if (!value) return;
    searchMutation.mutate(mode === "ruc" ? { ruc: value } : { nombre: value }, {
      onError: (err) =>
        toast({
          title: "No se pudo consultar AITSA",
          description: err instanceof Error ? err.message : undefined,
          variant: "destructive",
        }),
    });
  };

  const importCompany = (row: AitsaCompany) => {
    importMutation.mutate(row.clienteId, {
      onSuccess: (company) => {
        toast({
          title: row.importedCompanyId
            ? "Empresa actualizada desde AITSA"
            : "Empresa importada desde AITSA",
          description: company.legalName,
        });
        router.push(`/companies/${company.id}`);
      },
      onError: (err) =>
        toast({
          title: "No se pudo importar la empresa",
          description: err instanceof Error ? err.message : undefined,
          variant: "destructive",
        }),
    });
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <FormSection
        title="Buscar en AITSA"
        description="Importe la empresa desde el padrón de clientes de AITSA para evitar capturarla a mano"
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex gap-2">
            {(["ruc", "nombre"] as const).map((m) => (
              <button
                type="button"
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                  mode === m
                    ? "border-brand-300 bg-brand-50 text-brand-700"
                    : "border-border bg-surface text-text-muted hover:bg-surface-muted"
                }`}
              >
                {m === "ruc" ? "RUC" : "Razón social"}
              </button>
            ))}
          </div>
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                runSearch();
              }
            }}
            placeholder={mode === "ruc" ? "28726-117-524" : "AMERICAN AIRLINES"}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            onClick={runSearch}
            disabled={searchMutation.isPending || !term.trim()}
          >
            <Search className="mr-2 h-4 w-4" />
            {searchMutation.isPending ? "Buscando…" : "Buscar"}
          </Button>
        </div>

        {results && results.length === 0 && (
          <p className="mt-4 text-sm text-text-muted">
            No se encontraron empresas en AITSA con ese criterio.
          </p>
        )}
        {results && results.length > 0 && (
          <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
            {results.map((row) => (
              <li
                key={row.clienteId}
                className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-text-primary">
                    {row.nombre}
                    {row.nombreComercial && (
                      <span className="ml-2 text-xs font-normal text-text-muted">
                        {row.nombreComercial}
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-text-muted">
                    {row.clienteId}
                    {row.ruc && ` · RUC ${row.ruc}`}
                    {row.dv && ` DV ${row.dv}`}
                    {row.contacto && ` · ${row.contacto}`}
                    {row.estado && ` · ${row.estado}`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {row.importedCompanyId && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        router.push(`/companies/${row.importedCompanyId}`)
                      }
                    >
                      <Eye className="mr-1.5 h-4 w-4" />
                      Ver
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant={row.importedCompanyId ? "outline" : "default"}
                    disabled={importMutation.isPending}
                    onClick={() => importCompany(row)}
                  >
                    <Download className="mr-1.5 h-4 w-4" />
                    {row.importedCompanyId ? "Actualizar" : "Importar"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </FormSection>
    </div>
  );
}

function Field({
  label,
  required,
  error,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 flex items-center gap-1 text-sm font-medium text-text-primary">
        {label}
        {required && <span className="text-danger">*</span>}
      </Label>
      {children}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
