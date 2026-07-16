"use client";

import { useForm } from "react-hook-form";
import { useState } from "react";
import Image from "next/image";
import { Camera, UploadCloud } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSgaStore, useCurrentUserData } from "@/lib/store";
import {
  useCatalogsQuery,
  useCompaniesQuery,
  usePeopleQuery,
  useUploadPersonPhotoMutation,
} from "@/hooks/api-hooks";
import { resolveApiAsset } from "@/lib/api-config";
import { FormSection } from "@/components/shared/PageHeader";
import { DatePicker } from "@/components/shared/DatePicker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { calcAge } from "@/lib/constants";
import type {
  EntityStatus,
  Person,
  IdType,
  Gender,
  CivilStatus,
  BloodType,
} from "@/lib/types";

const schema = z.object({
  firstName: z.string().min(1, "Primer nombre obligatorio"),
  middleName: z.string().optional().default(""),
  firstLastName: z.string().min(1, "Primer apellido obligatorio"),
  secondLastName: z.string().optional().default(""),
  marriedLastName: z.string().optional().default(""),
  idType: z.string().min(1, "Tipo obligatorio"),
  idNumber: z.string().min(1, "Identificación obligatoria"),
  socialSecurityNumber: z.string().optional().default(""),
  birthDate: z.string(),
  gender: z.string(),
  civilStatus: z.string(),
  nationality: z.string(),
  bloodType: z.string().optional().default(""),
  mobile: z.string(),
  phone: z.string().optional().default(""),
  email: z.string().email("Correo inválido").or(z.literal("")),
  address: z.string(),
  physicalAilment: z.string().optional().default(""),
  companyId: z.string().min(1, "Empresa obligatoria"),
  department: z.string(),
  position: z.string(),
  yearsOfService: z.coerce.number().min(0, "Inválido"),
  workedAtAirportBefore: z.boolean(),
  previousCompany: z.string().optional().default(""),
  hadPreviousCard: z.boolean(),
  reusePhoto: z.boolean(),
  status: z.string(),
  createApplicantAccount: z.boolean(),
});
export type PersonFormData = z.output<typeof schema>;
type PersonFormInput = z.input<typeof schema>;

