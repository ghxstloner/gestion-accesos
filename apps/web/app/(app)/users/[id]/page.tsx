'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Save, Mail, Building2, ShieldCheck, Power, Pencil, KeyRound, Calendar } from 'lucide-react';
import { useSgaStore } from '@/lib/store';
import { PageHeader, DetailSection } from '@/components/shared/PageHeader';
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
import { ROLES, formatDate, formatDateTime } from '@/lib/constants';
import type { Role } from '@/lib/types';
import { toast } from '@/hooks/use-toast';

const schema = z.object({
  firstName: z.string().min(1, 'Obligatorio'),
  lastName: z.string().min(1, 'Obligatorio'),
  email: z.string().email('Correo inválido'),
  companyId: z.string().min(1, 'Obligatorio'),
  role: z.string().min(1, 'Obligatorio'),
});
type FormData = z.infer<typeof schema>;

export default function UserDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const user = useSgaStore((s) => s.users.find((u) => u.id === id));
  const companies = useSgaStore((s) => s.companies);
  const updateUser = useSgaStore((s) => s.updateUser);
  const toggleUserStatus = useSgaStore((s) => s.toggleUserStatus);
  const resetUserPassword = useSgaStore((s) => s.resetUserPassword);
  const [editing, setEditing] = useState(false);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (user) reset({ firstName: user.firstName, lastName: user.lastName, email: user.email, companyId: user.companyId, role: user.role });
  }, [user, reset]);

  if (!user) {
    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={() => router.push('/users')}><ArrowLeft className="mr-2 h-4 w-4" />Volver</Button>
        <p className="text-sm text-text-muted">Usuario no encontrado.</p>
      </div>
    );
  }

  const company = companies.find((c) => c.id === user.companyId);
  const onSave = (data: FormData) => {
    updateUser(id, { ...data, role: data.role as Role });
    setEditing(false);
    toast({ title: 'Usuario actualizado' });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${user.firstName} ${user.lastName}`}
        description={user.email}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push('/users')}><ArrowLeft className="mr-2 h-4 w-4" />Volver</Button>
            {editing ? (
              <Button onClick={handleSubmit(onSave)}><Save className="mr-2 h-4 w-4" />Guardar</Button>
            ) : (
              <Button variant="outline" onClick={() => setEditing(true)}><Pencil className="mr-2 h-4 w-4" />Editar</Button>
            )}
            <Button variant="outline" onClick={() => { resetUserPassword(id); toast({ title: 'Contraseña restablecida (simulado)' }); }}>
              <KeyRound className="mr-2 h-4 w-4" />Restablecer
            </Button>
            <ConfirmDialog
              trigger={<Button variant="outline"><Power className="mr-2 h-4 w-4" />{user.status === 'ACTIVE' ? 'Bloquear' : 'Activar'}</Button>}
              title={user.status === 'ACTIVE' ? 'Bloquear usuario' : 'Activar usuario'}
              description={`¿Confirmar acción sobre ${user.firstName} ${user.lastName}?`}
              destructive={user.status === 'ACTIVE'}
              onConfirm={() => { toggleUserStatus(id); toast({ title: 'Estado actualizado' }); }}
            />
          </div>
        }
      />

      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-lg font-semibold text-brand-700">
          {user.firstName[0]}{user.lastName[0]}
        </div>
        <div>
          <EntityStatusBadge status={user.status} />
          <p className="mt-1 text-xs text-text-muted">Creado el {formatDate(user.createdAt)}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <DetailSection title="Información del usuario" className="lg:col-span-2">
          {editing ? (
            <form onSubmit={handleSubmit(onSave)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Nombre" required error={errors.firstName?.message}><Input {...register('firstName')} /></FormField>
              <FormField label="Apellido" required error={errors.lastName?.message}><Input {...register('lastName')} /></FormField>
              <FormField label="Correo" required error={errors.email?.message} className="sm:col-span-2"><Input type="email" {...register('email')} /></FormField>
              <FormField label="Empresa" required error={errors.companyId?.message}>
                <Select value={watch('companyId')} onValueChange={(v) => setValue('companyId', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.tradeName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Rol" required error={errors.role?.message}>
                <Select value={watch('role')} onValueChange={(v) => setValue('role', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
              <div className="sm:col-span-2 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
                <Button type="submit"><Save className="mr-2 h-4 w-4" />Guardar</Button>
              </div>
            </form>
          ) : (
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InfoItem icon={Mail} label="Correo" value={user.email} />
              <InfoItem icon={Building2} label="Empresa" value={company?.tradeName ?? '—'} />
              <InfoItem icon={ShieldCheck} label="Rol" value={ROLES[user.role].label} />
              <InfoItem icon={Calendar} label="Último acceso" value={formatDateTime(user.lastAccess)} />
            </dl>
          )}
        </DetailSection>

        <DetailSection title="Resumen">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-muted">Estado</span>
              <EntityStatusBadge status={user.status} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-muted">Creado</span>
              <span className="text-sm font-medium text-text-primary">{formatDate(user.createdAt)}</span>
            </div>
          </div>
        </DetailSection>
      </div>
    </div>
  );
}

function InfoItem({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs font-medium text-text-muted"><Icon className="h-3.5 w-3.5" />{label}</dt>
      <dd className="mt-1 text-sm text-text-primary">{value}</dd>
    </div>
  );
}

function FormField({ label, required, error, children, className }: { label: string; required?: boolean; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="mb-1.5 flex items-center gap-1 text-sm font-medium text-text-primary">{label}{required && <span className="text-danger">*</span>}</Label>
      {children}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
