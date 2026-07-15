'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Save } from 'lucide-react';
import { PageHeader, FormSection } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { useCreateCompanyMutation } from '@/hooks/api-hooks';

const schema = z.object({
  legalName: z.string().min(1, 'Razón social obligatoria'),
  tradeName: z.string().min(1, 'Nombre comercial obligatorio'),
  taxId: z.string().min(1, 'Identificador fiscal obligatorio'),
  email: z.string().email('Correo inválido'),
  phone: z.string().min(1, 'Teléfono obligatorio'),
  address: z.string().min(1, 'Dirección obligatoria'),
  primaryContact: z.string().min(1, 'Contacto principal obligatorio'),
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
    defaultValues: { legalName: '', tradeName: '', taxId: '', email: '', phone: '', address: '', primaryContact: '' },
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
      },
      {
        onSuccess: (created) => {
          toast({
            title: 'Empresa creada',
            description: created.tradeName ?? created.legalName,
          });
          router.push(`/companies/${created.id}`);
        },
        onError: (err) =>
          toast({
            title: 'No se pudo crear la empresa',
            description: err instanceof Error ? err.message : undefined,
            variant: 'destructive',
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
            <ArrowLeft className="mr-2 h-4 w-4" />Volver
          </Button>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="rounded-xl border border-border bg-surface p-6">
          <FormSection title="Información general" description="Datos básicos de la empresa">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Razón social" required error={errors.legalName?.message}>
                <Input {...register('legalName')} placeholder="Empresa S.A." />
              </Field>
              <Field label="Nombre comercial" required error={errors.tradeName?.message}>
                <Input {...register('tradeName')} placeholder="Nombre comercial" />
              </Field>
              <Field label="Identificador fiscal" required error={errors.taxId?.message}>
                <Input {...register('taxId')} placeholder="RUC / ID fiscal" />
              </Field>
              <Field label="Contacto principal" required error={errors.primaryContact?.message}>
                <Input {...register('primaryContact')} placeholder="Nombre del contacto" />
              </Field>
            </div>
          </FormSection>

          <div className="mt-8">
            <FormSection title="Contacto" description="Datos de comunicación">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Correo" required error={errors.email?.message}>
                  <Input type="email" {...register('email')} placeholder="correo@empresa.com" />
                </Field>
                <Field label="Teléfono" required error={errors.phone?.message}>
                  <Input {...register('phone')} placeholder="+507 000-0000" />
                </Field>
                <Field label="Dirección" required error={errors.address?.message} className="sm:col-span-2">
                  <Input {...register('address')} placeholder="Dirección física" />
                </Field>
              </div>
            </FormSection>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
          <Button type="submit" disabled={createMutation.isPending}>
            <Save className="mr-2 h-4 w-4" />
            {createMutation.isPending ? 'Guardando…' : 'Guardar empresa'}
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
