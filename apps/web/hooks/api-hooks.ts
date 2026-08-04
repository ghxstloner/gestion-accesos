"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiUpload } from "@/lib/api-client";
import { API_BASE_URL } from "@/lib/api-config";
import { getAccessToken } from "@/lib/auth-session";
import type {
  Company,
  User,
  AuthorizedSigner,
  Role,
} from "@/lib/types";
import { mapBackendRoleToFrontend } from "@/lib/role-mapping";

// ── Types (mirrored from backend DTOs) ──

export interface CatalogItemResponse {
  id: string;
  kind: string;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  displayOrder: number;
  parentZoneCode: string | null;
  metadata: Record<string, unknown> | null;
}

export interface AuthorizedSignerResponse {
  id: string;
  companyId: string;
  signerUserId: string;
  position: string;
  validFrom: string;
  validUntil: string | null;
  status: string;
  effectiveStatus: string;
  createdAt: string;
}

export interface UserResponse {
  id: string;
  companyId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: string[];
  additionalPermissions: string[];
  status: string;
  lastAccessAt: string | null;
  createdAt: string;
  photoUrl: string | null;
  mustChangePassword: boolean;
  temporaryPassword?: string;
}

// ── Catalogs ──

export function useCatalogsQuery(kind: string) {
  return useQuery({
    queryKey: ["catalogs", kind],
    queryFn: () =>
      apiFetch<CatalogItemResponse[]>(`/catalogs/${encodeURIComponent(kind)}`),
  });
}

export function useCatalogUpsertMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      kind: string;
      code: string;
      name: string;
      description?: string | null;
      displayOrder?: number;
    }) =>
      apiFetch<CatalogItemResponse>(
        `/catalogs/${encodeURIComponent(input.kind)}`,
        {
          method: "POST",
          json: {
            code: input.code,
            name: input.name,
            description: input.description,
            displayOrder: input.displayOrder,
          },
        },
      ),
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: ["catalogs", vars.kind] }),
  });
}

// ── Companies ──

/** Respuesta de `/companies` (la usan tanto el listado como el detalle). */
export interface CompanyResponse {
  id: string;
  legalName: string;
  tradeName: string | null;
  taxIdentifier: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  logoUrl: string | null;
  mainContactName: string | null;
  status: string;
  createdAt: string;
  updatedAt?: string;
}

/** Cuerpo para `POST /companies`. campos opcionales permitidos por el backend. */
export interface CreateCompanyInput {
  legalName: string;
  tradeName?: string;
  taxIdentifier?: string;
  email?: string;
  phone?: string;
  address?: string;
  mainContactName?: string;
  logoUrl?: string;
}

/** Cuerpo para `PATCH /companies/:id` (todos opcionales). */
export type UpdateCompanyInput = Partial<CreateCompanyInput>;

/**
 * Normaliza la respuesta del backend al shape que usan los componentes del
 * front (`Company` en `lib/types.ts` conserva `taxId` y `primaryContact`
 * por compatibilidad con el resto del store; en algún momento se unificará).
 */
export function toCompany(row: CompanyResponse): Company {
  return {
    id: row.id,
    legalName: row.legalName,
    tradeName: row.tradeName ?? row.legalName,
    taxId: row.taxIdentifier ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    address: row.address ?? "",
    logoUrl: row.logoUrl ?? undefined,
    primaryContact: row.mainContactName ?? "",
    status: (row.status === "ACTIVE"
      ? "ACTIVE"
      : row.status === "SUSPENDED"
        ? "INACTIVE"
        : "INACTIVE") as Company["status"],
    createdAt: row.createdAt,
  };
}

type CompaniesListResponse =
  | CompanyResponse[]
  | { items: CompanyResponse[]; total: number; page: number; limit: number };

function normalizeCompaniesList(payload: CompaniesListResponse): Company[] {
  const rows = Array.isArray(payload) ? payload : payload.items;
  return rows.map(toCompany);
}

export function useCompaniesQuery(filters?: {
  search?: string;
  status?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.search) params.set("search", filters.search);
  if (filters?.status) params.set("status", filters.status);
  return useQuery({
    queryKey: ["companies", filters ?? null],
    queryFn: async () => {
      const data = await apiFetch<CompaniesListResponse>(
        `/companies?${params.toString()}`,
      );
      return normalizeCompaniesList(data);
    },
  });
}

