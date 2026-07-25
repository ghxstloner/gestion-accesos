"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { toast } from "@/hooks/use-toast";
import type {
  PaginatedResponse,
  WorkflowDefinitionResponse,
  WorkflowGraph,
  WorkflowRequestType,
  WorkflowStatus,
  WorkflowVersionResponse,
} from "@/lib/workflow-types";

// Query keys centralizados para invalidaciones cruzadas.
export const WF_KEYS = {
  definitions: (
    filters?: WorkflowDefinitionFilters,
  ) => ["workflows", "definitions", filters ?? null] as const,
  definition: (id: string) => ["workflows", "definition", id] as const,
  versions: (
    id: string,
    page: { page: number; pageSize: number },
    status?: WorkflowStatus,
  ) =>
    [
      "workflows",
      "versions",
      id,
      { ...page, status: status ?? null },
    ] as const,
  version: (versionId: string) =>
    ["workflows", "version", versionId] as const,
};

// ── Filters ──

export interface WorkflowDefinitionFilters {
  search?: string;
  status?: WorkflowStatus;
  requestType?: WorkflowRequestType;
  page?: number;
  pageSize?: number;
}

// ── Definitions ──

export function useWorkflowDefinitionsQuery(filters: WorkflowDefinitionFilters = {}) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  if (filters.requestType) params.set("requestType", filters.requestType);
  params.set("page", String(filters.page ?? 1));
  params.set("pageSize", String(filters.pageSize ?? 20));
  return useQuery({
    queryKey: WF_KEYS.definitions(filters),
    queryFn: () =>
      apiFetch<PaginatedResponse<WorkflowDefinitionResponse>>(
        `/workflows/definitions?${params.toString()}`,
      ),
    placeholderData: keepPreviousData,
  });
}

export function useWorkflowDefinitionQuery(id: string | null) {
  return useQuery({
    enabled: Boolean(id),
    queryKey: id ? WF_KEYS.definition(id) : ["workflows", "definition", null],
    queryFn: () =>
      apiFetch<WorkflowDefinitionResponse>(`/workflows/definitions/${id!}`),
  });
}

export interface CreateWorkflowDefinitionInput {
  key: string;
  name: string;
  description?: string;
  requestType?: WorkflowRequestType;
}

export function useCreateWorkflowDefinitionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWorkflowDefinitionInput) =>
      apiFetch<WorkflowDefinitionResponse>("/workflows/definitions", {
        method: "POST",
        json: input,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workflows", "definitions"] });
      toast({ title: "Workflow creado" });
    },
  });
}

export interface UpdateWorkflowDefinitionInput {
  name?: string;
  description?: string | null;
}

export function useUpdateWorkflowDefinitionMutation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateWorkflowDefinitionInput) =>
      apiFetch<WorkflowDefinitionResponse>(`/workflows/definitions/${id}`, {
        method: "PATCH",
        json: input,
      }),
    onSuccess: (data) => {
      qc.setQueryData(WF_KEYS.definition(id), data);
      qc.invalidateQueries({ queryKey: ["workflows", "definitions"] });
      toast({ title: "Workflow actualizado" });
    },
  });
}

export function useRetireWorkflowDefinitionMutation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<WorkflowDefinitionResponse>(
        `/workflows/definitions/${id}/retire`,
        { method: "POST" },
      ),
    onSuccess: (data) => {
      qc.setQueryData(WF_KEYS.definition(id), data);
      qc.invalidateQueries({ queryKey: ["workflows", "definitions"] });
      toast({ title: "Workflow retirado" });
    },
  });
}

