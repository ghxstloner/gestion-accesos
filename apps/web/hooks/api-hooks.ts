'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import type { Company, Person, User, AuthorizedSigner, Role } from '@/lib/types';
import { mapBackendRoleToFrontend } from '@/lib/role-mapping';

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

export interface PersonResponse {
  id: string;
  companyId: string;
  firstName: string;
  middleName: string | null;
  firstSurname: string;
  secondSurname: string | null;
  marriedSurname: string | null;
  identificationTypeId: string;
  identificationTypeCode?: string;
  identificationNumber: string;
  socialSecurityNumber: string | null;
  birthDate: string | null;
  gender: string | null;
  maritalStatus: string | null;
  nationality: string | null;
  bloodType: string | null;
  mobile: string | null;
  email: string | null;
  phone: string | null;
  residentialAddress: string | null;
  physicalCondition: string | null;
  department: string | null;
  position: string | null;
  yearsOfService: number | null;
  previouslyWorkedAtAirport: boolean;
  previousCompanyName: string | null;
  previouslyHadCredential: boolean;
  reusePreviousPhoto: boolean;
  status: string;
  createdAt: string;
}

export interface AuthorizedSignerResponse {
  id: string;
  companyId: string;
  personId: string;
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
  status: string;
  lastAccessAt: string | null;
  createdAt: string;
}

// ── Catalogs ──

export function useCatalogsQuery(kind: string) {
  return useQuery({
    queryKey: ['catalogs', kind],
    queryFn: () => apiFetch<CatalogItemResponse[]>(`/catalogs/${encodeURIComponent(kind)}`),
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
    }) => apiFetch<CatalogItemResponse>(`/catalogs/${encodeURIComponent(input.kind)}`, { method: 'POST', json: { code: input.code, name: input.name, description: input.description, displayOrder: input.displayOrder } }),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ['catalogs', vars.kind] }),
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
    taxId: row.taxIdentifier ?? '',
    email: row.email ?? '',
    phone: row.phone ?? '',
    address: row.address ?? '',
    logoUrl: row.logoUrl ?? undefined,
    primaryContact: row.mainContactName ?? '',
    status: (row.status === 'ACTIVE'
      ? 'ACTIVE'
      : row.status === 'SUSPENDED'
        ? 'INACTIVE'
        : 'INACTIVE') as Company['status'],
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

export function useCompaniesQuery(filters?: { search?: string; status?: string }) {
  const params = new URLSearchParams();
  if (filters?.search) params.set('search', filters.search);
  if (filters?.status) params.set('status', filters.status);
  return useQuery({
    queryKey: ['companies', filters ?? null],
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
    queryKey: ['company', id],
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
      apiFetch<CompanyResponse>('/companies', { method: 'POST', json: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
  });
}

export function useUpdateCompanyMutation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateCompanyInput) =>
      apiFetch<CompanyResponse>(`/companies/${id}`, { method: 'PATCH', json: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companies'] });
      qc.invalidateQueries({ queryKey: ['company', id] });
    },
  });
}

export function useToggleCompanyStatusMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; activate: boolean }) => {
      const action = args.activate ? 'activate' : 'deactivate';
      return apiFetch<CompanyResponse>(`/companies/${args.id}/${action}`, {
        method: 'POST',
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
  });
}

// ── People ──

export function usePeopleQuery(companyId?: string, search?: string) {
  const params = new URLSearchParams();
  if (companyId) params.set('companyId', companyId);
  if (search) params.set('search', search);
  return useQuery({
    queryKey: ['people', companyId, search],
    queryFn: async () => {
      const data = await apiFetch<{ items: PersonResponse[] }>(`/people?${params.toString()}`);
      return data.items.map(toPerson);
    },
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
    }) => apiFetch<CatalogItemResponse>(`/catalogs/${input.kind}/${input.id}`, {
      method: 'PATCH',
      json: {
        name: input.name,
        code: input.code,
        description: input.description,
        displayOrder: input.displayOrder,
      },
    }),
    onSuccess: (_data, input) => qc.invalidateQueries({ queryKey: ['catalogs', input.kind] }),
  });
}

export function useToggleCatalogMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { kind: string; id: string; activate: boolean }) =>
      apiFetch<void>(`/catalogs/${input.kind}/${input.id}/${input.activate ? 'activate' : 'deactivate'}`, { method: 'POST' }),
    onSuccess: (_data, input) => qc.invalidateQueries({ queryKey: ['catalogs', input.kind] }),
  });
}

