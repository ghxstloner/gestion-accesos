'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  LogIn,
  ShieldCheck,
  User,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authenticateUser } from '@/lib/auth';
import { useSgaStore } from '@/lib/store';
import { toast } from '@/hooks/use-toast';

type FieldErrors = { username?: string; password?: string };

export function LoginForm() {
  const router = useRouter();
  const users = useSgaStore((s) => s.users);
  const setCurrentUser = useSgaStore((s) => s.setCurrentUser);
  const currentUser = useSgaStore((s) => s.currentUser);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Redirige a usuarios ya autenticados fuera de la pantalla de login.
  useEffect(() => {
    if (currentUser) {
      router.replace('/dashboard');
    }
  }, [currentUser, router]);

  function handleUsernameChange(value: string) {
    setUsername(value);
    if (fieldErrors.username) setFieldErrors((e) => ({ ...e, username: undefined }));
    if (formError) setFormError(null);
  }

  function handlePasswordChange(value: string) {
    setPassword(value);
    if (fieldErrors.password) setFieldErrors((e) => ({ ...e, password: undefined }));
    if (formError) setFormError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    const trimmedUsername = username.trim();
    const nextErrors: FieldErrors = {};
    if (!trimmedUsername) nextErrors.username = 'Ingresa tu usuario.';
    if (!password) nextErrors.password = 'Ingresa tu contraseña.';

    setFieldErrors(nextErrors);
    setFormError(null);
    if (nextErrors.username || nextErrors.password) return;

    setLoading(true);
    // Simula una latencia de red breve para un feedback realista.
    await new Promise((r) => setTimeout(r, 650));

    const result = authenticateUser(users, trimmedUsername, password);
    setLoading(false);

    if (!result.ok) {
      setFormError(
        result.kind === 'blocked'
          ? 'Esta cuenta se encuentra bloqueada. Contacta al administrador del sistema.'
          : 'No fue posible iniciar sesión. Verifica tus credenciales e inténtalo nuevamente.'
      );
      return;
    }

    setCurrentUser({ userId: result.user.id, role: result.user.role });
    toast({
      title: 'Bienvenido al SGA',
      description: `${result.user.firstName} ${result.user.lastName}`,
    });
    router.push('/dashboard');
  }

  function handleForgotPassword(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    toast({
      title: 'Recuperación de contraseña',
      description:
        'Comunícate con el administrador del sistema para restablecer tu acceso institucional.',
    });
  }

  const usernameInvalid = Boolean(fieldErrors.username);
  const passwordInvalid = Boolean(fieldErrors.password);

  return (
    <div className="animate-fade-in w-full">
      <div className="mb-7 space-y-2">
        <h1 className="text-[30px] font-bold leading-tight tracking-tight text-text-primary sm:text-[32px]">
          Iniciar sesión
        </h1>
        <p className="text-sm leading-relaxed text-text-secondary">
          Ingresa tus credenciales institucionales para acceder al Sistema de Gestión de Accesos.
        </p>
      </div>

      <form noValidate onSubmit={handleSubmit} className="space-y-5">
        {/* Usuario */}
        <div className="space-y-1.5">
          <Label htmlFor="username" className="text-sm font-semibold text-text-primary">
            Usuario
          </Label>
          <div className="relative">
            <User
              className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-text-muted"
              aria-hidden="true"
            />
            <Input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              placeholder="Ingresa tu usuario"
              value={username}
              onChange={(e) => handleUsernameChange(e.target.value)}
              aria-invalid={usernameInvalid}
              aria-describedby={usernameInvalid ? 'username-error' : undefined}
              className="h-12 rounded-lg pl-11 pr-3 text-[15px] text-text-primary aria-[invalid=true]:border-danger"
            />
          </div>
          {usernameInvalid && (
            <p
              id="username-error"
              role="alert"
              className="flex items-center gap-1.5 text-xs font-medium text-danger"
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {fieldErrors.username}
            </p>
          )}
        </div>

        {/* Contraseña */}
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-sm font-semibold text-text-primary">
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
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Ingresa tu contraseña"
              value={password}
              onChange={(e) => handlePasswordChange(e.target.value)}
              aria-invalid={passwordInvalid}
              aria-describedby={passwordInvalid ? 'password-error' : undefined}
              className="h-12 rounded-lg pl-11 pr-12 text-[15px] text-text-primary aria-[invalid=true]:border-danger"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
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
              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
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
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{formError}</span>
            </div>
          )}
        </div>

        {/* Botón principal */}
        <Button
          type="submit"
          disabled={loading}
          className="h-12 w-full gap-2 rounded-lg bg-brand-600 text-[15px] font-semibold text-white transition-colors hover:bg-brand-700 focus-visible:ring-brand-600 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? (
            <>
              <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden="true" />
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
      <div className="mt-6 flex items-start gap-2.5 rounded-lg border border-border-subtle bg-surface-muted px-3.5 py-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
        <div className="space-y-0.5">
          <p className="text-xs font-medium text-text-primary">
            Acceso restringido a personal autorizado.
          </p>
          <p className="text-xs leading-relaxed text-text-secondary">
            Las actividades realizadas en el sistema pueden quedar registradas para fines de
            seguridad y auditoría.
          </p>
        </div>
      </div>
    </div>
  );
}
