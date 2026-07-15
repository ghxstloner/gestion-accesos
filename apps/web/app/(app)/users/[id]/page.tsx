"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  Save,
  Mail,
  Building2,
  ShieldCheck,
  Power,
  Pencil,
  Calendar,
  Camera,
} from "lucide-react";
import { useSgaStore, useCurrentUserData } from "@/lib/store";
import {
  useCompaniesQuery,
  useToggleUserStatusMutation,
  useUpdateUserMutation,
  useUserQuery,
  useUsersQuery,
  useUploadUserPhotoMutation,
} from "@/hooks/api-hooks";
import { PageSkeleton } from "@/components/shared/LoadingSkeletons";
import { PageHeader, DetailSection } from "@/components/shared/PageHeader";
import { EntityStatusBadge } from "@/components/shared/StatusBadge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
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
import { ROLES, formatDate, formatDateTime } from "@/lib/constants";
import type { Role } from "@/lib/types";
import { toast } from "@/hooks/use-toast";
import {
  PermissionMatrix,
  ROLE_PERMISSION_CODES,
} from "@/components/shared/PermissionMatrix";
import { ResetPasswordDialog } from "@/components/shared/ResetPasswordDialog";
import { resolveApiAsset } from "@/lib/api-config";

export default function UserDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: user, isLoading } = useUserQuery(id);
  const { data: companies = [] } = useCompaniesQuery();
  const { data: allUsers = [] } = useUsersQuery();
  const updateUser = useUpdateUserMutation(id);
  const toggleUserStatus = useToggleUserStatusMutation();
  const uploadPhoto = useUploadUserPhotoMutation();
  const userData = useCurrentUserData();
  const role = useSgaStore((s) => s.currentUser?.role);
  const [editing, setEditing] = useState(searchParams.get("edit") === "1");
  const [additionalPermissions, setAdditionalPermissions] = useState<string[]>(
    [],
  );

  useEffect(() => {
    // La navegación desde el menú contextual conserva el componente montado.
    if (searchParams.get("edit") === "1") setEditing(true);
  }, [id, searchParams]);

  // Schema reads fresh `allUsers` so the email uniqueness check excludes the
  // user being edited.
  const schema = z.object({
    firstName: z.string().min(1, "Obligatorio"),
    lastName: z.string().min(1, "Obligatorio"),
    email: z
      .string()
      .email("Correo inválido")
      .refine(
        (v) =>
          !allUsers.some(
            (u) =>
              u.id !== id &&
              u.email.trim().toLowerCase() === v.trim().toLowerCase(),
          ),
        { message: "Ya existe un usuario con ese correo." },
      ),
    companyId: z.string().min(1, "Obligatorio"),
    role: z.string().min(1, "Obligatorio"),
  });
  type FormData = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (user) {
      reset({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        companyId: user.companyId,
        role: user.role,
      });
      setAdditionalPermissions(user.additionalPermissions ?? []);
    }
  }, [user, reset]);

  if (isLoading) return <PageSkeleton variant="detail" />;

  // Company admins can only view/edit users of their own company
  const isCompanyAdminScoped =
    role === "ADMIN_EMPRESA" &&
    (!userData || user?.companyId !== userData.companyId);
  if (isCompanyAdminScoped) {
    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={() => router.push("/users")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
        <p className="text-sm text-text-muted">
          No tiene permiso para ver este usuario.
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={() => router.push("/users")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
        <p className="text-sm text-text-muted">Usuario no encontrado.</p>
      </div>
    );
  }

  const company = companies.find((c) => c.id === user.companyId);
  const onSave = async (data: FormData) => {
    try {
      const inherited = new Set(ROLE_PERMISSION_CODES[data.role as Role]);
      await updateUser.mutateAsync({
        ...data,
        role: data.role as Role,
        additionalPermissions: additionalPermissions.filter(
          (permission) => !inherited.has(permission),
        ),
      });
      setEditing(false);
      toast({ title: "Usuario actualizado" });
    } catch (err) {
      toast({
        title: "No se pudo actualizar",
        description: err instanceof Error ? err.message : "Error inesperado",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${user.firstName} ${user.lastName}`}
        description={user.email}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/users")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Button>
            {editing ? (
              <Button onClick={handleSubmit(onSave)}>
                <Save className="mr-2 h-4 w-4" />
                Guardar
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </Button>
            )}
            <ResetPasswordDialog
              userId={id}
              userName={`${user.firstName} ${user.lastName}`}
              defaultOpen={searchParams.get("resetPassword") === "1"}
              trigger={
                <Button variant="outline">Restablecer contraseña</Button>
              }
            />
            <ConfirmDialog
              trigger={
                <Button variant="outline">
                  <Power className="mr-2 h-4 w-4" />
                  {user.status === "ACTIVE" ? "Bloquear" : "Activar"}
                </Button>
              }
              title={
                user.status === "ACTIVE"
                  ? "Bloquear usuario"
                  : "Activar usuario"
              }
              description={`¿Confirmar acción sobre ${user.firstName} ${user.lastName}?`}
              destructive={user.status === "ACTIVE"}
              onConfirm={async () => {
                await toggleUserStatus.mutateAsync({
                  id,
                  activate: user.status !== "ACTIVE",
                });
                toast({ title: "Estado actualizado" });
              }}
            />
          </div>
        }
      />

      <div className="flex items-center gap-3">
        <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-brand-100 text-lg font-semibold text-brand-700 ring-4 ring-white shadow-sm">
          {user.photoUrl ? (
            <Image
              src={resolveApiAsset(user.photoUrl)}
              alt={`Foto de ${user.firstName}`}
              fill
              sizes="64px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <>
              {user.firstName[0]}
              {user.lastName[0]}
            </>
          )}
        </div>
        <div>
          <EntityStatusBadge status={user.status} />
          <p className="mt-1 text-xs text-text-muted">
            Creado el {formatDate(user.createdAt)}
          </p>
        </div>
        <label className="ml-auto inline-flex cursor-pointer items-center rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-600 hover:bg-brand-100">
          <Camera className="mr-2 h-4 w-4" />
          {uploadPhoto.isPending ? "Subiendo…" : "Cambiar foto"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            disabled={uploadPhoto.isPending}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (file) await uploadPhoto.mutateAsync({ id, file });
            }}
          />
        </label>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <DetailSection
          title="Información del usuario"
          className="lg:col-span-2"
        >
          {editing ? (
            <form
              onSubmit={handleSubmit(onSave)}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2"
            >
              <FormField
                label="Nombre"
                required
                error={errors.firstName?.message}
              >
                <Input {...register("firstName")} />
              </FormField>
              <FormField
                label="Apellido"
                required
                error={errors.lastName?.message}
              >
                <Input {...register("lastName")} />
              </FormField>
              <FormField
                label="Correo"
                required
                error={errors.email?.message}
                className="sm:col-span-2"
              >
                <Input type="email" {...register("email")} />
              </FormField>
              <FormField
                label="Empresa"
                required
                error={errors.companyId?.message}
              >
                <Select
                  value={watch("companyId")}
                  onValueChange={(v) => setValue("companyId", v)}
                  disabled={role === "ADMIN_EMPRESA"}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(role === "ADMIN_EMPRESA"
                      ? companies.filter((c) => c.id === userData?.companyId)
                      : companies
                    ).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.tradeName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Rol" required error={errors.role?.message}>
                <Select
                  value={watch("role")}
                  onValueChange={(v) => setValue("role", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(role === "ADMIN_EMPRESA"
                      ? Object.entries(ROLES).filter(
                          ([k]) => k !== "ADMIN_GENERAL",
                        )
                      : Object.entries(ROLES)
                    ).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <div className="sm:col-span-2">
                <PermissionMatrix
                  role={watch("role") as Role}
                  additional={additionalPermissions}
                  onChange={setAdditionalPermissions}
                />
              </div>
              <div className="sm:col-span-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditing(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit">
                  <Save className="mr-2 h-4 w-4" />
                  Guardar
                </Button>
              </div>
            </form>
          ) : (
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InfoItem icon={Mail} label="Correo" value={user.email} />
              <InfoItem
                icon={Building2}
                label="Empresa"
                value={company?.tradeName ?? "—"}
              />
              <InfoItem
                icon={ShieldCheck}
                label="Rol"
                value={ROLES[user.role].label}
              />
              <InfoItem
                icon={Calendar}
                label="Último acceso"
                value={formatDateTime(user.lastAccess)}
              />
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
              <span className="text-sm font-medium text-text-primary">
                {formatDate(user.createdAt)}
              </span>
            </div>
          </div>
        </DetailSection>
      </div>
    </div>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs font-medium text-text-muted">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </dt>
      <dd className="mt-1 text-sm text-text-primary">{value}</dd>
    </div>
  );
}

function FormField({
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
