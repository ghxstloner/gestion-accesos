'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Save } from 'lucide-react';
import { useSgaStore, useCurrentUserData } from '@/lib/store';
import { useCompaniesQuery, useCreateUserMutation, useUsersQuery } from '@/hooks/api-hooks';
import { PageHeader, FormSection } from '@/components/shared/PageHeader';
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
import { ROLES } from '@/lib/constants';
import type { Role } from '@/lib/types';
import { toast } from '@/hooks/use-toast';

export default function NewUserPage() {
  const router = useRouter();
  const { data: companies = [] } = useCompaniesQuery();
  const { data: users = [] } = useUsersQuery();
  const createUser = useCreateUserMutation();
  const userData = useCurrentUserData();
  const role = useSgaStore((s) => s.currentUser?.role);
  const [submitting, setSubmitting] = useState(false);

  const isCompanyAdmin = role === 'ADMIN_EMPRESA' && userData;
  // Roles a company admin can assign (no global escalate)
  const allowedRoles = isCompanyAdmin
    ? Object.entries(ROLES).filter(([k]) => k !== 'ADMIN_GENERAL')
    : Object.entries(ROLES);
  const initialCompany = isCompanyAdmin ? userData!.companyId : '';
  const initialRole = isCompanyAdmin ? 'SOLICITANTE' : 'SOLICITANTE';

  // Zod schema built per-render so it can read fresh `users` from the store
  // and enforce email uniqueness inline.
  const schema = z.object({
    firstName: z.string().min(1, 'Nombre obligatorio'),
    lastName: z.string().min(1, 'Apellido obligatorio'),
    email: z
      .string()
      .email('Correo inválido')
      .refine(
        (v) =>
          !users.some(
            (u) => u.email.trim().toLowerCase() === v.trim().toLowerCase()
          ),
        { message: 'Ya existe un usuario con ese correo.' }
      ),
    password: z.string().min(8, 'Mínimo 8 caracteres'),
    companyId: z.string().min(1, 'Empresa obligatoria'),
    role: z.string().min(1, 'Rol obligatorio'),
  });
  type FormData = z.infer<typeof schema>;

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: '', lastName: '', email: '', password: '', companyId: initialCompany, role: initialRole },
  });

  const companyId = watch('companyId');
  const selectedRole = watch('role');

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      const user = await createUser.mutateAsync({ ...data, role: data.role as Role });
      toast({ title: 'Usuario creado', description: `${user.firstName} ${user.lastName}` });
      router.push(`/users/${user.id}`);
    } catch (err) {
      toast({
        title: 'No se pudo crear el usuario',
        description: err instanceof Error ? err.message : 'Error inesperado',
        variant: 'destructive',
      });
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Crear usuario"
        description="Registro de un nuevo usuario del sistema"
        actions={<Button variant="outline" onClick={() => router.back()}><ArrowLeft className="mr-2 h-4 w-4" />Volver</Button>}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="rounded-xl border border-border bg-surface p-6">
          <FormSection title="Información personal" description="Datos del usuario">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nombre" required error={errors.firstName?.message}>
                <Input {...register('firstName')} placeholder="Nombre" />
              </Field>
              <Field label="Apellido" required error={errors.lastName?.message}>
                <Input {...register('lastName')} placeholder="Apellido" />
              </Field>
              <Field label="Correo" required error={errors.email?.message} className="sm:col-span-2">
                <Input type="email" {...register('email')} placeholder="correo@empresa.com" />
              </Field>
              <Field label="Contraseña temporal" required error={errors.password?.message} className="sm:col-span-2">
                <Input type="password" {...register('password')} autoComplete="new-password" />
              </Field>
            </div>
          </FormSection>

          <div className="mt-8">
            <FormSection title="Asignación" description="Empresa y rol del usuario">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Empresa" required error={errors.companyId?.message}>
                  <Select value={companyId} onValueChange={(v) => setValue('companyId', v)} disabled={!!isCompanyAdmin}>
                    <SelectTrigger><SelectValue placeholder="Seleccione empresa" /></SelectTrigger>
                    <SelectContent>
                      {(isCompanyAdmin ? companies.filter((c) => c.id === userData!.companyId) : companies).map((c) => <SelectItem key={c.id} value={c.id}>{c.tradeName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Rol" required error={errors.role?.message}>
                  <Select value={selectedRole} onValueChange={(v) => setValue('role', v)}>
                    <SelectTrigger><SelectValue placeholder="Seleccione rol" /></SelectTrigger>
                    <SelectContent>
                      {allowedRoles.map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </FormSection>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
          <Button type="submit" disabled={submitting}><Save className="mr-2 h-4 w-4" />Guardar usuario</Button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, required, error, children, className }: { label: string; required?: boolean; error?: string; children: React.ReactNode; className?: string }) {
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
