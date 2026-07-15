"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Save } from "lucide-react";
import { PageHeader, FormSection } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useCreateCompanyMutation } from "@/hooks/api-hooks";

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
