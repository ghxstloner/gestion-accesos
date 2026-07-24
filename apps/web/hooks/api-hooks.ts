"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiUpload } from "@/lib/api-client";
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useMarkAllNotificationsReadMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<void>("/notifications/read-all", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
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
