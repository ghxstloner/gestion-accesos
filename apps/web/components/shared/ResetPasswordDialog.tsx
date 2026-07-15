"use client";

import { useState } from "react";
import { Eye, EyeOff, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useResetUserPasswordMutation } from "@/hooks/api-hooks";
import { toast } from "@/hooks/use-toast";

export function ResetPasswordDialog({
  userId,
  userName,
  trigger,
  defaultOpen = false,
}: {
  userId: string;
  userName: string;
  trigger: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const resetPassword = useResetUserPasswordMutation();
  const [open, setOpen] = useState(defaultOpen);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [generatedPassword, setGeneratedPassword] = useState("");

  const checks = [
    { label: "8 caracteres", valid: password.length >= 8 },
    { label: "Una mayúscula", valid: /[A-Z]/.test(password) },
    { label: "Un carácter especial", valid: /[^A-Za-z0-9]/.test(password) },
  ];

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setPassword("");
      setConfirmation("");
      setError("");
      setShowPassword(false);
      setGeneratedPassword("");
    }
  }

  async function generateTemporaryPassword() {
    setError("");
    try {
      const result = await resetPassword.mutateAsync({ id: userId });
      setGeneratedPassword(result.temporaryPassword);
      setPassword("");
      setConfirmation("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No fue posible generar la contraseña temporal.",
      );
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (!/[A-Z]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      setError("Incluye al menos una mayúscula y un carácter especial.");
      return;
    }
    if (password !== confirmation) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    try {
      await resetPassword.mutateAsync({ id: userId, newPassword: password });
      handleOpenChange(false);
      toast({
        title: "Contraseña restablecida",
        description: `La nueva contraseña de ${userName} ya está activa.`,
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No fue posible restablecer la contraseña.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="overflow-hidden rounded-3xl border-0 bg-white p-0 shadow-2xl sm:max-w-[500px]">
        <div className="bg-brand-600 px-6 py-6 text-white">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-brand-200">
            <LockKeyhole className="h-5 w-5" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white">
              Restablecer contraseña
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-white/60">
              Define una nueva contraseña segura para {userName}.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 pb-6 pt-5">
          {generatedPassword && (
            <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-brand-600">
                Contraseña temporal generada
              </p>
              <code className="mt-2 block break-all rounded-xl bg-white px-3 py-2 text-base font-bold text-text-primary">
                {generatedPassword}
              </code>
              <p className="mt-2 text-xs text-text-muted">
                Compártela de forma segura. Se solicitará cambiarla al iniciar
                sesión.
              </p>
            </div>
          )}
          <div className="space-y-2">
            <Label
              htmlFor={`new-password-${userId}`}
              className="text-xs font-bold text-text-secondary"
            >
              Nueva contraseña
            </Label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <Input
                id={`new-password-${userId}`}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError("");
                }}
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
                className="h-11 rounded-xl bg-surface-muted pl-10 pr-11"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={
                  showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                }
                className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-text-muted hover:bg-white hover:text-text-primary"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor={`confirm-password-${userId}`}
              className="text-xs font-bold text-text-secondary"
            >
              Confirmar contraseña
            </Label>
            <Input
              id={`confirm-password-${userId}`}
              type={showPassword ? "text" : "password"}
              value={confirmation}
              onChange={(event) => {
                setConfirmation(event.target.value);
                setError("");
              }}
              autoComplete="new-password"
              placeholder="Repite la nueva contraseña"
              className="h-11 rounded-xl bg-surface-muted"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {checks.map((check) => (
              <span
                key={check.label}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${check.valid ? "bg-success-soft text-success" : "bg-surface-muted text-text-muted"}`}
              >
                <ShieldCheck className="h-3 w-3" />
                {check.label}
              </span>
            ))}
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-danger/15 bg-danger-soft px-3 py-2.5 text-xs font-medium text-danger"
            >
              {error}
            </p>
          )}

          <DialogFooter className="gap-2 border-t border-border-subtle pt-5 sm:space-x-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => void generateTemporaryPassword()}
              disabled={resetPassword.isPending}
            >
              Generar automáticamente
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={resetPassword.isPending}
              className="bg-brand-600 hover:bg-brand-700"
            >
              <KeyRound className="mr-2 h-4 w-4" />
              {resetPassword.isPending
                ? "Restableciendo…"
                : "Restablecer contraseña"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