export function useCompanyQuery(id: string | null) {
  return useQuery({
    enabled: Boolean(id),
    queryKey: ["company", id],
    queryFn: async () => {
      const data = await apiFetch<CompanyResponse>(`/companies/${id!}`);
      return toCompany(data);
    },
  });
}

export function useCreateCompanyMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCompanyInput) =>
      apiFetch<CompanyResponse>("/companies", { method: "POST", json: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["companies"] }),
  });
}

export function useUpdateCompanyMutation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateCompanyInput) =>
      apiFetch<CompanyResponse>(`/companies/${id}`, {
        method: "PATCH",
        json: input,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["company", id] });
    },
  });
}

export function useToggleCompanyStatusMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; activate: boolean }) => {
      const action = args.activate ? "activate" : "deactivate";
      return apiFetch<CompanyResponse>(`/companies/${args.id}/${action}`, {
        method: "POST",
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["companies"] }),
  });
}

export function useUpdateCatalogMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      kind: string;
      id: string;
      name: string;
      code: string;
      description?: string | null;
      displayOrder?: number;
    }) =>
      apiFetch<CatalogItemResponse>(`/catalogs/${input.kind}/${input.id}`, {
        method: "PATCH",
        json: {
          name: input.name,
          code: input.code,
          description: input.description,
          displayOrder: input.displayOrder,
        },
      }),
    onSuccess: (_data, input) =>
      qc.invalidateQueries({ queryKey: ["catalogs", input.kind] }),
  });
}

export function useToggleCatalogMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { kind: string; id: string; activate: boolean }) =>
      apiFetch<void>(
        `/catalogs/${input.kind}/${input.id}/${input.activate ? "activate" : "deactivate"}`,
        { method: "POST" },
      ),
    onSuccess: (_data, input) =>
      qc.invalidateQueries({ queryKey: ["catalogs", input.kind] }),
  });
}

// ── Authorized Signers ──

export function useAuthorizedSignersQuery(companyId?: string) {
  const params = new URLSearchParams();
  if (companyId) params.set("companyId", companyId);
  return useQuery({
    queryKey: ["authorized-signers", companyId],
    queryFn: async () => {
      const data = await apiFetch<{ items: AuthorizedSignerResponse[] }>(
        `/authorized-signers?${params.toString()}`,
      );
      return data.items.map(toSigner);
    },
  });
}

function toSigner(row: AuthorizedSignerResponse): AuthorizedSigner {
  return {
    id: row.id,
    companyId: row.companyId,
    signerUserId: row.signerUserId,
    position: row.position,
    startDate: row.validFrom.slice(0, 10),
    endDate: row.validUntil?.slice(0, 10) ?? "",
    status: row.effectiveStatus === "ACTIVE" ? "ACTIVE" : "INACTIVE",
    createdAt: row.createdAt,
  };
}

export function useCreateAuthorizedSignerMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      signerUserId: string;
      position: string;
      validFrom: string;
      validUntil?: string;
    }) =>
      apiFetch<AuthorizedSignerResponse>("/authorized-signers", {
        method: "POST",
        json: input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["authorized-signers"] }),
  });
}

// ── Users ──

export function useUsersQuery(companyId?: string) {
  const params = new URLSearchParams();
  if (companyId) params.set("companyId", companyId);
  return useQuery({
    queryKey: ["users", companyId],
    queryFn: async () => {
      const data = await apiFetch<{ items: UserResponse[] }>(
        `/users?${params.toString()}`,
      );
      return data.items.map(toUser);
    },
  });
}

export function useUpdateAuthorizedSignerMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      position: string;
      validFrom: string;
      validUntil?: string;
    }) =>
      apiFetch<AuthorizedSignerResponse>(`/authorized-signers/${input.id}`, {
        method: "PATCH",
        json: {
          position: input.position,
          validFrom: input.validFrom,
          validUntil: input.validUntil || null,
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["authorized-signers"] }),
  });
}

export function useToggleAuthorizedSignerMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; activate: boolean; reason?: string }) =>
      apiFetch<void>(
        `/authorized-signers/${input.id}/${input.activate ? "activate" : "revoke"}`,
        {
          method: "POST",
          json: input.activate
            ? undefined
            : { reason: input.reason || "Revocado por administrador" },
        },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["authorized-signers"] }),
  });
}

