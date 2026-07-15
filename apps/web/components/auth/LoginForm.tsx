"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  LogIn,
  Mail,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSgaStore } from "@/lib/store";
import { toast } from "@/hooks/use-toast";
import { useLoginMutation, buildCurrentUser } from "@/hooks/auth-hooks";

type FieldErrors = { email?: string; password?: string };

export function LoginForm() {
  const router = useRouter();
  const setCurrentUser = useSgaStore((s) => s.setCurrentUser);
  const currentUser = useSgaStore((s) => s.currentUser);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const loginMutation = useLoginMutation();

  // Redirige a usuarios ya autenticados fuera de la pantalla de login.
  useEffect(() => {
    if (currentUser) {
      router.replace("/dashboard");
    }
  }, [currentUser, router]);

  function handleEmailChange(value: string) {
    setEmail(value);
    if (fieldErrors.email) setFieldErrors((e) => ({ ...e, email: undefined }));
    if (formError) setFormError(null);
  }

  function handlePasswordChange(value: string) {
    setPassword(value);
    if (fieldErrors.password)
      setFieldErrors((e) => ({ ...e, password: undefined }));
    if (formError) setFormError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loginMutation.isPending) return;

    const trimmedEmail = email.trim();
    const nextErrors: FieldErrors = {};
    if (!trimmedEmail) nextErrors.email = "Ingresa tu correo institucional.";
    if (!password) nextErrors.password = "Ingresa tu contraseña.";

    setFieldErrors(nextErrors);
    setFormError(null);
    if (nextErrors.email || nextErrors.password) return;

    loginMutation.mutate(
      { email: trimmedEmail, password },
      {
        onSuccess: (data) => {
          setCurrentUser(buildCurrentUser(data.user));
          toast({
            title: "Bienvenido al SGA",
            description: `${data.user.firstName} ${data.user.lastName}`,
          });
          router.push(
            data.user.mustChangePassword ? "/change-password" : "/dashboard",
          );
        },
        onError: (err: unknown) => {
          const status =
            err && typeof err === "object" && "status" in err
              ? (err as { status: number }).status
              : undefined;
          // El backend devuelve 401 tanto para credenciales inválidas como
          // para cuentas inactivas/bloqueadas, distinguiéndolas en el mensaje.
          if (status === 401) {
            const payload =
              err && typeof err === "object" && "payload" in err
                ? (err as { payload?: { message?: string } }).payload
                : undefined;
            const msg = payload?.message ?? "";
            if (/password expired|contraseña vencida/i.test(msg)) {
              setFormError(
                "Tu contraseña venció. Solicita al administrador que la restablezca para continuar.",
              );
            } else if (/blocked|not active|bloquead|inactiv/i.test(msg)) {
              setFormError(
                "Esta cuenta se encuentra bloqueada. Contacta al administrador del sistema.",
              );
            } else {
              setFormError(
                "No fue posible iniciar sesión. Verifica tus credenciales e inténtalo nuevamente.",
              );
            }
            return;
          }
          if (status && status >= 500) {
            setFormError(
              "El servicio no está disponible en este momento. Inténtalo más tarde.",
            );
            return;
          }
          setFormError(
            "No fue posible iniciar sesión. Verifica tus credenciales e inténtalo nuevamente.",
          );
        },
      },
    );
  }

  function handleForgotPassword(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    toast({
      title: "Recuperación de contraseña",
      description:
        "Comunícate con el administrador del sistema para restablecer tu acceso institucional.",
    });
  }

  const emailInvalid = Boolean(fieldErrors.email);
  const passwordInvalid = Boolean(fieldErrors.password);
  const loading = loginMutation.isPending;

  return (
    <div className="animate-fade-in w-full">
      <div className="mb-8 space-y-3">
        <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.18em] text-brand-700">
          <span className="h-px w-7 bg-brand-500" />
          Portal seguro
        </span>
        <h1 className="font-display text-[38px] leading-none text-brand-950 sm:text-[44px]">
          Bienvenido de nuevo
        </h1>
        <p className="text-sm leading-relaxed text-text-secondary">
          Ingresa tus credenciales para continuar gestionando accesos.
        </p>
      </div>

      <form noValidate onSubmit={handleSubmit} className="space-y-5">
        {/* Correo institucional */}
        <div className="space-y-1.5">
          <Label
            htmlFor="email"
            className="text-sm font-semibold text-text-primary"
          >
            Correo institucional
          </Label>
          <div className="relative">
            <Mail
              className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-text-muted"
              aria-hidden="true"
            />
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="nombre@empresa.com"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              aria-invalid={emailInvalid}
              aria-describedby={emailInvalid ? "email-error" : undefined}
              className="h-12 rounded-xl border-border bg-surface-muted pl-11 pr-3 text-[15px] text-text-primary shadow-none aria-[invalid=true]:border-danger"
            />
          </div>
          {emailInvalid && (
            <p
              id="email-error"
              role="alert"
              className="flex items-center gap-1.5 text-xs font-medium text-danger"
            >
              <AlertCircle
                className="h-3.5 w-3.5 shrink-0"
                aria-hidden="true"
              />
              {fieldErrors.email}
            </p>
          )}
        </div>

        {/* Contraseña */}
        <div className="space-y-1.5">
          <Label
            htmlFor="password"
            className="text-sm font-semibold text-text-primary"
          >
            Contraseña
          </Label>
          <div className="relative">
            <Lock
              className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-text-muted"
              aria-hidden="true"
            />
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Ingresa tu contraseña"
              value={password}
              onChange={(e) => handlePasswordChange(e.target.value)}
              aria-invalid={passwordInvalid}
              aria-describedby={passwordInvalid ? "password-error" : undefined}
              className="h-12 rounded-xl border-border bg-surface-muted pl-11 pr-12 text-[15px] text-text-primary shadow-none aria-[invalid=true]:border-danger"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={
                showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
              }
              aria-pressed={showPassword}
              className="absolute right-1.5 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              {showPassword ? (
                <EyeOff className="h-[18px] w-[18px]" aria-hidden="true" />
              ) : (
                <Eye className="h-[18px] w-[18px]" aria-hidden="true" />
              )}
            </button>
          </div>
          {passwordInvalid && (
            <p
              id="password-error"
              role="alert"
              className="flex items-center gap-1.5 text-xs font-medium text-danger"
            >
              <AlertCircle
                className="h-3.5 w-3.5 shrink-0"
                aria-hidden="true"
              />
              {fieldErrors.password}
            </p>
          )}
        </div>

        {/* Recordarme / Recuperar contraseña */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="remember"
              checked={rememberMe}
              onCheckedChange={(v) => setRememberMe(v === true)}
              className="h-[18px] w-[18px] rounded-[5px] border-border-strong data-[state=checked]:border-brand-600 data-[state=checked]:bg-brand-600"
            />
            <Label
              htmlFor="remember"
              className="cursor-pointer py-1 text-sm text-text-secondary"
            >
              Recordarme
            </Label>
          </div>
          <button
            type="button"
            onClick={handleForgotPassword}
            className="rounded text-sm font-medium text-brand-700 underline-offset-4 transition-colors hover:text-brand-800 hover:underline focus-visible:outline-none focus-visible:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            ¿Olvidaste tu contraseña?
          </button>
        </div>

        {/* Error general (anuncio accesible) */}
        <div aria-live="assertive" className="min-h-0">
          {formError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-danger/25 bg-danger-soft px-3.5 py-2.5 text-sm text-danger"
            >
              <AlertCircle
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <span>{formError}</span>
            </div>
          )}
        </div>

        {/* Botón principal */}
        <Button
          type="submit"
          disabled={loading}
          className="h-12 w-full gap-2 rounded-xl bg-brand-600 text-[15px] font-semibold text-white shadow-lg shadow-brand-600/20 transition-all hover:-translate-y-0.5 hover:bg-brand-600 hover:brightness-95 focus-visible:ring-brand-600 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? (
            <>
              <Loader2
                className="h-[18px] w-[18px] animate-spin"
                aria-hidden="true"
              />
              <span>Iniciando sesión…</span>
              <span className="sr-only">Procesando, espera un momento.</span>
            </>
          ) : (
            <>
              <LogIn className="h-[18px] w-[18px]" aria-hidden="true" />
              <span>Iniciar sesión</span>
            </>
          )}
        </Button>
      </form>

      {/* Mensaje institucional de seguridad */}
      <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-brand-100 bg-brand-50/70 px-3.5 py-3">
        <ShieldCheck
          className="mt-0.5 h-4 w-4 shrink-0 text-brand-700"
          aria-hidden="true"
        />
        <div className="space-y-0.5">
          <p className="text-xs font-medium text-text-primary">
            Acceso restringido a personal autorizado.
          </p>
          <p className="text-xs leading-relaxed text-text-secondary">
            Las actividades realizadas en el sistema pueden quedar registradas
            para fines de seguridad y auditoría.
          </p>
        </div>
      </div>
    </div>
  );
}
