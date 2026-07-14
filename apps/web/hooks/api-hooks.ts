'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

// ── Types (mirrored from backend DTOs) ──

export interface CatalogItemResponse {
  id: string;
  kind: string;
  code: string;
  label: string;
  description?: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface CompanyResponse {
  id: string;
  legalName: string;
  taxId: string;
  status: string;
  companyIdNumber?: string | null;
}

export interface PersonResponse {
  id: string;
  companyId: string;
  firstName: string;
  lastName: string;
  identificationType: string;
  identificationNumber: string;
  email: string | null;
  phone: string | null;
  status: string;
}

export interface AuthorizedSignerResponse {
  id: string;
  companyId: string;
  fullName: string;
  identificationNumber: string;
  position: string;
  isActive: boolean;
}

export interface UserResponse {
  id: string;
  companyId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: string[];
  isActive: boolean;
}

// ── Catalogs ──

export function useCatalogsQuery(kind: string) {
  return useQuery({
    queryKey: ['catalogs', kind],
    queryFn: () => apiFetch<CatalogItemResponse[]>(`/catalogs?kind=${encodeURIComponent(kind)}`),
  });
}

export function useCatalogUpsertMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      kind: string;
      code: string;
      label: string;
      description?: string | null;
      isActive?: boolean;
      sortOrder?: number;
    }) => apiFetch<CatalogItemResponse>('/catalogs', { method: 'POST', json: input }),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ['catalogs', vars.kind] }),
  });
}

// ── Companies ──

export function useCompaniesQuery(filters?: { search?: string; status?: string }) {
  const params = new URLSearchParams();
  if (filters?.search) params.set('search', filters.search);
  if (filters?.status) params.set('status', filters.status);
  return useQuery({
    queryKey: ['companies', filters],
    queryFn: () => apiFetch<CompanyResponse[]>(`/companies?${params.toString()}`),
  });
}

export function useCreateCompanyMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { legalName: string; taxId: string; companyIdNumber?: string | null }) =>
      apiFetch<CompanyResponse>('/companies', { method: 'POST', json: input }),
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
    queryFn: () => apiFetch<PersonResponse[]>(`/people?${params.toString()}`),
  });
}

export function useCreatePersonMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      companyId: string;
      firstName: string;
      lastName: string;
      identificationType: string;
      identificationNumber: string;
      email?: string | null;
      phone?: string | null;
    }) => apiFetch<PersonResponse>('/people', { method: 'POST', json: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['people'] }),
  });
}

export function useUpdatePersonMutation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<{
      firstName: string;
      lastName: string;
      email: string | null;
      phone: string | null;
    }>) => apiFetch<PersonResponse>(`/people/${id}`, { method: 'PATCH', json: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['people'] }),
  });
}

// ── Authorized Signers ──

export function useAuthorizedSignersQuery(companyId?: string) {
  const params = new URLSearchParams();
  if (companyId) params.set('companyId', companyId);
  return useQuery({
    queryKey: ['authorized-signers', companyId],
    queryFn: () =>
      apiFetch<AuthorizedSignerResponse[]>(`/authorized-signers?${params.toString()}`),
  });
}

export function useCreateAuthorizedSignerMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      companyId: string;
      fullName: string;
      identificationNumber: string;
      position: string;
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
    queryFn: () => apiFetch<UserResponse[]>(`/users?${params.toString()}`),
  });
}
