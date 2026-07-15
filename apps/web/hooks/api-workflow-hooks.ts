'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiUpload } from '@/lib/api-client';

export interface RequestListItem {
  id: string;
  requestNumber: string | null;
  companyId: string;
  createdByUserId: string;
  status: string;
  requestTypeCode: string | null;
  reason: string;
  validFrom: string | null;
  validUntil: string | null;
  primaryPersonId: string | null;
  personCount: number;
  vehicleCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RequestResponse extends RequestListItem {
  requestTypeId: string;
  authorizedSignerId: string | null;
  rejectionReasonId: string | null;
  serviceCompanyName: string | null;
  validFrom: string | null;
  validUntil: string | null;
  scheduleFrom: string | null;
  scheduleUntil: string | null;
  observations: string | null;
  createdByUserId: string;
  personLinks: { id: string; personId: string; role: string; personalEmergency: boolean; usePreviousPhoto: boolean; departmentSnapshot: string | null; positionSnapshot: string | null }[];
  vehicles: { id: string; plateNumber: string; brand: string; model: string; color: string | null; year: number | null; description: string | null }[];
  equipment: { id: string; brand: string | null; equipmentType: string; serialNumber: string | null; description: string | null; quantity: number }[];
  accessPoints: { id: string; accessPointId: string }[];
  accessAreas: { id: string; accessAreaId: string; justification: string | null; reviewStatus: string }[];
}

export interface RequestEventResponse {
  id: string;
  eventType: string;
  fromStatus: string | null;
  toStatus: string;
  actorUserId: string | null;
  actorRoleCode: string | null;
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
  documentTypeId: string;
  subjectType: string;
  subjectId: string | null;
  status: string;
  currentVersionId: string | null;
  versions: { id: string; originalFilename: string; mimeType: string; size: number; uploadedAt: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface AuditEventResponse {
  id: string;
  actorUserId: string | null;
  action: string;
  aggregateType: string;
  aggregateId: string | null;
  occurredAt: string;
}

// ── Requests ──

export function useRequestsQuery(filters?: {
  status?: string;
  search?: string;
  companyId?: string;
  createdByUserId?: string;
  requestTypeId?: string;
  page?: number;
  pageSize?: number;
}) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.search) params.set('search', filters.search);
  if (filters?.companyId) params.set('companyId', filters.companyId);
  if (filters?.createdByUserId) params.set('createdByUserId', filters.createdByUserId);
  if (filters?.requestTypeId) params.set('requestTypeId', filters.requestTypeId);
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
      companyId?: string;
      authorizedSignerId?: string | null;
      reason: string;
      serviceCompanyName?: string | null;
      validFrom?: string | null;
      validUntil?: string | null;
      scheduleFrom?: string | null;
      scheduleUntil?: string | null;
      observations?: string | null;
      personLinks?: { personId: string; role: string; personalEmergency?: boolean; usePreviousPhoto?: boolean; departmentSnapshot?: string | null; positionSnapshot?: string | null }[];
      vehicles?: { plateNumber: string; brand: string; model: string; color?: string | null; year?: number | null; description?: string | null }[];
      equipment?: { brand?: string | null; equipmentType: string; serialNumber?: string | null; description?: string | null; quantity: number }[];
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
      requestId?: string;
      transition: string;
      reasonCode?: string | null;
      comment?: string | null;
    }) =>
      apiFetch<RequestResponse>(`/requests/${input.requestId ?? id}/transition`, {
        method: 'POST',
        json: { transition: input.transition, reasonCode: input.reasonCode, comment: input.comment },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['requests'] });
      qc.invalidateQueries({ queryKey: ['request', id] });
      qc.invalidateQueries({ queryKey: ['request-events', id] });
    },
  });
}

export function useDeleteRequestMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/requests/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['requests'] }),
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

export function useReviewTasksQuery(filters?: { status?: string; taskType?: string }) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.taskType) params.set('taskType', filters.taskType);
  params.set('pageSize', '200');
  return useQuery({
    queryKey: ['review-tasks', filters],
    queryFn: () => apiFetch<{ items: ReviewTaskResponse[]; total: number }>(`/reviews?${params}`),
  });
}

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

export function useReviewDocumentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      documentId: string;
      requestId: string;
      decision: 'APPROVED' | 'REJECTED';
      comment?: string | null;
    }) =>
      apiFetch(`/documents/${input.documentId}/reviews`, {
        method: 'POST',
        json: { decision: input.decision, comment: input.comment ?? null },
      }),
    onSuccess: (_data, input) =>
      qc.invalidateQueries({ queryKey: ['documents', input.requestId] }),
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
      documentTypeId: string;
      file: File;
      subjectType?: string;
      subjectId?: string;
    }) =>
      apiUpload<DocumentResponse>('/documents', {
        requestId: input.requestId,
        documentTypeId: input.documentTypeId,
        subjectType: input.subjectType ?? 'REQUEST',
        subjectId: input.subjectId ?? input.requestId,
        file: input.file,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });
}

// ── Credentials ──

export function useCredentialsQuery(filters?: { status?: string; search?: string }) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.search) params.set('search', filters.search);
  params.set('pageSize', '200');
  return useQuery({
    queryKey: ['credentials', filters],
    queryFn: () => apiFetch<{ items: CredentialResponse[]; total: number }>(`/credentials?${params}`),
  });
}

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

export function useDeliverCredentialMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; receivedByName: string; receivedByIdentification: string; observations?: string }) =>
      apiFetch<CredentialResponse>(`/credentials/${input.id}/deliver`, {
        method: 'POST',
        json: { receivedByName: input.receivedByName, receivedByIdentification: input.receivedByIdentification, observations: input.observations },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['credentials'] }),
  });
}

export function useCorrectDeliveryMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; reason: string }) =>
      apiFetch<CredentialResponse>(`/credentials/${input.id}/correct-delivery`, {
        method: 'POST',
        json: { reason: input.reason },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['credentials'] }),
  });
}

export function useAuditEventsQuery(pageSize = 100) {
  return useQuery({
    queryKey: ['audit-events', pageSize],
    queryFn: () =>
      apiFetch<{ items: AuditEventResponse[]; total: number }>(
        `/audit?pageSize=${pageSize}`,
      ),
  });
}
