"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Edit3,
  Power,
  Trash2,
  GitBranch,
  Plus,
} from "lucide-react";
import { PageHeader, DetailSection } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/LoadingSkeletons";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { toast } from "@/hooks/use-toast";
import {
  useWorkflowDefinitionQuery,
  useWorkflowVersionsQuery,
  useLatestDraftVersionQuery,
  usePublishedVersionQuery,
  useCreateDraftVersionMutation,
  useRetireWorkflowDefinitionMutation,
  useDeleteWorkflowDefinitionMutation,
} from "@/hooks/workflow-hooks";
import { createSkeletonGraph } from "@/lib/workflow-mapping";
import { useSgaStore } from "@/lib/store";
import { formatDate, formatDateTime } from "@/lib/constants";
import type { WorkflowStatus } from "@/lib/workflow-types";

const STATUS_LABEL: Record<WorkflowStatus, string> = {
  DRAFT: "Borrador",
  PUBLISHED: "Publicado",
  RETIRED: "Retirado",
};

const STATUS_TONE: Record<
  WorkflowStatus,
  "neutral" | "info" | "warning" | "success" | "danger" | "brand"
> = {
  DRAFT: "warning",
  PUBLISHED: "success",
  RETIRED: "neutral",
};

export default function WorkflowDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const currentUser = useSgaStore((s) => s.currentUser);
  const canManage =
    currentUser?.profile?.permissions?.includes("workflows.manage") ?? false;
  const canPublish =
    currentUser?.profile?.permissions?.includes("workflows.publish") ?? false;
  const canDelete = canManage; // el backend exige workflows.manage

  const defQuery = useWorkflowDefinitionQuery(id);
  const draftQuery = useLatestDraftVersionQuery(id);
  const publishedQuery = usePublishedVersionQuery(id);
  const versionsQuery = useWorkflowVersionsQuery(id, {
    page: 1,
    pageSize: 50,
  });

  const createDraft = useCreateDraftVersionMutation(id);
  const retire = useRetireWorkflowDefinitionMutation(id);
  const remove = useDeleteWorkflowDefinitionMutation(id);

  if (defQuery.isLoading) return <PageSkeleton />;
  if (defQuery.isError || !defQuery.data) {
    return (
      <EmptyState
        title="Flujo no encontrado"
        description="Es posible que haya sido eliminado o que no tengas acceso."
        action={
          <Button asChild variant="outline">
            <Link href="/workflows">Volver</Link>
          </Button>
        }
      />
    );
  }

  const def = defQuery.data;
  const draft = draftQuery.data;
  const published = publishedQuery.data;
  const versions = versionsQuery.data?.items ?? [];
  const isRetired = def.status === "RETIRED";
  const isDraftDef = def.status === "DRAFT";

  async function handleCreateDraftFromPublished() {
    if (!published) return;
    try {
      await createDraft.mutateAsync({ graph: published.definitionJson });
      router.push(`/workflows/${id}/editor`);
    } catch (e) {
      toast({
        title: "No se pudo crear el borrador",
        description: (e as Error).message,
        variant: "destructive",
      });
    }
  }

  async function handleCreateBlankDraft() {
    try {
      await createDraft.mutateAsync({ graph: createSkeletonGraph() });
      router.push(`/workflows/${id}/editor`);
    } catch (e) {
      toast({
        title: "No se pudo crear el borrador",
        description: (e as Error).message,
        variant: "destructive",
      });
    }
  }

  async function handleRetire() {
    try {
      await retire.mutateAsync();
    } catch (e) {
      toast({
        title: "No se pudo retirar",
        description: (e as Error).message,
        variant: "destructive",
      });
    }
  }

  async function handleDelete() {
    try {
      await remove.mutateAsync();
      router.push("/workflows");
    } catch (e) {
      toast({
        title: "No se pudo eliminar",
        description: (e as Error).message,
        variant: "destructive",
      });
    }
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.push("/workflows")}>
        <ArrowLeft className="h-4 w-4" />
        Volver a flujos
      </Button>

      <PageHeader
        title={def.name}
        description={def.description ?? undefined}
        actions={
          <div className="flex flex-wrap gap-2">
            {canManage && !isRetired && (draft || published) && (
              <Button asChild>
                <Link href={`/workflows/${id}/editor`}>
                  <Edit3 className="h-4 w-4" />
                  {draft ? "Editar borrador" : "Abrir editor"}
                </Link>
              </Button>
            )}
            {canPublish && def.status === "PUBLISHED" && (
              <ConfirmDialog
                trigger={
                  <Button variant="outline">
                    <Power className="h-4 w-4" />
                    Retirar flujo
                  </Button>
                }
                title="¿Retirar este flujo?"
                description="Las solicitudes en curso continuarán con la versión que tenían asignada. Nuevas solicitudes no смогут usarlo hasta que lo vuelvas a publicar."
                confirmLabel="Retirar"
                destructive
                onConfirm={handleRetire}
              />
            )}
            {canDelete && isDraftDef && (
              <ConfirmDialog
                trigger={
                  <Button variant="destructive">
                    <Trash2 className="h-4 w-4" />
                    Eliminar
                  </Button>
                }
                title="¿Eliminar este flujo?"
                description="Acción irreversible. Solo se permite eliminar flujos en estado borrador."
                confirmLabel="Eliminar"
                destructive
                onConfirm={handleDelete}
              />
            )}
          </div>
        }
      />

      {/* Metadata + estado */}
      <DetailSection title="Información general">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-medium text-text-muted">Código</dt>
            <dd className="mt-0.5">
              <code className="text-sm text-text-primary">{def.key}</code>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-text-muted">Tipo de solicitud</dt>
            <dd className="mt-0.5 text-sm text-text-primary">
              {def.requestType ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-text-muted">Estado</dt>
            <dd className="mt-0.5">
              <Badge tone={STATUS_TONE[def.status]}>
                {STATUS_LABEL[def.status]}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-text-muted">
              Última actualización
            </dt>
            <dd className="mt-0.5 text-sm text-text-primary">
              {formatDateTime(def.updatedAt)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-text-muted">Creado</dt>
            <dd className="mt-0.5 text-sm text-text-primary">
              {formatDate(def.createdAt)}
            </dd>
          </div>
        </dl>
      </DetailSection>

      {/* Versiones activas */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DetailSection title="Versión publicada">
          {published ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge tone="success">v{published.versionNumber}</Badge>
                <span className="text-xs text-text-muted">
                  Publicada el {formatDateTime(published.publishedAt)}
                </span>
              </div>
              <p className="text-xs text-text-muted">
                Suma de verificación: <code>{published.checksum.slice(0, 12)}…</code>
              </p>
              {canManage && !isRetired && draft && !draftQuery.data && null}
              {canManage && !isRetired && !draft && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCreateDraftFromPublished}
                >
                  <GitBranch className="h-4 w-4" />
                  Crear borrador a partir de aquí
                </Button>
              )}
            </div>
          ) : (
            <p className="text-sm text-text-muted">
              Aún no hay versión publicada. Crea un borrador y publícalo para
              activar el flujo.
            </p>
          )}
        </DetailSection>

        <DetailSection title="Borrador en curso">
          {draft ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge tone="warning">v{draft.versionNumber} (borrador)</Badge>
                {canManage && (
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/workflows/${id}/editor`}>
                      <Edit3 className="h-4 w-4" />
                      Editar
                    </Link>
                  </Button>
                )}
              </div>
              <p className="text-xs text-text-muted">
                Última modificación: {formatDateTime(draft.createdAt)}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-text-muted">No hay borrador activo.</p>
              {canManage && !isRetired && (
                <div className="flex flex-wrap gap-2">
                  {published && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCreateDraftFromPublished}
                    >
                      <GitBranch className="h-4 w-4" />
                      Desde versión publicada
                    </Button>
                  )}
                  <Button size="sm" onClick={handleCreateBlankDraft}>
                    <Plus className="h-4 w-4" />
                    Nuevo borrador vacío
                  </Button>
                </div>
              )}
            </div>
          )}
        </DetailSection>
      </div>

      {/* Histórico */}
      {versions.length > 0 && (
        <DetailSection title="Historial de versiones">
          <ul className="divide-y divide-border-subtle">
            {versions.map((v) => (
              <li
                key={v.id}
                className="flex items-center justify-between py-3 text-sm"
              >
                <div className="flex items-center gap-3">
                  <Badge tone={STATUS_TONE[v.status]}>
                    v{v.versionNumber} — {STATUS_LABEL[v.status]}
                  </Badge>
                  <span className="text-text-muted">
                    {v.publishedAt
                      ? `Publicada ${formatDate(v.publishedAt)}`
                      : `Creada ${formatDate(v.createdAt)}`}
                  </span>
                </div>
                <code className="text-xs text-text-muted">
                  {v.checksum.slice(0, 12)}…
                </code>
              </li>
            ))}
          </ul>
        </DetailSection>
      )}
    </div>
  );
}
