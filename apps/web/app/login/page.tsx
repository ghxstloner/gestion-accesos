'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, LogIn, Info } from 'lucide-react';
import { useSgaStore } from '@/lib/store';
import { ROLES, ROLE_LIST } from '@/lib/constants';
import type { Role } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';

export default function LoginPage() {
  const router = useRouter();
  const users = useSgaStore((s) => s.users);
  const setCurrentUser = useSgaStore((s) => s.setCurrentUser);
  const currentUser = useSgaStore((s) => s.currentUser);
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<Role>('ADMIN_GENERAL');

  useEffect(() => {
    if (currentUser) {
      router.replace('/dashboard');
    }
    if (users.length > 0 && !userId) {
      setUserId(users[0].id);
    }
  }, [currentUser, users, userId, router]);

  const handleLogin = () => {
    if (!userId) {
      toast({ title: 'Seleccione un usuario', variant: 'destructive' });
      return;
    }
    setCurrentUser({ userId, role });
    toast({ title: 'Bienvenido al SGA', description: 'Entorno de demostración' });
    router.push('/dashboard');
  };

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Left visual panel */}
      <div className="relative hidden w-1/2 flex-col justify-between bg-brand-950 p-12 lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 backdrop-blur">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-xl font-bold tracking-tight text-white">SGA</p>
            <p className="text-xs text-brand-200">Sistema de Gestión de Accesos</p>
          </div>
        </div>

        <div className="max-w-md">
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-white">
            Gestión de solicitudes de carnés y permisos de acceso
          </h1>
          <p className="mt-4 text-base leading-relaxed text-brand-200">
            Plataforma institucional para administrar solicitudes de carnés permanentes y permisos temporales de acceso para personas, vehículos, herramientas y equipos en un entorno aeroportuario.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {['Carnés permanentes', 'Permisos temporales', 'Bandeja de revisión', 'Emisión de carnés'].map((tag) => (
              <span key={tag} className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-medium text-brand-100">
                {tag}
              </span>
            ))}
          </div>
        </div>

        <p className="text-xs text-brand-300/70">
          © {new Date().getFullYear()} Sistema de Gestión de Accesos — Entorno de demostración
        </p>
      </div>

      {/* Right login form */}
      <div className="flex flex-1 items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-900 text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight text-text-primary">SGA</p>
              <p className="text-xs text-text-muted">Sistema de Gestión de Accesos</p>
            </div>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Iniciar sesión</h2>
          <p className="mt-1 text-sm text-text-muted">
            Seleccione un usuario y rol de demostración para ingresar.
          </p>

          <div className="mt-8 space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">Usuario de demostración</label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Seleccione un usuario" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.firstName} {u.lastName} — {ROLES[u.role].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">Rol</label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_LIST.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleLogin} className="h-10 w-full" size="default">
              <LogIn className="mr-2 h-4 w-4" />
              Ingresar al sistema
            </Button>
          </div>

          <div className="mt-6 flex items-start gap-2 rounded-lg border border-info/20 bg-info-soft p-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
            <p className="text-xs text-text-secondary">
              <span className="font-semibold text-info">Entorno de demostración.</span> No se requieren credenciales reales. Los datos se almacenan localmente en su navegador.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
