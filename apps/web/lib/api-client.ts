import createClient from 'openapi-fetch';

/**
 * Base URL of the SGA backend API. Falls back to localhost for dev.
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

/**
 * Type-safe API client. The `paths` generic is intentionally kept as
 * `Record<string, never>` until generated types are introduced; in the
 * meantime, callers can pass `// @ts-expect-error` for unmatched shapes.
 */
export const apiClient = createClient<Record<string, never>>({
  baseUrl: API_BASE_URL,
  credentials: 'include',
});

/**
 * Convenience tiny fetch helper for endpoints that aren't yet wired to the
 * typed client. Throws on non-2xx with the backend's payload (if any).
 */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const headers = new Headers(init?.headers);
  let body: BodyInit | undefined = init?.body ?? undefined;
  if (init?.json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(init.json);
  }
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    body,
    credentials: 'include',
  });
  if (!res.ok) {
    let payload: unknown;
    try {
      payload = await res.json();
    } catch {
      payload = undefined;
    }
    const msg =
      payload && typeof payload === 'object' && 'message' in payload
        ? String((payload as { message: unknown }).message)
        : res.statusText;
    const err = new Error(`API ${res.status}: ${msg}`) as Error & {
      status: number;
      payload: unknown;
    };
    err.status = res.status;
    err.payload = payload;
    throw err;
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/**
 * Apply multipart form-data for file uploads.
 */
export async function apiUpload<T>(
  path: string,
  fields: Record<string, string | Blob | null>,
): Promise<T> {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v !== null && v !== undefined) form.append(k, v);
  }
  return apiFetch<T>(path, { method: 'POST', body: form });
}
