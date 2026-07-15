'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import {
  getAccessToken,
  refreshAccessToken,
  setAccessToken,
} from '@/lib/auth-session';
import { mapBackendRoleToFrontend } from '@/lib/role-mapping';
import type { AuthenticatedProfile } from '@/lib/types';

/** Respuesta de `POST /auth/login` según el backend. */
export interface AuthLoginResponse {
  accessToken: string;
  user: AuthenticatedProfile;
}

export interface UseLoginInput {
  email: string;
  password: string;
}

/**
 * Mutación de login contra el backend.
 *
 * 1. Llama a `POST /api/v1/auth/login`.
 * 2. Persiste el access token en memoria (no en localStorage).
 * 3. Devuelve el perfil del usuario + el rol mapeado al vocabulario del store.
 *
 * El refresh token llega como cookie httpOnly gestionada por el backend.
 */
export function useLoginMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, password }: UseLoginInput) => {
      const data = await apiFetch<AuthLoginResponse>('/auth/login', {
        method: 'POST',
        json: { email, password },
      });
      setAccessToken(data.accessToken);
      return data;
    },
    onSuccess: (data) => {
      // Sustituye cualquier 401 cacheado durante el bootstrap antes de entrar
      // al layout privado. Así AppShell nunca interpreta el login nuevo como
      // una sesión fallida anterior.
      queryClient.setQueryData(['auth', 'me'], data.user);
    },
  });
}

export function useCurrentSessionQuery(enabled = true) {
  return useQuery({
    enabled,
    queryKey: ['auth', 'me'],
    retry: false,
    queryFn: async () => {
      // Tras recargar, el access token en memoria no existe. Recuperarlo antes
      // de consultar /me evita un 401 deliberado en cada arranque.
      if (!getAccessToken()) {
        const restored = await refreshAccessToken();
        if (!restored) {
          const error = new Error('No active session') as Error & {
            status: number;
          };
          error.status = 401;
          throw error;
        }
      }
      return apiFetch<AuthenticatedProfile>('/auth/me');
    },
  });
}

/**
 * Mutación de logout. Revoca la sesión en el backend y limpia el access token.
 */
export function useLogoutMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      // 204 No Content; los errores de red se ignoran para no bloquear el cierre.
      try {
        await apiFetch<void>('/auth/logout', { method: 'POST' });
      } catch {
        /* no-op: el token local debe limpiarse igual */
      }
      setAccessToken(null);
    },
    onSettled: () => {
      queryClient.removeQueries({ queryKey: ['auth'] });
    },
  });
}

/**
 * Dada la respuesta de login, construye el snapshot para `CurrentUser`.
 */
export function buildCurrentUser(user: AuthenticatedProfile) {
  return {
    userId: user.id,
    role: mapBackendRoleToFrontend(user.roles),
    profile: user,
  };
}
