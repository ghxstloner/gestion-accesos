'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Save, Building2, Mail, Phone, MapPin, User, Power, Pencil } from 'lucide-react';
import { useSgaStore } from '@/lib/store';
import { PageHeader, DetailSection } from '@/components/shared/PageHeader';
import { EntityStatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/constants';

const schema = z.object({
  legalName: z.string().min(1, 'Obligatorio'),
  tradeName: z.string().min(1, 'Obligatorio'),
  taxId: z.string().min(1, 'Obligatorio'),
  email: z.string().email('Correo inválido'),
  phone: z.string().min(1, 'Obligatorio'),
  address: z.string().min(1, 'Obligatorio'),
  primaryContact: z.string().min(1, 'Obligatorio'),
});
type FormData = z.infer<typeof schema>;

export default function CompanyDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const company = useSgaStore((s) => s.companies.find((c) => c.id === id));
  const updateCompany = useSgaStore((s) => s.updateCompany);
  const toggleCompanyStatus = useSgaStore((s) => s.toggleCompanyStatus);
  const users = useSgaStore((s) => s.users.filter((u) => u.companyId === id));
  const people = useSgaStore((s) => s.people.filter((p) => p.companyId === id));
  const requests = useSgaStore((s) => s.requests.filter((r) => r.companyId === id));
  const [editing, setEditing] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (company) {
      reset({
        legalName: company.legalName,
        tradeName: company.tradeName,
        taxId: company.taxId,
        email: company.email,
        phone: company.phone,
        address: company.address,
        primaryContact: company.primaryContact,
      });
    }
  }, [company, reset]);

  if (!company) {
    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={() => router.push('/companies')}><ArrowLeft className="mr-2 h-4 w-4" />Volver</Button>
        <p className="text-sm text-text-muted">Empresa no encontrada.</p>
      </div>
    );
  }

  const onSave = (data: FormData) => {
    updateCompany(id, data);
    setEditing(false);
    toast({ title: 'Empresa actualizada' });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={company.tradeName}
        description={company.legalName}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push('/companies')}>
              <ArrowLeft className="mr-2 h-4 w-4" />Volver
            </Button>
            {editing ? (
              <Button onClick={handleSubmit(onSave)}><Save className="mr-2 h-4 w-4" />Guardar</Button>
            ) : (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="mr-2 h-4 w-4" />Editar
              </Button>
            )}
            <ConfirmDialog
              trigger={<Button variant="outline"><Power className="mr-2 h-4 w-4" />{company.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}</Button>}
              title={company.status === 'ACTIVE' ? 'Desactivar empresa' : 'Activar empresa'}
              description={`¿Confirmar acción sobre "${company.tradeName}"?`}
              destructive={company.status === 'ACTIVE'}
              onConfirm={() => { toggleCompanyStatus(id); toast({ title: 'Estado actualizado' }); }}
            />
          </div>
        }
      />

      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <Building2 className="h-7 w-7" />
        </div>
        <div>
          <EntityStatusBadge status={company.status} />
          <p className="mt-1 text-xs text-text-muted">Creada el {formatDate(company.createdAt)}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <DetailSection title="Información general" className="lg:col-span-2">
          {editing ? (
            <form onSubmit={handleSubmit(onSave)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Razón social" required error={errors.legalName?.message}>
                <Input {...register('legalName')} />
              </FormField>
              <FormField label="Nombre comercial" required error={errors.tradeName?.message}>
                <Input {...register('tradeName')} />
              </FormField>
              <FormField label="Identificador fiscal" required error={errors.taxId?.message}>
                <Input {...register('taxId')} />
              </FormField>
              <FormField label="Contacto principal" required error={errors.primaryContact?.message}>
                <Input {...register('primaryContact')} />
              </FormField>
              <FormField label="Correo" required error={errors.email?.message}>
                <Input type="email" {...register('email')} />
              </FormField>
              <FormField label="Teléfono" required error={errors.phone?.message}>
                <Input {...register('phone')} />
              </FormField>
              <FormField label="Dirección" required error={errors.address?.message} className="sm:col-span-2">
                <Input {...register('address')} />
              </FormField>
              <div className="sm:col-span-2 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
                <Button type="submit"><Save className="mr-2 h-4 w-4" />Guardar</Button>
              </div>
            </form>
          ) : (
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InfoItem icon={Building2} label="Razón social" value={company.legalName} />
              <InfoItem icon={Building2} label="Nombre comercial" value={company.tradeName} />
              <InfoItem icon={Building2} label="Identificador fiscal" value={company.taxId} />
              <InfoItem icon={User} label="Contacto principal" value={company.primaryContact} />
              <InfoItem icon={Mail} label="Correo" value={company.email} />
              <InfoItem icon={Phone} label="Teléfono" value={company.phone} />
              <InfoItem icon={MapPin} label="Dirección" value={company.address} className="sm:col-span-2" />
            </dl>
          )}
        </DetailSection>

        <div className="space-y-6">
          <DetailSection title="Resumen">
            <div className="space-y-3">
              <Stat label="Usuarios" value={users.length} />
              <Stat label="Personas" value={people.length} />
              <Stat label="Solicitudes" value={requests.length} />
            </div>
          </DetailSection>
        </div>
      </div>
    </div>
  );
}

function InfoItem({ icon: Icon, label, value, className }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <dt className="flex items-center gap-1.5 text-xs font-medium text-text-muted">
        <Icon className="h-3.5 w-3.5" />{label}
      </dt>
      <dd className="mt-1 text-sm text-text-primary">{value}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-text-muted">{label}</span>
      <span className="text-lg font-semibold text-text-primary">{value}</span>
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