function toUser(row: UserResponse): User {
  return {
    id: row.id,
    companyId: row.companyId ?? "",
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    role: mapBackendRoleToFrontend(row.roles),
    permissions: row.permissions,
    additionalPermissions: row.additionalPermissions ?? [],
    status: row.status as User["status"],
    lastAccess: row.lastAccessAt,
    createdAt: row.createdAt,
    photoUrl: row.photoUrl ?? undefined,
    mustChangePassword: row.mustChangePassword,
    temporaryPassword: row.temporaryPassword,
  };
}

export const FRONTEND_TO_BACKEND_ROLE: Record<Role, string> = {
  ADMIN_GENERAL: "SYSTEM_ADMIN",
  ADMIN_EMPRESA: "COMPANY_ADMIN",
  SOLICITANTE: "APPLICANT",
  REVISOR: "DOCUMENT_RECEIVER",
  JEFE_DOCUMENTOS: "ACCESS_DOCUMENTS_MANAGER",
  EMISOR_CARNE: "CARD_ISSUER",
};

export function useUserQuery(id: string | null) {
  return useQuery({
    enabled: Boolean(id),
    queryKey: ["user", id],
    queryFn: async () => toUser(await apiFetch<UserResponse>(`/users/${id!}`)),
  });
}

export function useCreateUserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      companyId?: string;
      firstName: string;
      lastName: string;
      email: string;
      password?: string;
      role: Role;
      additionalPermissions?: string[];
    }) =>
      apiFetch<UserResponse>("/users", {
        method: "POST",
        json: {
          ...input,
          companyId: input.companyId || undefined,
          roleCodes: [FRONTEND_TO_BACKEND_ROLE[input.role]],
          role: undefined,
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useUpdateUserMutation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: Partial<{
        companyId: string | null;
        firstName: string;
        lastName: string;
        email: string;
        role: Role;
        additionalPermissions: string[];
      }>,
    ) => {
      const { role, additionalPermissions, ...profile } = input;
      if (Object.keys(profile).length)
        await apiFetch(`/users/${id}`, { method: "PATCH", json: profile });
      if (role)
        await apiFetch(`/users/${id}/roles`, {
          method: "PUT",
          json: { roleCodes: [FRONTEND_TO_BACKEND_ROLE[role]] },
        });
      if (additionalPermissions)
        await apiFetch(`/users/${id}/permissions`, {
          method: "PUT",
          json: { permissionCodes: additionalPermissions },
        });
      return toUser(await apiFetch<UserResponse>(`/users/${id}`));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["user", id] });
    },
  });
}

export function useToggleUserStatusMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, activate }: { id: string; activate: boolean }) =>
      apiFetch<UserResponse>(
        `/users/${id}/${activate ? "activate" : "block"}`,
        { method: "POST" },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useResetUserPasswordMutation() {
  return useMutation({
    mutationFn: ({ id, newPassword }: { id: string; newPassword?: string }) =>
      apiFetch<{ temporaryPassword: string }>(`/users/${id}/reset-password`, {
        method: "POST",
        json: { newPassword },
      }),
  });
}

export function useUploadUserPhotoMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      apiUpload<UserResponse>(`/users/${id}/photo`, { file }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["user", data.id] });
      qc.invalidateQueries({ queryKey: ["auth", "me"] });
    },
  });
}

export interface NotificationResponse {
  id: string;
  type: string;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
}

export function useNotificationsQuery() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiFetch<NotificationResponse[]>("/notifications"),
  });
}