export function PersonForm({
  onSubmit,
  defaultValues,
  onSaved,
}: {
  onSubmit: (data: Omit<Person, "id" | "createdAt">) => Promise<string>;
  defaultValues?: Partial<Person>;
  onSaved: (id: string) => void;
}) {
  const { data: companies = [] } = useCompaniesQuery();
  const userData = useCurrentUserData();
  const role = useSgaStore((s) => s.currentUser?.role);
  const { data: people = [] } = usePeopleQuery();
  const { data: identificationTypes = [] } = useCatalogsQuery(
    "IDENTIFICATION_TYPE",
  );
  const { data: genders = [] } = useCatalogsQuery("GENDER");
  const { data: maritalStatuses = [] } = useCatalogsQuery("MARITAL_STATUS");
  const { data: bloodTypes = [] } = useCatalogsQuery("BLOOD_TYPE");
  const { data: nationalities = [] } = useCatalogsQuery("NATIONALITY");
  const uploadPhoto = useUploadPersonPhotoMutation();
  const [photo, setPhoto] = useState<File | null>(null);

  const isCompanyAdmin = role === "ADMIN_EMPRESA";
  const preselectedCompany = isCompanyAdmin ? userData?.companyId : undefined;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors },
  } = useForm<PersonFormInput, unknown, PersonFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: "",
      firstLastName: "",
      idType: "CEDULA",
      idNumber: "",
      birthDate: "",
      gender: "MASCULINO",
      civilStatus: "SOLTERO",
      nationality: "Panameña",
      mobile: "",
      email: "",
      address: "",
      companyId: preselectedCompany ?? "",
      department: "",
      position: "",
      yearsOfService: 0,
      workedAtAirportBefore: false,
      hadPreviousCard: false,
      reusePhoto: false,
      status: "ACTIVE",
      createApplicantAccount: false,
      ...defaultValues,
    },
  });

  const companyId = watch("companyId");
  const birthDate = watch("birthDate");
  const age = calcAge(birthDate);

  const handleValid = async (data: PersonFormData) => {
    // Unique idNumber check
    const existing = people.find(
      (p) => p.idNumber === data.idNumber && p.id !== defaultValues?.id,
    );
    if (existing) {
      setError("idNumber", {
        message: "Ya existe una persona con esta identificación",
      });
      return;
    }
    const payload: Omit<Person, "id" | "createdAt"> = {
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
      status: (data.status || "ACTIVE") as EntityStatus,
      createApplicantAccount: data.createApplicantAccount,
    };
    const id = await onSubmit(payload);
    if (photo) await uploadPhoto.mutateAsync({ id, file: photo });
    onSaved(id);
  };

  return (
    <form
      onSubmit={handleSubmit(handleValid)}
      id="person-form"
      className="space-y-8"
    >
      <div className="flex flex-col gap-4 rounded-2xl border border-brand-100 bg-brand-50/50 p-4 sm:flex-row sm:items-center">
        <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-white shadow-sm">
          {defaultValues?.photoUrl ? (
            <Image
              src={resolveApiAsset(defaultValues.photoUrl)}
              alt="Foto de la persona"
              fill
              sizes="96px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <Camera className="h-8 w-8 text-brand-600" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-text-primary">
            Fotografía de la persona
          </p>
          <p className="mt-1 truncate text-xs text-text-muted">
            {photo?.name ?? "PNG, JPG o WEBP · máximo 3 MB"}
          </p>
          <label className="mt-3 inline-flex cursor-pointer items-center rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:brightness-95">
            <UploadCloud className="mr-2 h-4 w-4" />
            Seleccionar fotografía
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
            />
          </label>
        </div>
      </div>

      <FormSection
        title="Información personal"
        description="Datos de identificación de la persona"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label="Primer nombre"
            required
            error={errors.firstName?.message}
          >
            <Input {...register("firstName")} />
          </Field>
          <Field label="Segundo nombre">
            <Input {...register("middleName")} />
          </Field>
          <Field label="Apellido de casada">
            <Input {...register("marriedLastName")} />
          </Field>
          <Field
            label="Primer apellido"
            required
            error={errors.firstLastName?.message}
          >
            <Input {...register("firstLastName")} />
          </Field>
          <Field label="Segundo apellido">
            <Input {...register("secondLastName")} />
          </Field>
          <Field
            label="Tipo de identificación"
            required
            error={errors.idType?.message}
          >
            <Select
              value={watch("idType")}
              onValueChange={(v) => setValue("idType", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {identificationTypes
                  .filter((item) => item.isActive)
                  .map((item) => (
                    <SelectItem key={item.id} value={item.code}>
                      {item.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            label="Número de identificación"
            required
            error={errors.idNumber?.message}
          >
            <Input {...register("idNumber")} placeholder="0-000-000" />
          </Field>
          <Field label="Número de seguro social">
            <Input
              {...register("socialSecurityNumber")}
              placeholder="00-000-000"
            />
          </Field>
          <Field label="Fecha de nacimiento" error={errors.birthDate?.message}>
            <DatePicker
              value={watch("birthDate")}
              onChange={(value) =>
                setValue("birthDate", value, { shouldValidate: true })
              }
              placeholder="Fecha de nacimiento"
              defaultMonth={new Date(2000, 0, 1)}
            />
            {age !== null && (
              <p className="mt-1 text-xs text-text-muted">{age} años</p>
            )}
          </Field>
          <Field label="Género" error={errors.gender?.message}>
            <Select
              value={watch("gender")}
              onValueChange={(v) => setValue("gender", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {genders
                  .filter((item) => item.isActive)
                  .map((item) => (
                    <SelectItem key={item.id} value={item.code}>
                      {item.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Estado civil" error={errors.civilStatus?.message}>
            <Select
              value={watch("civilStatus")}
              onValueChange={(v) => setValue("civilStatus", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {maritalStatuses
                  .filter((item) => item.isActive)
                  .map((item) => (
                    <SelectItem key={item.id} value={item.code}>
                      {item.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Nacionalidad" error={errors.nationality?.message}>
            <Select
              value={watch("nationality")}
              onValueChange={(v) => setValue("nationality", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {nationalities
                  .filter((item) => item.isActive)
                  .map((item) => (
                    <SelectItem key={item.id} value={item.name}>
                      {item.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Tipo de sangre">
            <Select
              value={watch("bloodType") ?? ""}
              onValueChange={(v) => setValue("bloodType", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {bloodTypes
                  .filter((item) => item.isActive)
                  .map((item) => (
                    <SelectItem key={item.id} value={item.code}>
                      {item.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </FormSection>

      {!defaultValues?.id && (
        <label className="flex items-start gap-3 rounded-2xl border border-brand-100 bg-brand-50/60 p-4">
          <input
            type="checkbox"
            {...register("createApplicantAccount")}
            className="mt-0.5 h-4 w-4 accent-brand-600"
          />
          <span>
            <span className="block text-sm font-bold text-text-primary">
              Crear acceso como solicitante
            </span>
            <span className="mt-1 block text-xs text-text-muted">
              Genera un usuario con rol Solicitante y una contraseña temporal
              que deberá cambiar al ingresar. Requiere correo electrónico.
            </span>
          </span>
        </label>
      )}

      <FormSection title="Contacto" description="Datos de comunicación">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Teléfono">
            <Input {...register("phone")} placeholder="+507 000-0000" />
          </Field>
          <Field label="Celular" error={errors.mobile?.message}>
            <Input {...register("mobile")} placeholder="+507 6000-0000" />
          </Field>
          <Field label="Correo" error={errors.email?.message}>
            <Input
              type="email"
              {...register("email")}
              placeholder="correo@empresa.com"
            />
          </Field>
          <Field
            label="Dirección residencial"
            error={errors.address?.message}
            className="sm:col-span-2 lg:col-span-3"
          >
            <Input {...register("address")} />
          </Field>
          <Field
            label="Padecimiento físico"
            className="sm:col-span-2 lg:col-span-3"
          >
            <Input
              {...register("physicalAilment")}
              placeholder="Indique si aplica"
            />
          </Field>
        </div>
      </FormSection>

      <FormSection
        title="Información laboral"
        description="Empresa, cargo y antecedentes"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Empresa" required error={errors.companyId?.message}>
            <Select
              value={companyId}
              onValueChange={(v) => setValue("companyId", v)}
              disabled={isCompanyAdmin}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccione empresa" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.tradeName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Departamento" error={errors.department?.message}>
            <Input {...register("department")} />
          </Field>
          <Field label="Cargo" error={errors.position?.message}>
            <Input {...register("position")} />
          </Field>
          <Field
            label="Años de servicio"
            error={errors.yearsOfService?.message}
          >
            <Input type="number" min={0} {...register("yearsOfService")} />
          </Field>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                {...register("workedAtAirportBefore")}
                className="h-4 w-4 rounded border-border-strong accent-brand-600"
              />
              Trabajó anteriormente en el aeropuerto
            </label>
          </div>
          <Field label="Empresa anterior">
            <Input {...register("previousCompany")} placeholder="Si aplica" />
          </Field>
        </div>
        <div className="flex flex-wrap gap-6 pt-2">
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              {...register("hadPreviousCard")}
              className="h-4 w-4 rounded border-border-strong accent-brand-600"
            />
            Tuvo carné anteriormente
          </label>
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              {...register("reusePhoto")}
              className="h-4 w-4 rounded border-border-strong accent-brand-600"
            />
            Desea reutilizar fotografía
          </label>
        </div>
      </FormSection>
    </form>
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