export function useDeleteWorkflowDefinitionMutation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<void>(`/workflows/definitions/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workflows", "definitions"] });
      qc.removeQueries({ queryKey: WF_KEYS.definition(id) });
      toast({ title: "Workflow eliminado" });
    },
  });
}

// ── Versions ──

export function useWorkflowVersionsQuery(
  definitionId: string | null,
  opts: { page?: number; pageSize?: number; status?: WorkflowStatus } = {},
) {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 50;
  return useQuery({
    enabled: Boolean(definitionId),
    queryKey:
      definitionId !== null
        ? WF_KEYS.versions(definitionId, { page, pageSize }, opts.status)
        : ["workflows", "versions", null],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (opts.status) params.set("status", opts.status);
      return apiFetch<PaginatedResponse<WorkflowVersionResponse>>(
        `/workflows/definitions/${definitionId}/versions?${params.toString()}`,
      );
    },
  });
}

export function useLatestDraftVersionQuery(definitionId: string | null) {
  const q = useWorkflowVersionsQuery(definitionId, {
    page: 1,
    pageSize: 50,
    status: "DRAFT",
  });
  const items = q.data?.items ?? [];
  const latest = items.sort((a, b) => b.versionNumber - a.versionNumber)[0] ?? null;
  return { ...q, data: latest };
}

export function usePublishedVersionQuery(definitionId: string | null) {
  const q = useWorkflowVersionsQuery(definitionId, {
    page: 1,
    pageSize: 50,
    status: "PUBLISHED",
  });
  const items = q.data?.items ?? [];
  const latest = items.sort((a, b) => b.versionNumber - a.versionNumber)[0] ?? null;
  return { ...q, data: latest };
}

export function useWorkflowVersionQuery(versionId: string | null) {
  return useQuery({
    enabled: Boolean(versionId),
    queryKey:
      versionId !== null
        ? WF_KEYS.version(versionId)
        : ["workflows", "version", null],
    queryFn: async () => {
      // No hay endpoint GET directo por id sin definitionId; lo resolvemos
      // consultando todas las versiones del definitionId conocido por el caller.
      // El caller normalmente ya lo sabe; este hook se usa para casos puntuales
      // cuando solo se conoce versionId (raro). El contrato del API exige ambos.
      throw new Error(
        "useWorkflowVersionQuery requiere definitionId+versionId; usa el listing hook en su lugar.",
      );
    },
  });
}

// ── Mutations de versión ──

export function useCreateDraftVersionMutation(definitionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { graph: WorkflowGraph }) =>
      apiFetch<WorkflowVersionResponse>(
        `/workflows/definitions/${definitionId}/versions`,
        {
          method: "POST",
          json: { definitionJson: input.graph },
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["workflows", "versions", definitionId],
      });
      toast({ title: "Borrador creado" });
    },
  });
}

export function useUpdateDraftVersionMutation(
  definitionId: string,
  versionId: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { graph: WorkflowGraph }) =>
      apiFetch<WorkflowVersionResponse>(
        `/workflows/definitions/${definitionId}/versions/${versionId}`,
        { method: "PATCH", json: { definitionJson: input.graph } },
      ),
    onSuccess: (data) => {
      qc.invalidateQueries({
        queryKey: ["workflows", "versions", definitionId],
      });
      qc.setQueryData(WF_KEYS.version(versionId), data);
      toast({ title: "Borrador guardado" });
    },
  });
}

export function usePublishVersionMutation(
  definitionId: string,
  versionId: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<WorkflowVersionResponse>(
        `/workflows/definitions/${definitionId}/versions/${versionId}/publish`,
        { method: "POST" },
      ),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["workflows", "versions", definitionId],
      });
      qc.invalidateQueries({
        queryKey: ["workflows", "definition", definitionId],
      });
      toast({ title: "Versión publicada" });
    },
    onError: (err: unknown) => {
      const e = err as Error & { status?: number };
      if (e.status === 403) {
        toast({
          title: "No autorizado",
          description: "Solo el administrador del sistema puede publicar.",
          variant: "destructive",
        });
      } else if (e.status === 409) {
        toast({
          title: "Versión ya publicada",
          description: "Ya existe una versión publicada idéntica.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error al publicar",
          description: e.message,
          variant: "destructive",
        });
      }
    },
  });
}

export function useRetireVersionMutation(
  definitionId: string,
  versionId: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<WorkflowVersionResponse>(
        `/workflows/definitions/${definitionId}/versions/${versionId}/retire`,
        { method: "POST" },
      ),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["workflows", "versions", definitionId],
      });
      toast({ title: "Versión retirada" });
    },
  });
}

export function useDeleteDraftVersionMutation(
  definitionId: string,
  versionId: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<void>(
        `/workflows/definitions/${definitionId}/versions/${versionId}`,
        { method: "DELETE" },
      ),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["workflows", "versions", definitionId],
      });
      toast({ title: "Borrador eliminado" });
    },
  });
}