export function useMarkNotificationReadMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/notifications/${id}/read`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    },
  });
}

export function useMarkAllNotificationsReadMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<void>("/notifications/read-all", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    },
  });
}

export function useUnreadNotificationsCountQuery() {
  return useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => apiFetch<{ count: number }>("/notifications/unread-count"),
    refetchInterval: 60_000, // poll every minute for the bell badge
    refetchOnWindowFocus: true,
  });
}

// ──────────────────────────────────────────────────────────────────────────
// Phase 3 — Alerts & operational alerts
// ──────────────────────────────────────────────────────────────────────────

export type AlertSeverity = "INFO" | "WARN" | "CRITICAL";
export type AlertStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
export type AlertRuleScope =
  | "CREDENTIAL"
  | "CUSTODY"
  | "WORKFLOW"
  | "REVIEW"
  | "JOB";

export interface OperationalAlertResponse {
  id: string;
  ruleId: string;
  ruleCode: string;
  severity: AlertSeverity;
  entityType: string;
  entityId: string;
  title: string;
  message: string;
  observedAt: string;
  status: AlertStatus;
  acknowledgedByUserId: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface OperationalAlertsPage {
  items: OperationalAlertResponse[];
  total: number;
  page: number;
  limit: number;
}

export interface AlertsListFilters {
  scope?: AlertRuleScope;
  severity?: AlertSeverity;
  status?: AlertStatus;
  page?: number;
  limit?: number;
}

export function useAlertsQuery(filters: AlertsListFilters = {}) {
  const params = new URLSearchParams();
  if (filters.scope) params.set("scope", filters.scope);
  if (filters.severity) params.set("severity", filters.severity);
  if (filters.status) params.set("status", filters.status);
  params.set("page", String(filters.page ?? 1));
  params.set("limit", String(filters.limit ?? 50));
  const qs = params.toString();
  return useQuery({
    queryKey: ["alerts", filters],
    queryFn: () =>
      apiFetch<OperationalAlertsPage>(`/alerts${qs ? "?" + qs : ""}`),
  });
}

export function useAcknowledgeAlertMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/alerts/${id}/acknowledge`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });
}

