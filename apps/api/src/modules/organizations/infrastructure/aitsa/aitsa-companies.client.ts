import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ExternalCompanyQuery,
  ExternalCompanyRecord,
  ExternalCompanyRegistryPort,
  ExternalRegistryError,
} from '../../domain/external-company-registry.port';

const DEFAULT_BASE_URL = 'http://172.31.254.69/JWTServicios';
const DEFAULT_TIMEOUT_MS = 15_000;
/** Used when the token response carries no `expires_in`. */
const DEFAULT_TOKEN_TTL_MS = 30 * 60_000;
/** Refresh slightly before the reported expiry to avoid edge 401s. */
const TOKEN_EXPIRY_MARGIN_MS = 60_000;

interface CachedToken {
  value: string;
  expiresAt: number;
}

/**
 * HTTP adapter for the AITSA "API TOCUMEN - SGA" (v0.0.1).
 *
 *  - POST {base}/auth/token  body {ClientId, Secret} -> bearer token
 *  - GET  {base}/api/v1/get-consulta-empresas?fechaDesde|ruc|nombre|clienteId
 *
 * The token is cached in memory until shortly before it expires; a 401 on the
 * query endpoint forces one refresh + retry.
 */
@Injectable()
export class AitsaCompaniesClient implements ExternalCompanyRegistryPort {
  readonly source = 'AITSA';
  private readonly logger = new Logger(AitsaCompaniesClient.name);
  private readonly baseUrl: string;
  private readonly clientId: string | undefined;
  private readonly secret: string | undefined;
  private readonly timeoutMs: number;
  private token: CachedToken | null = null;

  constructor(config: ConfigService) {
    this.baseUrl = (
      config.get<string>('AITSA_API_BASE_URL') || DEFAULT_BASE_URL
    ).replace(/\/+$/, '');
    this.clientId = config.get<string>('AITSA_API_CLIENT_ID') || undefined;
    this.secret = config.get<string>('AITSA_API_SECRET') || undefined;
    this.timeoutMs =
      Number(config.get('AITSA_API_TIMEOUT_MS')) || DEFAULT_TIMEOUT_MS;
  }

  isConfigured(): boolean {
    return Boolean(this.clientId && this.secret);
  }

  async search(query: ExternalCompanyQuery): Promise<ExternalCompanyRecord[]> {
    if (!this.isConfigured()) {
      throw new ExternalRegistryError(
        'AITSA API is not configured (AITSA_API_CLIENT_ID / AITSA_API_SECRET)',
      );
    }
    const params = new URLSearchParams();
    if (query.fechaDesde) params.set('fechaDesde', query.fechaDesde);
    if (query.ruc) params.set('ruc', query.ruc);
    if (query.nombre) params.set('nombre', query.nombre);
    if (query.clienteId) params.set('clienteId', query.clienteId);
    const url = `${this.baseUrl}/api/v1/get-consulta-empresas${
      params.size ? `?${params.toString()}` : ''
    }`;

    let res = await this.authorizedGet(url, false);
    if (res.status === 401) {
      this.token = null;
      res = await this.authorizedGet(url, true);
    }
    // Some gateways answer 404 for "no matches" — treat it as an empty result.
    if (res.status === 404) return [];
    if (!res.ok) {
      throw new ExternalRegistryError(
        `AITSA get-consulta-empresas failed with HTTP ${res.status}`,
      );
    }
    const body = await this.readJson(res);
    return extractRecords(body)
      .map(normalizeRecord)
      .filter((r): r is ExternalCompanyRecord => r !== null);
  }

  private async authorizedGet(
    url: string,
    forceRefresh: boolean,
  ): Promise<Response> {
    const token = await this.getToken(forceRefresh);
    return this.fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
  }

