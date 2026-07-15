'use client';

import { API_BASE_URL } from '@/lib/api-config';

/**
 * Gestión del access token del SGA en el navegador.
 *
 * El backend entrega el refresh token como cookie httpOnly (no accesible desde
 * JS) y el access token en el cuerpo de `/auth/login` y `/auth/refresh`. El
 * access token tiene TTL corto (15 m), por lo que lo guardamos únicamente en
 * memoria y lo refrescamos transparentemente cuando expira o al recargar la
 * pestaña mediante `/auth/refresh` (que sí tiene acceso a la cookie).
 *
 * Nunca persistimos el access token en localStorage: si lo hiciéramos, un
 * ataque XSS podría leerlo directamente. Con cookie httpOnly + token en
 * memoria sólo se expone durante la ejecución del JS legítimo.
 */

let accessToken: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;
const listeners = new Set<(token: string | null) => void>();

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
  for (const l of listeners) l(token);
}

export function onAccessTokenChange(
  cb: (token: string | null) => void,
): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/**
 * Intenta refrescar el access token usando la cookie httpOnly de refresh.
 * Devuelve `true` si la sesión sigue activa y se emitió un nuevo token.
 * Lanza si la sesión caducó o no existe cookie (usuario no logueado).
 */
export async function refreshAccessToken(): Promise<boolean> {
  // El refresh token es rotativo: dos refresh concurrentes harían que el
  // segundo reutilizase una cookie ya revocada. Todas las llamadas de la
  // pestaña deben compartir exactamente la misma operación.
  if (refreshInFlight) return refreshInFlight;

  const tokenBeforeRefresh = accessToken;
  const refresh = (async () => {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) {
      // No borres un token emitido por un login que pudo completarse mientras
      // este request estaba en vuelo.
      if (accessToken === tokenBeforeRefresh) setAccessToken(null);
      return false;
    }
    const data = (await res.json()) as { accessToken: string };
    setAccessToken(data.accessToken);
    return true;
  })();

  refreshInFlight = refresh;
  try {
    return await refresh;
  } finally {
    if (refreshInFlight === refresh) refreshInFlight = null;
  }
}