export function useResolveAlertMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/alerts/${id}/resolve`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });
}

// ──────────────────────────────────────────────────────────────────────────
// Phase 4 — Audit query + detail + CSV export
// ──────────────────────────────────────────────────────────────────────────

export interface AuditEventDetailResponse {
  id: string;
  actorUserId: string | null;
  actorCompanyId: string | null;
  action: string;
  aggregateType: string;
  aggregateId: string | null;
  previousData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  correlationId: string | null;
  occurredAt: string;
}

export interface AuditEventsPage {
  items: AuditEventDetailResponse[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuditQueryFilters {
  from?: string;
  to?: string;
  actorUserId?: string;
  actorCompanyId?: string;
  action?: string;
  aggregateType?: string;
  aggregateId?: string;
  correlationId?: string;
  result?: "SUCCESS" | "FAILURE";
  page?: number;
  pageSize?: number;
}

function buildAuditQuerystring(filters: AuditQueryFilters): string {
  const params = new URLSearchParams();
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.actorUserId) params.set("actorUserId", filters.actorUserId);
  if (filters.actorCompanyId) params.set("actorCompanyId", filters.actorCompanyId);
  if (filters.action) params.set("action", filters.action);
  if (filters.aggregateType) params.set("aggregateType", filters.aggregateType);
  if (filters.aggregateId) params.set("aggregateId", filters.aggregateId);
  if (filters.correlationId) params.set("correlationId", filters.correlationId);
  if (filters.result) params.set("result", filters.result);
  params.set("page", String(filters.page ?? 1));
  params.set("pageSize", String(filters.pageSize ?? 20));
  return params.toString();
}

/** Exported for testing — produces the querystring used by audit hooks. */
export function __buildAuditQuerystringForTest(filters: AuditQueryFilters): string {
  return buildAuditQuerystring(filters);
}

export function useAuditAdvancedQueryQuery(filters: AuditQueryFilters = {}) {
  const qs = buildAuditQuerystring(filters);
  return useQuery({
    queryKey: ["audit", "query", filters],
    queryFn: () =>
      apiFetch<AuditEventsPage>(`/audit/query${qs ? "?" + qs : ""}`),
  });
}

export function useAuditEventDetailQuery(id: string | null) {
  return useQuery({
    enabled: Boolean(id),
    queryKey: ["audit", "detail", id],
    queryFn: () => apiFetch<AuditEventDetailResponse | null>(`/audit/${id!}`),
  });
}

/**
 * Trigger a CSV download of the filtered audit events. Server-side audited.
 * Returns a function the caller invokes; uses a Blob anchor download.
 */
export function useAuditExportCsvMutation() {
  return useMutation({
    mutationFn: async (filters: AuditQueryFilters): Promise<Blob> => {
      const qs = buildAuditQuerystring({ ...filters, page: 1, pageSize: 10_000 });
      return downloadAuditCsv(qs);
    },
  });
}

/**
 * Pure CSV-download helper — exported for unit testing the URL & headers.
 * Accepts injectable fetch/URL runtime so tests can avoid global state.
 */
export async function downloadAuditCsv(
  querystring: string,
  deps: {
    fetchImpl?: typeof fetch;
    baseUrl?: string;
    token?: string | null;
    trigger?: (url: string, filename: string) => void;
  } = {},
): Promise<Blob> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const baseUrl = deps.baseUrl ?? API_BASE_URL;
  const token = deps.token ?? getAccessToken();
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetchImpl(`${baseUrl}/audit/export${querystring ? "?" + querystring : ""}`, {
    headers,
    credentials: "include",
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const blob = await res.blob();
  if (deps.trigger) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    deps.trigger(`${baseUrl}/audit/export`, `audit-${stamp}.csv`);
  }
  return blob;
}

// ──────────────────────────────────────────────────────────────────────────
// Phase 4 — Dashboard aggregation
// ──────────────────────────────────────────────────────────────────────────

export interface DashboardSummaryResponse {
  pendingRequests: number;
  pendingIssuance: number;
  nearExpiryCredentials: number;
  overdueCustody: number;
  criticalAlerts: number;
  overdueSlaTasks: number;
  recentActivity: {
    id: string;
    actorUserId: string | null;
    action: string;
    aggregateType: string;
    aggregateId: string | null;
    occurredAt: string;
  }[];
  nearExpiryDays: number;
  scope: "GLOBAL" | "COMPANY" | "OWN";
}

export function useDashboardSummaryQuery(nearExpiryDays?: number) {
  const qs = nearExpiryDays ? `?nearExpiryDays=${nearExpiryDays}` : "";
  return useQuery({
    queryKey: ["dashboard", "summary", nearExpiryDays ?? null],
    queryFn: () =>
      apiFetch<DashboardSummaryResponse>(`/dashboard/summary${qs}`),
    refetchInterval: 60_000,
  });
}

// ──────────────────────────────────────────────────────────────────────────
// Phase 4 — Operational reports
// ──────────────────────────────────────────────────────────────────────────

export interface ReportRange {
  from?: string;
  to?: string;
  companyId?: string;
  days?: number;
}

function buildReportQuerystring(range: ReportRange): string {
  const params = new URLSearchParams();
  if (range.from) params.set("from", range.from);
  if (range.to) params.set("to", range.to);
  if (range.companyId) params.set("companyId", range.companyId);
  if (range.days) params.set("days", String(range.days));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export interface StatusCount {
  status: string;
  count: number;
}
export interface TypeCount {
  typeId: string;
  code: string;
  name: string;
  count: number;
}
export interface CompanyCount {
  companyId: string;
  name: string;
  count: number;
}
export interface StageTimeRow {
  taskType: string;
  avgMs: number;
  count: number;
}
export interface ReasonOutcome {
  outcome: "RETURNED" | "REJECTED";
  reason: { id: string | null; name: string };
  count: number;
}
export interface CustodyStatusReport {
  active: { items: unknown[]; total: number };
  overdue: { items: unknown[]; total: number };
}
export interface AlertsBreakdownReport {
  byScope: { scope: string; count: number }[];
  bySeverity: { severity: string; count: number }[];
  byStatus: { status: string; count: number }[];
}
export interface SlaReport {
  totalOpen: number;
  overdue: number;
  onTime: number;
  compliancePct: number;
}
export interface ProductivityRow {
  userId: string;
  name: string;
  produced: number;
  delivered: number;
}
export interface CredentialsExpiringItem {
  id: string;
  credentialNumber: string;
  holderName: string | null;
  expiresAt: string;
  status: string;
}
export interface CredentialsExpiringReport {
  items: CredentialsExpiringItem[];
  total: number;
  horizon: string;
}

const reportEndpoints = {
  requestsByStatus: "/reports/requests/by-status",
  requestsByType: "/reports/requests/by-type",
  requestsByCompany: "/reports/requests/by-company",
  stageAvg: "/reports/stage/average-time",
  returned: "/reports/requests/returned-rejected",
  credentialsByStatus: "/reports/credentials/by-status",
  credentialsExpiring: "/reports/credentials/expiring",
  custody: "/reports/custody/status",
  alerts: "/reports/alerts/breakdown",
  sla: "/reports/sla/compliance",
  productivity: "/reports/productivity",
} as const;

export function useRequestsByStatusReport(range: ReportRange = {}) {
  return useQuery({
    queryKey: ["reports", "requests-by-status", range],
    queryFn: () =>
      apiFetch<StatusCount[]>(
        `${reportEndpoints.requestsByStatus}${buildReportQuerystring(range)}`,
      ),
  });
}
export function useRequestsByTypeReport(range: ReportRange = {}) {
  return useQuery({
    queryKey: ["reports", "requests-by-type", range],
    queryFn: () =>
      apiFetch<TypeCount[]>(
        `${reportEndpoints.requestsByType}${buildReportQuerystring(range)}`,
      ),
  });
}
export function useRequestsByCompanyReport(range: ReportRange = {}) {
  return useQuery({
    queryKey: ["reports", "requests-by-company", range],
    queryFn: () =>
      apiFetch<CompanyCount[]>(
        `${reportEndpoints.requestsByCompany}${buildReportQuerystring(range)}`,
      ),
  });
}
export function useStageAverageTimeReport(range: ReportRange = {}) {
  return useQuery({
    queryKey: ["reports", "stage-avg", range],
    queryFn: () =>
      apiFetch<StageTimeRow[]>(
        `${reportEndpoints.stageAvg}${buildReportQuerystring(range)}`,
      ),
  });
}
export function useReturnedRejectedReport(range: ReportRange = {}) {
  return useQuery({
    queryKey: ["reports", "returned-rejected", range],
    queryFn: () =>
      apiFetch<ReasonOutcome[]>(
        `${reportEndpoints.returned}${buildReportQuerystring(range)}`,
      ),
  });
}
export function useCredentialsByStatusReport(range: ReportRange = {}) {
  return useQuery({
    queryKey: ["reports", "credentials-by-status", range],
    queryFn: () =>
      apiFetch<StatusCount[]>(
        `${reportEndpoints.credentialsByStatus}${buildReportQuerystring(range)}`,
      ),
  });
}
export function useCredentialsExpiringReport(range: ReportRange = {}) {
  return useQuery({
    queryKey: ["reports", "credentials-expiring", range],
    queryFn: () =>
      apiFetch<{
        items: { id: string; credentialNumber: string; holderName: string | null; expiresAt: string; status: string }[];
        total: number;
        horizon: string;
      }>(
        `${reportEndpoints.credentialsExpiring}${buildReportQuerystring(range)}`,
      ),
  });
}
export function useCustodyStatusReport() {
  return useQuery({
    queryKey: ["reports", "custody"],
    queryFn: () =>
      apiFetch<CustodyStatusReport>(`${reportEndpoints.custody}`),
  });
}
export function useAlertsBreakdownReport() {
  return useQuery({
    queryKey: ["reports", "alerts-breakdown"],
    queryFn: () =>
      apiFetch<AlertsBreakdownReport>(`${reportEndpoints.alerts}`),
  });
}
export function useSlaComplianceReport() {
  return useQuery({
    queryKey: ["reports", "sla"],
    queryFn: () => apiFetch<SlaReport>(`${reportEndpoints.sla}`),
  });
}
export function useProductivityReport(range: ReportRange = {}) {
  return useQuery({
    queryKey: ["reports", "productivity", range],
    queryFn: () =>
      apiFetch<ProductivityRow[]>(
        `${reportEndpoints.productivity}${buildReportQuerystring(range)}`,
      ),
  });
}

export interface SystemSettingsResponse {
  companyName: string;
  logoUrl: string | null;
  smtpHost: string | null;
  smtpPort: number;
  smtpSecurity: "NONE" | "SSL" | "TLS";
  smtpUsername: string | null;
  fromEmail: string | null;
  fromName: string | null;
  replyToEmail: string | null;
  smtpPasswordConfigured: boolean;
}

export function useSettingsQuery() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: () => apiFetch<SystemSettingsResponse>("/settings"),
  });
}

export function useUpdateSettingsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      input: Partial<SystemSettingsResponse> & { smtpPassword?: string },
    ) =>
      apiFetch<SystemSettingsResponse>("/settings", {
        method: "PATCH",
        json: input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
}

export function useUploadSettingsLogoMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) =>
      apiUpload<SystemSettingsResponse>("/settings/logo", { file }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
}
