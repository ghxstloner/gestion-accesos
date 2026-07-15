"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  Save,
  Server,
  ShieldCheck,
  UploadCloud,
  Loader2,
} from "lucide-react";
import { PageHeader, DetailSection } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/LoadingSkeletons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useSettingsQuery,
  useUpdateSettingsMutation,
  useUploadSettingsLogoMutation,
} from "@/hooks/api-hooks";
import { toast } from "@/hooks/use-toast";
import { resolveApiAsset } from "@/lib/api-config";

type SettingsForm = {
  companyName: string;
  logoUrl: string;
  smtpHost: string;
  smtpPort: number | "";
  smtpSecurity: "NONE" | "SSL" | "TLS";
  smtpUsername: string;
  smtpPassword: string;
  fromEmail: string;
  fromName: string;
  replyToEmail: string;
};
const EMPTY: SettingsForm = {
  companyName: "",
  logoUrl: "",
  smtpHost: "",
  smtpPort: 587,
  smtpSecurity: "TLS",
  smtpUsername: "",
  smtpPassword: "",
  fromEmail: "",
  fromName: "",
  replyToEmail: "",
};

export default function SettingsPage() {
  const { data, isLoading } = useSettingsQuery();
  const update = useUpdateSettingsMutation();
  const uploadLogo = useUploadSettingsLogoMutation();
  const [form, setForm] = useState(EMPTY);
  const [showPassword, setShowPassword] = useState(false);
  useEffect(() => {
    // La consulta remota es la fuente externa que hidrata el borrador editable.
    if (data) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        companyName: data.companyName,
        logoUrl: data.logoUrl ?? "",
        smtpHost: data.smtpHost ?? "",
        smtpPort: data.smtpPort,
        smtpSecurity: data.smtpSecurity,
        smtpUsername: data.smtpUsername ?? "",
        smtpPassword: "",
        fromEmail: data.fromEmail ?? "",
        fromName: data.fromName ?? "",
        replyToEmail: data.replyToEmail ?? "",
      });
    }
  }, [data]);
  const field = (key: keyof typeof form, value: string | number) =>
    setForm((current) => ({ ...current, [key]: value }));
  const save = async () => {
    try {
      await update.mutateAsync({
        ...form,
        smtpPort: form.smtpPort === "" ? undefined : form.smtpPort,
        logoUrl: form.logoUrl || undefined,
        smtpPassword: form.smtpPassword || undefined,
      });
      toast({
        title: "Configuración guardada",
        description: "La identidad y los parámetros de correo se actualizaron.",
      });
      setForm((current) => ({ ...current, smtpPassword: "" }));
    } catch (error) {
      toast({
        title: "No se pudo guardar",
        description:
          error instanceof Error ? error.message : "Verifica los datos.",
        variant: "destructive",
      });
    }
  };
  const handleLogoUpload = async (file?: File) => {
    if (!file) return;
    try {
      const settings = await uploadLogo.mutateAsync(file);
      field("logoUrl", settings.logoUrl ?? "");
      toast({
        title: "Logo actualizado",
        description: "La nueva imagen ya aparece en el sidebar.",
      });
    } catch (error) {
      toast({
        title: "No se pudo subir el logo",
        description:
          error instanceof Error
            ? error.message
            : "Usa PNG, JPG o WEBP de hasta 2 MB.",
        variant: "destructive",
      });
    }
  };
  if (isLoading) return <PageSkeleton variant="settings" />;
  return (
    <div className="space-y-7">
      <PageHeader
        title="Configuración"
        description="Identidad corporativa y entrega de correo"
        actions={
          <Button onClick={save} disabled={update.isPending}>
            <Save className="mr-2 h-4 w-4" />
            {update.isPending ? "Guardando…" : "Guardar cambios"}
          </Button>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,.9fr)]">
        <div className="space-y-6">
          <DetailSection title="Identidad del sistema">
            <div className="grid gap-5 sm:grid-cols-[120px_1fr]">
              <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-3xl border border-border bg-surface-muted p-4 shadow-inner">
                {form.logoUrl ? (
                  <Image
                    src={resolveApiAsset(form.logoUrl)}
                    alt="Vista previa del logo"
                    width={100}
                    height={100}
                    className="h-full w-full object-contain"
                    unoptimized
                  />
                ) : (
                  <Building2 className="h-10 w-10 text-brand-500" />
                )}
              </div>
              <div className="space-y-4">
                <Field label="Nombre de la empresa">
                  <Input
                    value={form.companyName}
                    onChange={(e) => field("companyName", e.target.value)}
                    placeholder="Nombre legal o comercial"
                  />
                </Field>
                <Field label="Logo del SGA">
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-brand-300 bg-brand-50/60 px-4 py-3 transition hover:border-brand-500 hover:bg-brand-50">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      disabled={uploadLogo.isPending}
                      onChange={(event) =>
                        void handleLogoUpload(event.target.files?.[0])
                      }
                    />
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-brand-600 shadow-sm">
                      {uploadLogo.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UploadCloud className="h-4 w-4" />
                      )}
                    </span>
                    <span>
                      <span className="block text-xs font-bold text-brand-900">
                        {uploadLogo.isPending
                          ? "Subiendo imagen…"
                          : "Seleccionar imagen"}
                      </span>
                      <span className="block text-[10px] text-text-muted">
                        PNG, JPG o WEBP · máximo 2 MB
                      </span>
                    </span>
                  </label>
                </Field>
              </div>
            </div>
          </DetailSection>
          <DetailSection title="Servidor de correo">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Servidor SMTP">
                <Input
                  value={form.smtpHost}
                  onChange={(e) => field("smtpHost", e.target.value)}
                  placeholder="smtp.empresa.com"
                />
              </Field>
              <Field label="Puerto">
                <Input
                  type="number"
                  min={1}
                  max={65535}
                  value={form.smtpPort}
                  onChange={(e) =>
                    field(
                      "smtpPort",
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                />
              </Field>
              <Field label="Seguridad">
                <Select
                  value={form.smtpSecurity}
                  onValueChange={(value) => field("smtpSecurity", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TLS">TLS (recomendado)</SelectItem>
                    <SelectItem value="SSL">SSL</SelectItem>
                    <SelectItem value="NONE">Sin cifrado</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Usuario SMTP">
                <Input
                  value={form.smtpUsername}
                  onChange={(e) => field("smtpUsername", e.target.value)}
                  autoComplete="off"
                />
              </Field>
              <Field label="Contraseña SMTP" className="sm:col-span-2">
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={form.smtpPassword}
                    onChange={(e) => field("smtpPassword", e.target.value)}
                    placeholder={
                      data?.smtpPasswordConfigured
                        ? "•••••••• (configurada)"
                        : "Contraseña o token de aplicación"
                    }
                    className="pr-11"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-text-muted hover:bg-surface-muted"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </Field>
            </div>
          </DetailSection>
        </div>
        <div className="space-y-6">
          <DetailSection title="Identidad del remitente">
            <div className="space-y-4">
              <Field label="Nombre visible">
                <Input
                  value={form.fromName}
                  onChange={(e) => field("fromName", e.target.value)}
                  placeholder="Equipo de Accesos"
                />
              </Field>
              <Field label="Correo remitente">
                <Input
                  type="email"
                  value={form.fromEmail}
                  onChange={(e) => field("fromEmail", e.target.value)}
                  placeholder="accesos@empresa.com"
                />
              </Field>
              <Field label="Responder a">
                <Input
                  type="email"
                  value={form.replyToEmail}
                  onChange={(e) => field("replyToEmail", e.target.value)}
                  placeholder="soporte@empresa.com"
                />
              </Field>
            </div>
          </DetailSection>
          <div className="rounded-2xl bg-brand-600 p-5 text-white shadow-xl shadow-brand-600/15">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                <ShieldCheck className="h-5 w-5 text-brand-300" />
              </span>
              <div>
                <p className="font-bold">Estado de configuración</p>
                <p className="text-xs text-white/55">
                  Resumen de disponibilidad
                </p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {[
                [Server, "Servidor SMTP", Boolean(form.smtpHost)],
                [
                  KeyRound,
                  "Credencial segura",
                  Boolean(data?.smtpPasswordConfigured || form.smtpPassword),
                ],
                [Mail, "Remitente", Boolean(form.fromEmail)],
              ].map(([Icon, label, ready]) => {
                const C = Icon as typeof Server;
                return (
                  <div
                    key={String(label)}
                    className="flex items-center gap-3 rounded-xl bg-white/6 px-3 py-2.5"
                  >
                    <C className="h-4 w-4 text-brand-300" />
                    <span className="flex-1 text-sm text-white/75">
                      {String(label)}
                    </span>
                    {ready ? (
                      <CheckCircle2 className="h-4 w-4 text-brand-300" />
                    ) : (
                      <span className="text-[10px] uppercase tracking-wider text-white/35">
                        Pendiente
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-xs font-bold text-text-secondary">
        {label}
      </Label>
      {children}
    </div>
  );
}
