'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSgaStore, useCurrentUserData } from '@/lib/store';
import { useCatalogsQuery, useCompaniesQuery, usePeopleQuery } from '@/hooks/api-hooks';
import { FormSection } from '@/components/shared/PageHeader';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { calcAge } from '@/lib/constants';
import type { EntityStatus, Person, IdType, Gender, CivilStatus, BloodType } from '@/lib/types';

const schema = z.object({
  firstName: z.string().min(1, 'Primer nombre obligatorio'),
  middleName: z.string().optional().default(''),
  firstLastName: z.string().min(1, 'Primer apellido obligatorio'),
  secondLastName: z.string().optional().default(''),
  marriedLastName: z.string().optional().default(''),
  idType: z.string().min(1, 'Tipo obligatorio'),
  idNumber: z.string().min(1, 'Identificación obligatoria'),
  socialSecurityNumber: z.string().optional().default(''),
  birthDate: z.string().min(1, 'Fecha obligatoria'),
  gender: z.string().min(1, 'Género obligatorio'),
  civilStatus: z.string().min(1, 'Estado civil obligatorio'),
  nationality: z.string().min(1, 'Nacionalidad obligatoria'),
  bloodType: z.string().optional().default(''),
  mobile: z.string().min(1, 'Celular obligatorio'),
  phone: z.string().optional().default(''),
  email: z.string().email('Correo inválido'),
  address: z.string().min(1, 'Dirección obligatoria'),
  physicalAilment: z.string().optional().default(''),
  companyId: z.string().min(1, 'Empresa obligatoria'),
  department: z.string().min(1, 'Departamento obligatorio'),
  position: z.string().min(1, 'Cargo obligatorio'),
  yearsOfService: z.coerce.number().min(0, 'Inválido'),
  workedAtAirportBefore: z.boolean(),
  previousCompany: z.string().optional().default(''),
  hadPreviousCard: z.boolean(),
  reusePhoto: z.boolean(),
  status: z.string(),
});
export type PersonFormData = z.output<typeof schema>;
type PersonFormInput = z.input<typeof schema>;