function toPerson(row: PersonResponse): Person {
  return { id: row.id, companyId: row.companyId, firstName: row.firstName, middleName: row.middleName ?? undefined, firstLastName: row.firstSurname, secondLastName: row.secondSurname ?? undefined, marriedLastName: row.marriedSurname ?? undefined, idType: (row.identificationTypeCode ?? 'CEDULA') as Person['idType'], idNumber: row.identificationNumber, socialSecurityNumber: row.socialSecurityNumber ?? undefined, birthDate: row.birthDate?.slice(0, 10) ?? '', gender: (row.gender ?? 'OTRO') as Person['gender'], civilStatus: (row.maritalStatus ?? 'SOLTERO') as Person['civilStatus'], nationality: row.nationality ?? '', bloodType: (row.bloodType ?? undefined) as Person['bloodType'], phone: row.phone ?? '', mobile: row.mobile ?? '', email: row.email ?? '', address: row.residentialAddress ?? '', physicalAilment: row.physicalCondition ?? undefined, department: row.department ?? '', position: row.position ?? '', yearsOfService: row.yearsOfService ?? 0, workedAtAirportBefore: row.previouslyWorkedAtAirport, previousCompany: row.previousCompanyName ?? undefined, hadPreviousCard: row.previouslyHadCredential, reusePhoto: row.reusePreviousPhoto, status: row.status as Person['status'], createdAt: row.createdAt };
}

export function usePersonQuery(id: string | null) {
  return useQuery({ enabled: Boolean(id), queryKey: ['person', id], queryFn: async () => toPerson(await apiFetch<PersonResponse>(`/people/${id!}`)) });
}

export function useCreatePersonMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PersonWriteInput) =>
      apiFetch<PersonResponse>('/people', { method: 'POST', json: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['people'] }),
  });
}

export function useUpdatePersonMutation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PersonWriteInput) => {
      const json: Partial<PersonWriteInput> = { ...input };
      delete json.companyId;
      return apiFetch<PersonResponse>(`/people/${id}`, { method: 'PATCH', json });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['people'] }); qc.invalidateQueries({ queryKey: ['person', id] }); },
  });
}

export interface PersonWriteInput {
  companyId: string;
  firstName: string;
  middleName?: string;
  firstSurname: string;
  secondSurname?: string;
  marriedSurname?: string;
  identificationTypeId: string;
  identificationNumber: string;
  socialSecurityNumber?: string;
  birthDate?: string;
  gender?: string;
  maritalStatus?: string;
  nationality?: string;
  bloodType?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  residentialAddress?: string;
  physicalCondition?: string;
  department?: string;
  position?: string;
  yearsOfService?: number;
  previouslyWorkedAtAirport?: boolean;
  previousCompanyName?: string;
  previouslyHadCredential?: boolean;
  reusePreviousPhoto?: boolean;
}

export function toPersonWriteInput(
  person: Omit<Person, 'id' | 'createdAt'>,
  identificationTypes: CatalogItemResponse[],
): PersonWriteInput {
  const identificationType = identificationTypes.find(
    (item) => item.code === person.idType,
  );
  if (!identificationType) {
    throw new Error(`Tipo de identificación no configurado: ${person.idType}`);
  }
  return {
    companyId: person.companyId,
    firstName: person.firstName,
    middleName: person.middleName || undefined,
    firstSurname: person.firstLastName,
    secondSurname: person.secondLastName || undefined,
    marriedSurname: person.marriedLastName || undefined,
    identificationTypeId: identificationType.id,
    identificationNumber: person.idNumber,
    socialSecurityNumber: person.socialSecurityNumber || undefined,
    birthDate: person.birthDate || undefined,
    gender: person.gender,
    maritalStatus: person.civilStatus,
    nationality: person.nationality,
    bloodType: person.bloodType || undefined,
    phone: person.phone || undefined,
    mobile: person.mobile || undefined,
    email: person.email || undefined,
    residentialAddress: person.address || undefined,
    physicalCondition: person.physicalAilment || undefined,
    department: person.department || undefined,
    position: person.position || undefined,
    yearsOfService: person.yearsOfService,
    previouslyWorkedAtAirport: person.workedAtAirportBefore,
    previousCompanyName: person.previousCompany || undefined,
    previouslyHadCredential: person.hadPreviousCard,
    reusePreviousPhoto: person.reusePhoto,
  };
}

export function useTogglePersonStatusMutation() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, activate }: { id: string; activate: boolean }) => apiFetch<void>(`/people/${id}/${activate ? 'activate' : 'deactivate'}`, { method: 'POST' }), onSuccess: () => qc.invalidateQueries({ queryKey: ['people'] }) });
}

// ── Authorized Signers ──

export function useAuthorizedSignersQuery(companyId?: string) {
  const params = new URLSearchParams();
  if (companyId) params.set('companyId', companyId);
  return useQuery({
    queryKey: ['authorized-signers', companyId],
    queryFn: async () => {
      const data = await apiFetch<{ items: AuthorizedSignerResponse[] }>(`/authorized-signers?${params.toString()}`);
      return data.items.map(toSigner);
    },
  });
}

