'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiUpload } from '@/lib/api-client';

export interface RequestListItem {
  id: string;
  requestNumber: string;
  status: string;
  reason: string;
  serviceCompanyName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RequestResponse extends RequestListItem {
  requestTypeId: string;
  validFrom: string | null;
  validUntil: string | null;
  scheduleFrom: string | null;
  scheduleUntil: string | null;
  observations: string | null;
  createdByUserId: string;
  personLinks: { personId: string; role: string }[];
  vehicles: { plateNumber: string; brand: string | null; model: string | null }[];
  equipment: { equipmentType: string; quantity: number }[];
  accessPoints: { accessPointId: string }[];
  accessAreas: { accessAreaId: string; justification: string | null }[];
}

export interface RequestEventResponse {
  id: string;
  eventType: string;
  fromStatus: string | null;
  toStatus: string;
  actorUserId: string | null;
  reasonCode: string | null;
  comment: string | null;
  occurredAt: string;
}

export interface ReviewTaskResponse {
  id: string;
  requestId: string;
  taskType: string;
  status: string;
  assignedToUserId: string | null;
  assignedRoleCode: string | null;
  assignedAt: string | null;
  completedAt: string | null;
  dueAt: string | null;
  createdAt: string;
}

export interface CredentialResponse {
  id: string;
  credentialNumber: string;
  requestId: string;
  credentialType: string;
  personId: string | null;
  status: string;
  issuedAt: string | null;
  expiresAt: string | null;
  producedAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentResponse {
  id: string;
  requestId: string;
  documentType: string;
  subjectType: string;
  subjectId: string;
  status: string;
  currentVersionId: string | null;
}

// ── Requests ──

export function useRequestsQuery(filters?: {
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.search) params.set('search', filters.search);
  if (filters?.page) params.set('page', String(filters.page));
  if (filters?.pageSize) params.set('pageSize', String(filters.pageSize));
  return useQuery({
    queryKey: ['requests', filters],
    queryFn: () =>
      apiFetch<{ items: RequestListItem[]; total: number; page: number; pageSize: number }>(
        `/requests?${params.toString()}`,
      ),
  });
}

export function useRequestQuery(id: string | null) {
  return useQuery({
    enabled: Boolean(id),
    queryKey: ['request', id],
    queryFn: () => apiFetch<RequestResponse>(`/requests/${id!}`),
  });
}

export function useCreateRequestMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      requestTypeId: string;
      reason: string;
      serviceCompanyName?: string | null;
      validFrom?: string | null;
      validUntil?: string | null;
      scheduleFrom?: string | null;
      scheduleUntil?: string | null;
      observations?: string | null;
      personLinks?: { personId: string; role: string }[];
      vehicles?: { plateNumber: string; brand: string | null; model: string | null }[];
      equipment?: { equipmentType: string; quantity: number }[];
      accessPoints?: { accessPointId: string }[];
      accessAreas?: { accessAreaId: string; justification: string | null }[];
    }) => apiFetch<RequestResponse>('/requests', { method: 'POST', json: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['requests'] }),
  });
}

export function useUpdateRequestMutation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<
      Omit<Parameters<ReturnType<typeof useCreateRequestMutation>['mutateAsync']>[0], never>
    >) => apiFetch<RequestResponse>(`/requests/${id}`, { method: 'PATCH', json: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['requests'] }),
  });
}

export function useRequestTransitionMutation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      transition: string;
      reasonCode?: string | null;
      comment?: string | null;
    }) =>
      apiFetch<RequestResponse>(`/requests/${id}/transition`, { method: 'POST', json: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['requests'] });
      qc.invalidateQueries({ queryKey: ['request', id] });
      qc.invalidateQueries({ queryKey: ['request-events', id] });
    },
  });
}

export function useRequestEventsQuery(id: string | null) {
  return useQuery({
    enabled: Boolean(id),
    queryKey: ['request-events', id],
    queryFn: () => apiFetch<RequestEventResponse[]>(`/requests/${id!}/events`),
  });
}

// ── Reviews ──

export function useReviewTasksByRequestQuery(requestId: string | null) {
  return useQuery({
    enabled: Boolean(requestId),
    queryKey: ['review-tasks', requestId],
    queryFn: () =>
      apiFetch<ReviewTaskResponse[]>(`/reviews/by-request/${requestId!}`),
  });
}

export function useReviewTaskTransitionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      taskId: string;
      transition: string;
      comment?: string | null;
      reasonCode?: string | null;
    }) =>
      apiFetch<ReviewTaskResponse>(
        `/reviews/${input.taskId}/${input.transition.replace('_', '-')}`,
        {
          method: 'POST',
          json: { comment: input.comment ?? null, reasonCode: input.reasonCode ?? null },
        },
      ),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['review-tasks', data.requestId] });
      qc.invalidateQueries({ queryKey: ['request', data.requestId] });
      qc.invalidateQueries({ queryKey: ['requests'] });
    },
  });
}

// ── Documents ──

export function useDocumentsByRequestQuery(requestId: string | null) {
  return useQuery({
    enabled: Boolean(requestId),
    queryKey: ['documents', requestId],
    queryFn: () =>
      apiFetch<DocumentResponse[]>(`/documents?requestId=${encodeURIComponent(requestId!)}`),
  });
}

export function useUploadDocumentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      requestId: string;
      documentType: string;
      file: File;
      subjectType?: string;
      subjectId?: string;
    }) =>
      apiUpload<DocumentResponse>('/documents', {
        requestId: input.requestId,
        documentType: input.documentType,
        subjectType: input.subjectType ?? 'REQUEST',
        subjectId: input.subjectId ?? input.requestId,
        file: input.file,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });
}

// ── Credentials ──

export function useCredentialByRequestQuery(requestId: string | null) {
  return useQuery({
    enabled: Boolean(requestId),
    queryKey: ['credential-by-request', requestId],
    queryFn: () =>
      apiFetch<CredentialResponse | null>(`/credentials/by-request/${requestId!}`),
  });
}

export function useIssueCredentialMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      requestId: string;
      credentialType: string;
      personId?: string | null;
      expiresAt?: string | null;
      comment?: string | null;
    }) =>
      apiFetch<CredentialResponse>('/credentials', { method: 'POST', json: input }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['credential-by-request', data.requestId] });
      qc.invalidateQueries({ queryKey: ['credentials'] });
    },
  });
}

export function useCredentialTransitionMutation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { transition: string; comment?: string | null }) =>
      apiFetch<CredentialResponse>(`/credentials/${id}/transition`, {
        method: 'POST',
        json: input,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['credential', id] });
      qc.invalidateQueries({ queryKey: ['credentials'] });
    },
  });
}