export function PersonForm({
  onSubmit,
  defaultValues,
  onSaved,
}: {
  onSubmit: (data: Omit<Person, 'id' | 'createdAt'>) => Promise<string>;
  defaultValues?: Partial<Person>;
  onSaved: (id: string) => void;
}) {
  const { data: companies = [] } = useCompaniesQuery();
  const userData = useCurrentUserData();
  const role = useSgaStore((s) => s.currentUser?.role);
  const { data: people = [] } = usePeopleQuery();
  const { data: identificationTypes = [] } = useCatalogsQuery('IDENTIFICATION_TYPE');
  const { data: genders = [] } = useCatalogsQuery('GENDER');
  const { data: maritalStatuses = [] } = useCatalogsQuery('MARITAL_STATUS');
  const { data: bloodTypes = [] } = useCatalogsQuery('BLOOD_TYPE');
  const { data: nationalities = [] } = useCatalogsQuery('NATIONALITY');

  const isCompanyAdmin = role === 'ADMIN_EMPRESA';
  const preselectedCompany = isCompanyAdmin ? userData?.companyId : undefined;

  const { register, handleSubmit, setValue, watch, setError, formState: { errors } } = useForm<PersonFormInput, unknown, PersonFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: '',
      firstLastName: '',
      idType: 'CEDULA',
      idNumber: '',
      birthDate: '',
      gender: 'MASCULINO',
      civilStatus: 'SOLTERO',
      nationality: 'Panameña',
      mobile: '',
      email: '',
      address: '',
      companyId: preselectedCompany ?? '',
      department: '',
      position: '',
      yearsOfService: 0,
      workedAtAirportBefore: false,
      hadPreviousCard: false,
      reusePhoto: false,
      status: 'ACTIVE',
      ...defaultValues,
    },
  });

  const companyId = watch('companyId');
  const birthDate = watch('birthDate');
  const age = calcAge(birthDate);

  const handleValid = async (data: PersonFormData) => {
    // Unique idNumber check
    const existing = people.find((p) => p.idNumber === data.idNumber && p.id !== defaultValues?.id);
    if (existing) {
      setError('idNumber', { message: 'Ya existe una persona con esta identificación' });
      return;
    }
    const payload: Omit<Person, 'id' | 'createdAt'> = {
      firstName: data.firstName,
      middleName: data.middleName,
      firstLastName: data.firstLastName,
      secondLastName: data.secondLastName,
      marriedLastName: data.marriedLastName,
      idType: data.idType as IdType,
      idNumber: data.idNumber,
      socialSecurityNumber: data.socialSecurityNumber,
      birthDate: data.birthDate,
      gender: data.gender as Gender,
      civilStatus: data.civilStatus as CivilStatus,
      nationality: data.nationality,
      bloodType: data.bloodType as BloodType,
      phone: data.phone,
      mobile: data.mobile,
      email: data.email,
      address: data.address,
      physicalAilment: data.physicalAilment,
      companyId: data.companyId,
      department: data.department,
      position: data.position,
      yearsOfService: data.yearsOfService,
      workedAtAirportBefore: data.workedAtAirportBefore,
      previousCompany: data.previousCompany,
      hadPreviousCard: data.hadPreviousCard,
      reusePhoto: data.reusePhoto,
      status: (data.status || 'ACTIVE') as EntityStatus,
    };
    const id = await onSubmit(payload);
    onSaved(id);
  };

  return (
    <form onSubmit={handleSubmit(handleValid)} id="person-form" className="space-y-8">
      <FormSection title="Información personal" description="Datos de identificación de la persona">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Primer nombre" required error={errors.firstName?.message}>
            <Input {...register('firstName')} />
          </Field>
          <Field label="Segundo nombre">
            <Input {...register('middleName')} />
          </Field>
          <Field label="Apellido de casada">
            <Input {...register('marriedLastName')} />
          </Field>
          <Field label="Primer apellido" required error={errors.firstLastName?.message}>
            <Input {...register('firstLastName')} />
          </Field>
          <Field label="Segundo apellido">
            <Input {...register('secondLastName')} />
          </Field>
          <Field label="Tipo de identificación" required error={errors.idType?.message}>
            <Select value={watch('idType')} onValueChange={(v) => setValue('idType', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {identificationTypes.filter((item) => item.isActive).map((item) => <SelectItem key={item.id} value={item.code}>{item.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Número de identificación" required error={errors.idNumber?.message}>
            <Input {...register('idNumber')} placeholder="0-000-000" />
          </Field>
          <Field label="Número de seguro social">
            <Input {...register('socialSecurityNumber')} placeholder="00-000-000" />
          </Field>
          <Field label="Fecha de nacimiento" required error={errors.birthDate?.message}>
            <Input type="date" {...register('birthDate')} />
            {age !== null && <p className="mt-1 text-xs text-text-muted">{age} años</p>}
          </Field>
          <Field label="Género" required error={errors.gender?.message}>
            <Select value={watch('gender')} onValueChange={(v) => setValue('gender', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {genders.filter((item) => item.isActive).map((item) => <SelectItem key={item.id} value={item.code}>{item.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Estado civil" required error={errors.civilStatus?.message}>
            <Select value={watch('civilStatus')} onValueChange={(v) => setValue('civilStatus', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {maritalStatuses.filter((item) => item.isActive).map((item) => <SelectItem key={item.id} value={item.code}>{item.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Nacionalidad" required error={errors.nationality?.message}>
            <Select value={watch('nationality')} onValueChange={(v) => setValue('nationality', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {nationalities.filter((item) => item.isActive).map((item) => <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Tipo de sangre">
            <Select value={watch('bloodType') ?? ''} onValueChange={(v) => setValue('bloodType', v)}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                {bloodTypes.filter((item) => item.isActive).map((item) => <SelectItem key={item.id} value={item.code}>{item.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </FormSection>

      <FormSection title="Contacto" description="Datos de comunicación">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Teléfono">
            <Input {...register('phone')} placeholder="+507 000-0000" />
          </Field>
          <Field label="Celular" required error={errors.mobile?.message}>
            <Input {...register('mobile')} placeholder="+507 6000-0000" />
          </Field>
          <Field label="Correo" required error={errors.email?.message}>
            <Input type="email" {...register('email')} placeholder="correo@empresa.com" />
          </Field>
          <Field label="Dirección residencial" required error={errors.address?.message} className="sm:col-span-2 lg:col-span-3">
            <Input {...register('address')} />
          </Field>
          <Field label="Padecimiento físico" className="sm:col-span-2 lg:col-span-3">
            <Input {...register('physicalAilment')} placeholder="Indique si aplica" />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Información laboral" description="Empresa, cargo y antecedentes">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Empresa" required error={errors.companyId?.message}>
            <Select value={companyId} onValueChange={(v) => setValue('companyId', v)} disabled={isCompanyAdmin}>
              <SelectTrigger><SelectValue placeholder="Seleccione empresa" /></SelectTrigger>
              <SelectContent>
                {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.tradeName}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Departamento" required error={errors.department?.message}>
            <Input {...register('department')} />
          </Field>
          <Field label="Cargo" required error={errors.position?.message}>
            <Input {...register('position')} />
          </Field>
          <Field label="Años de servicio" required error={errors.yearsOfService?.message}>
            <Input type="number" min={0} {...register('yearsOfService')} />
          </Field>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input type="checkbox" {...register('workedAtAirportBefore')} className="h-4 w-4 rounded border-border-strong accent-brand-600" />
              Trabajó anteriormente en el aeropuerto
            </label>
          </div>
          <Field label="Empresa anterior">
            <Input {...register('previousCompany')} placeholder="Si aplica" />
          </Field>
        </div>
        <div className="flex flex-wrap gap-6 pt-2">
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input type="checkbox" {...register('hadPreviousCard')} className="h-4 w-4 rounded border-border-strong accent-brand-600" />
            Tuvo carné anteriormente
          </label>
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input type="checkbox" {...register('reusePhoto')} className="h-4 w-4 rounded border-border-strong accent-brand-600" />
            Desea reutilizar fotografía
          </label>
        </div>
      </FormSection>
    </form>
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