  private async getToken(forceRefresh: boolean): Promise<string> {
    if (!forceRefresh && this.token && this.token.expiresAt > Date.now()) {
      return this.token.value;
    }
    const res = await this.fetchWithTimeout(`${this.baseUrl}/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ ClientId: this.clientId, Secret: this.secret }),
    });
    if (!res.ok) {
      throw new ExternalRegistryError(
        `AITSA authentication failed with HTTP ${res.status}`,
      );
    }
    const raw = await res.text();
    const parsed = parseToken(raw);
    if (!parsed) {
      throw new ExternalRegistryError(
        'AITSA authentication returned no access token',
      );
    }
    const ttl = parsed.expiresInSec
      ? parsed.expiresInSec * 1000
      : DEFAULT_TOKEN_TTL_MS;
    this.token = {
      value: parsed.token,
      expiresAt: Date.now() + Math.max(ttl - TOKEN_EXPIRY_MARGIN_MS, 5_000),
    };
    return parsed.token;
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (err) {
      const reason =
        (err as Error).name === 'AbortError'
          ? `timeout after ${this.timeoutMs}ms`
          : (err as Error).message;
      this.logger.warn(`AITSA request to ${url} failed: ${reason}`);
      throw new ExternalRegistryError(`AITSA API unreachable: ${reason}`);
    } finally {
      clearTimeout(timer);
    }
  }

  private async readJson(res: Response): Promise<unknown> {
    const text = await res.text();
    if (!text.trim()) return [];
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new ExternalRegistryError('AITSA API returned invalid JSON');
    }
  }
}

/**
 * The PDF only says "Bearer Token", so accept the common shapes:
 * `{access_token, expires_in}`, `{accessToken}`, `{token}`, `{data:{token}}`
 * or a bare (optionally quoted) JWT string.
 */
export function parseToken(
  raw: string,
): { token: string; expiresInSec: number | null } | null {
  const text = raw.trim();
  if (!text) return null;
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return { token: text, expiresInSec: null };
  }
  if (typeof body === 'string') {
    return body ? { token: body, expiresInSec: null } : null;
  }
  const pick = (obj: unknown): Record<string, unknown> | null =>
    obj && typeof obj === 'object' ? (obj as Record<string, unknown>) : null;
  const root = pick(body);
  if (!root) return null;
  for (const candidate of [root, pick(root.data), pick(root.result)]) {
    if (!candidate) continue;
    const token =
      candidate.access_token ??
      candidate.accessToken ??
      candidate.token ??
      candidate.Token ??
      candidate.AccessToken;
    if (typeof token === 'string' && token) {
      const exp = Number(
        candidate.expires_in ?? candidate.expiresIn ?? candidate.ExpiresIn,
      );
      return {
        token,
        expiresInSec: Number.isFinite(exp) && exp > 0 ? exp : null,
      };
    }
  }
  return null;
}

/** Accepts a bare array, `{data|items|result|empresas: [...]}` or one object. */
export function extractRecords(body: unknown): unknown[] {
  if (Array.isArray(body)) return body as unknown[];
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>;
    for (const key of ['data', 'items', 'result', 'empresas', 'value']) {
      const v = obj[key];
      if (Array.isArray(v)) return v as unknown[];
      if (v && typeof v === 'object') return [v];
    }
    if ('cliente_Id' in obj || 'clienteId' in obj) return [obj];
  }
  return [];
}

function str(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

/** Field names follow the PDF (`cliente_Id`), with lenient casing fallbacks. */
export function normalizeRecord(raw: unknown): ExternalCompanyRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const clienteId = str(r.cliente_Id ?? r.clienteId ?? r.cliente_id);
  const nombre = str(r.nombre);
  if (!clienteId || !nombre) return null;
  return {
    clienteId,
    nombre,
    nombreComercial: str(r.nombreComercial ?? r.nombre_comercial),
    ruc: str(r.ruc),
    dv: str(r.dv),
    correo: str(r.correo),
    telefono: str(r.telefono),
    direccion: str(r.direccion),
    contacto: str(r.contacto),
    estado: str(r.estado),
  };
}
