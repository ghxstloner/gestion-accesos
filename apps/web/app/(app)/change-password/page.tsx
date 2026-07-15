"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, ShieldCheck } from "lucide-react";
import {
  useChangePasswordMutation,
  buildCurrentUser,
} from "@/hooks/auth-hooks";
import { useSgaStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ChangePasswordPage() {
  const router = useRouter();
  const changePassword = useChangePasswordMutation();
  const setCurrentUser = useSgaStore((state) => state.setCurrentUser);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      password.length < 8 ||
      !/[A-Z]/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    )
      return setError(
        "Usa al menos 8 caracteres, una mayúscula y un carácter especial.",
      );
    if (password !== confirmation)
      return setError("Las contraseñas no coinciden.");
    try {
      const profile = await changePassword.mutateAsync(password);
      setCurrentUser(buildCurrentUser(profile));
      router.replace("/dashboard");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No fue posible cambiar la contraseña.",
      );
    }
  };

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md overflow-hidden rounded-3xl border border-border bg-white shadow-2xl"
      >
        <div className="bg-brand-600 p-7 text-white">
          <ShieldCheck className="mb-4 h-8 w-8" />
          <h1 className="text-2xl font-bold">Crea tu contraseña</h1>
          <p className="mt-2 text-sm text-white/75">
            Por seguridad debes reemplazar la contraseña temporal antes de
            continuar.
          </p>
        </div>
        <div className="space-y-5 p-7">
          <div>
            <Label className="mb-2 block">Nueva contraseña</Label>
            <Input
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError("");
              }}
              autoFocus
            />
          </div>
          <div>
            <Label className="mb-2 block">Confirmar contraseña</Label>
            <Input
              type="password"
              value={confirmation}
              onChange={(event) => {
                setConfirmation(event.target.value);
                setError("");
              }}
            />
          </div>
          {error && (
            <p
              role="alert"
              className="rounded-xl bg-danger-soft px-3 py-2 text-xs font-medium text-danger"
            >
              {error}
            </p>
          )}
          <Button className="w-full" disabled={changePassword.isPending}>
            <KeyRound className="mr-2 h-4 w-4" />
            {changePassword.isPending
              ? "Guardando…"
              : "Cambiar contraseña y continuar"}
          </Button>
        </div>
      </form>
    </main>
  );
}
