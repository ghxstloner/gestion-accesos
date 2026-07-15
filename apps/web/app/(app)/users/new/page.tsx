"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Save, Camera } from "lucide-react";
import { useSgaStore, useCurrentUserData } from "@/lib/store";
import {
  useCompaniesQuery,
  useCreateUserMutation,
  useUploadUserPhotoMutation,
  useUsersQuery,
} from "@/hooks/api-hooks";
import { PageHeader, FormSection } from "@/components/shared/PageHeader";
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
import { ROLES } from "@/lib/constants";
import type { Role } from "@/lib/types";
import { toast } from "@/hooks/use-toast";
import {
  PermissionMatrix,
  ROLE_PERMISSION_CODES,
} from "@/components/shared/PermissionMatrix";

export default function NewUserPage() {
  const router = useRouter();
  const { data: companies = [] } = useCompaniesQuery();
  const { data: users = [] } = useUsersQuery();
  const createUser = useCreateUserMutation();
  const uploadPhoto = useUploadUserPhotoMutation();
  const userData = useCurrentUserData();
  const role = useSgaStore((s) => s.currentUser?.role);
  const [submitting, setSubmitting] = useState(false);
  const [additionalPermissions, setAdditionalPermissions] = useState<string[]>(
    [],
  );
  const [photo, setPhoto] = useState<File | null>(null);

  const isCompanyAdmin = role === "ADMIN_EMPRESA" && userData;
  // Roles a company admin can assign (no global escalate)
  const allowedRoles = isCompanyAdmin
    ? Object.entries(ROLES).filter(([k]) => k !== "ADMIN_GENERAL")
    : Object.entries(ROLES);
  const initialCompany = isCompanyAdmin ? userData!.companyId : "";
  const initialRole = "SOLICITANTE";

  // Zod schema built per-render so it can read fresh `users` from the store
  // and enforce email uniqueness inline.
  const schema = z.object({
    firstName: z.string().min(1, "Nombre obligatorio"),
    lastName: z.string().min(1, "Apellido obligatorio"),
    email: z
      .string()
      .email("Correo inválido")
      .refine(
        (v) =>
          !users.some(
            (u) => u.email.trim().toLowerCase() === v.trim().toLowerCase(),
          ),
        { message: "Ya existe un usuario con ese correo." },
      ),
    companyId: z.string().min(1, "Empresa obligatoria"),
    role: z.string().min(1, "Rol obligatorio"),
  });
  type FormData = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      companyId: initialCompany,
      role: initialRole,
    },
  });

  const companyId = watch("companyId");
  const selectedRole = watch("role");

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      const inherited = new Set(ROLE_PERMISSION_CODES[data.role as Role]);
      const user = await createUser.mutateAsync({
        ...data,
        role: data.role as Role,
        additionalPermissions: additionalPermissions.filter(
          (permission) => !inherited.has(permission),
        ),
      });
      if (photo) await uploadPhoto.mutateAsync({ id: user.id, file: photo });
      toast({
        title: "Usuario creado",
        description: `Contraseña temporal: ${user.temporaryPassword}. Deberá cambiarla al ingresar.`,
      });
      router.push(`/users/${user.id}`);
    } catch (err) {
      toast({
        title: "No se pudo crear el usuario",
        description: err instanceof Error ? err.message : "Error inesperado",
        variant: "destructive",
      });
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Crear usuario"
        description="Registro de un nuevo usuario del sistema"
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
            title="Información personal"
            description="Datos del usuario"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nombre" required error={errors.firstName?.message}>
                <Input {...register("firstName")} placeholder="Nombre" />
              </Field>
              <Field label="Apellido" required error={errors.lastName?.message}>
                <Input {...register("lastName")} placeholder="Apellido" />
              </Field>
              <Field
                label="Correo"
                required
                error={errors.email?.message}
                className="sm:col-span-2"
              >
                <Input
                  type="email"
                  {...register("email")}
                  placeholder="correo@empresa.com"
                />
              </Field>
              <div className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 sm:col-span-2">
                <p className="text-sm font-semibold text-brand-600">
                  Contraseña temporal automática
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  El sistema generará una contraseña segura. El usuario deberá
                  cambiarla en su primer ingreso.
                </p>
              </div>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-brand-200 px-4 py-3 sm:col-span-2">
                <Camera className="h-5 w-5 text-brand-600" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-text-primary">
                    Foto del usuario
                  </span>
                  <span className="block truncate text-xs text-text-muted">
                    {photo?.name ?? "PNG, JPG o WEBP · máximo 3 MB"}
                  </span>
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={(event) =>
                    setPhoto(event.target.files?.[0] ?? null)
                  }
                />
              </label>
            </div>
          </FormSection>

          <div className="mt-8">
            <FormSection
              title="Asignación"
              description="Empresa y rol del usuario"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="Empresa"
                  required
                  error={errors.companyId?.message}
                >
                  <Select
                    value={companyId}
                    onValueChange={(v) => setValue("companyId", v)}
                    disabled={!!isCompanyAdmin}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      {(isCompanyAdmin
                        ? companies.filter((c) => c.id === userData!.companyId)
                        : companies
                      ).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.tradeName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Rol" required error={errors.role?.message}>
                  <Select
                    value={selectedRole}
                    onValueChange={(v) => setValue("role", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione rol" />
                    </SelectTrigger>
                    <SelectContent>
                      {allowedRoles.map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-text-muted">
                    Los nuevos usuarios reciben Solicitante por defecto.
                  </p>
                </Field>
              </div>
              <div className="mt-5">
                <PermissionMatrix
                  role={selectedRole as Role}
                  additional={additionalPermissions}
                  onChange={setAdditionalPermissions}
                />
              </div>
            </FormSection>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            <Save className="mr-2 h-4 w-4" />
            Guardar usuario
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