function toSigner(row: AuthorizedSignerResponse): AuthorizedSigner {
  return { id: row.id, companyId: row.companyId, personId: row.personId, position: row.position, startDate: row.validFrom.slice(0, 10), endDate: row.validUntil?.slice(0, 10) ?? '', status: (row.effectiveStatus === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE'), createdAt: row.createdAt };
}

export function useCreateAuthorizedSignerMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      personId: string;
      position: string;
      validFrom: string;
      validUntil?: string;
    }) =>
      apiFetch<AuthorizedSignerResponse>('/authorized-signers', { method: 'POST', json: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['authorized-signers'] }),
  });
}

// ── Users ──

export function useUsersQuery(companyId?: string) {
  const params = new URLSearchParams();
  if (companyId) params.set('companyId', companyId);
  return useQuery({
    queryKey: ['users', companyId],
    queryFn: async () => {
      const data = await apiFetch<{ items: UserResponse[] }>(`/users?${params.toString()}`);
      return data.items.map(toUser);
    },
  });
}

export function useUpdateAuthorizedSignerMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; position: string; validFrom: string; validUntil?: string }) =>
      apiFetch<AuthorizedSignerResponse>(`/authorized-signers/${input.id}`, {
        method: 'PATCH',
        json: { position: input.position, validFrom: input.validFrom, validUntil: input.validUntil || null },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['authorized-signers'] }),
  });
}

export function useToggleAuthorizedSignerMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; activate: boolean; reason?: string }) =>
      apiFetch<void>(`/authorized-signers/${input.id}/${input.activate ? 'activate' : 'revoke'}`, {
        method: 'POST',
        json: input.activate ? undefined : { reason: input.reason || 'Revocado por administrador' },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['authorized-signers'] }),
  });
}

function toUser(row: UserResponse): User {
  return { id: row.id, companyId: row.companyId ?? '', email: row.email, firstName: row.firstName, lastName: row.lastName, role: mapBackendRoleToFrontend(row.roles), status: row.status as User['status'], lastAccess: row.lastAccessAt, createdAt: row.createdAt };
}

export const FRONTEND_TO_BACKEND_ROLE: Record<Role, string> = { ADMIN_GENERAL: 'SYSTEM_ADMIN', ADMIN_EMPRESA: 'COMPANY_ADMIN', SOLICITANTE: 'APPLICANT', REVISOR: 'DOCUMENT_RECEIVER', JEFE_DOCUMENTOS: 'ACCESS_DOCUMENTS_MANAGER', EMISOR_CARNE: 'CARD_ISSUER' };

export function useUserQuery(id: string | null) { return useQuery({ enabled: Boolean(id), queryKey: ['user', id], queryFn: async () => toUser(await apiFetch<UserResponse>(`/users/${id!}`)) }); }

export function useCreateUserMutation() { const qc = useQueryClient(); return useMutation({ mutationFn: (input: { companyId?: string; firstName: string; lastName: string; email: string; password: string; role: Role }) => apiFetch<UserResponse>('/users', { method: 'POST', json: { ...input, companyId: input.companyId || undefined, roleCodes: [FRONTEND_TO_BACKEND_ROLE[input.role]], role: undefined } }), onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }) }); }

export function useUpdateUserMutation(id: string) { const qc = useQueryClient(); return useMutation({ mutationFn: async (input: Partial<{ companyId: string | null; firstName: string; lastName: string; email: string; role: Role }>) => { const { role, ...profile } = input; if (Object.keys(profile).length) await apiFetch(`/users/${id}`, { method: 'PATCH', json: profile }); if (role) await apiFetch(`/users/${id}/roles`, { method: 'PUT', json: { roleCodes: [FRONTEND_TO_BACKEND_ROLE[role]] } }); return toUser(await apiFetch<UserResponse>(`/users/${id}`)); }, onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); qc.invalidateQueries({ queryKey: ['user', id] }); } }); }

export function useToggleUserStatusMutation() { const qc = useQueryClient(); return useMutation({ mutationFn: ({ id, activate }: { id: string; activate: boolean }) => apiFetch<UserResponse>(`/users/${id}/${activate ? 'activate' : 'block'}`, { method: 'POST' }), onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }) }); }

export function useResetUserPasswordMutation() {
  return useMutation({
    mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) =>
      apiFetch<void>(`/users/${id}/reset-password`, {
        method: 'POST',
        json: { newPassword },
      }),
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
    queryKey: ['notifications'],
    queryFn: () => apiFetch<NotificationResponse[]>('/notifications'),
  });
}

export function useMarkNotificationReadMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/notifications/${id}/read`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useMarkAllNotificationsReadMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<void>('/notifications/read-all', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}
