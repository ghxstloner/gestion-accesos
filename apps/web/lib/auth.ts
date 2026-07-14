import type { User } from '@/lib/types';

export type AuthFailureKind = 'invalid' | 'blocked';

export type AuthResult =
  | { ok: true; user: User }
  | { ok: false; kind: AuthFailureKind };

/**
 * Credenciales institucionales de demostración del SGA.
 * La clave es el usuario (en minúsculas) y el valor indica la contraseña
 * válida y la cuenta a la que da acceso.
 */
const DEMO_CREDENTIALS: Record<string, { password: string; userId: string }> = {
  admin: { password: '123456', userId: 'us_admin' },
};

/**
 * Autenticación para el entorno de demostración del SGA.
 *
 * Valida usuario y contraseña contra el registro de credenciales de demostración
 * y resuelve la cuenta institucional (con su rol y permisos derivados
 * automáticamente de la propia cuenta).
 */
export function authenticateUser(
  users: User[],
  username: string,
  password: string
): AuthResult {
  const normalized = username.trim().toLowerCase();
  if (!normalized || !password) {
    return { ok: false, kind: 'invalid' };
  }

  const credential = DEMO_CREDENTIALS[normalized];
  if (!credential || credential.password !== password) {
    return { ok: false, kind: 'invalid' };
  }

  const user = users.find((u) => u.id === credential.userId);
  if (!user) {
    return { ok: false, kind: 'invalid' };
  }
  if (user.status === 'BLOCKED') {
    return { ok: false, kind: 'blocked' };
  }
  return { ok: true, user };
}
