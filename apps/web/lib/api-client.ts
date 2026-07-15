import createClient from "openapi-fetch";
import { getAccessToken, refreshAccessToken } from "@/lib/auth-session";
import { API_BASE_URL } from "@/lib/api-config";

/**
 * Base URL of the SGA backend API. Falls back to localhost for dev.
 */
/**
 * Type-safe API client. The `paths` generic is intentionally kept as
 * `Record<string, never>` until generated types are introduced; in the
 * meantime, callers can pass `// @ts-expect-error` for unmatched shapes.
 */
export const apiClient = createClient<Record<string, never>>({
  baseUrl: API_BASE_URL,
  credentials: "include",
});

apiClient.use({
  async onRequest({ request }) {
    const token = getAccessToken();
    if (token) request.headers.set("Authorization", `Bearer ${token}`);
    return request;
  },
});

function withAuth(headers: Headers): Headers {
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

/**
 * HTML controls represent an unfilled optional field with an empty string.
 * Remove those values from JSON objects so the API validates only supplied
 * optional data. Required DTO fields will still fail when omitted.
 */
function normalizeJsonPayload(value: unknown): unknown {
  if (typeof value === "string") return value.trim() === "" ? undefined : value;
  if (Array.isArray(value)) return value.map(normalizeJsonPayload);
  if (
    value &&
    typeof value === "object" &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  ) {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, item]) => [key, normalizeJsonPayload(item)] as const)
        .filter(([, item]) => item !== undefined),
    );
  }
  return value;
}

/**
 * Convenience tiny fetch helper for endpoints that aren't yet wired to the
 * typed client. Throws on non-2xx with the backend's payload (if any).
 * Inyecta el access token automáticamente e intenta refresh en 401.
 */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const headers = withAuth(new Headers(init?.headers));
  let body: BodyInit | undefined = init?.body ?? undefined;
  if (init?.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(normalizeJsonPayload(init.json));
  }

  const doFetch = () =>
    fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
      body,
      credentials: "include",
    });

  let res = await doFetch();

  // Reintento transparente si el access token expiró.
  const mayRefresh = path !== "/auth/login" && path !== "/auth/refresh";
  if (res.status === 401 && mayRefresh && !headers.has("x-sga-retried")) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const token = getAccessToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);
      headers.set("x-sga-retried", "1");
      res = await doFetch();
    }
  }

  if (!res.ok) {
    let payload: unknown;
    try {
      payload = await res.json();
    } catch {
      payload = undefined;
    }
    const msg =
      payload && typeof payload === "object" && "message" in payload
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
  return apiFetch<T>(path, { method: "POST", body: form });
}
