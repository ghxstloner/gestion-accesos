'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  IdCard,
  Printer,
  RefreshCw,
  Recycle,
  ShieldAlert,
  Ban,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { PageSkeleton } from '@/components/shared/LoadingSkeletons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import {
  useAttachCredentialPhotoMutation,
  useCredentialEventsQuery,
  useCredentialQuery,
  useCredentialTransitionMutation,
  useReusablePhotoQuery,
  useReplaceCredentialMutation,
  useReuseCredentialPhotoMutation,
} from '@/hooks/api-workflow-hooks';
import { API_BASE_URL } from '@/lib/api-config';
import { formatDateTime } from '@/lib/constants';
import { CameraCapture } from '@/components/dashboard/CameraCapture';
import { PrintPreview } from '@/components/dashboard/PrintPreview';

const TERMINAL_STATUSES = new Set(['DELIVERED', 'REVOKED', 'EXPIRED', 'CANCELLED']);

export default function CredentialWorkspacePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const credentialId = params.id;
  const { data: credential, isLoading } = useCredentialQuery(credentialId);
  const { data: events = [] } = useCredentialEventsQuery(credentialId);
  const { data: reuseCandidate } = useReusablePhotoQuery(credentialId);

  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replaceForm, setReplaceForm] = useState({ reason: '', cardCode: '' });

  if (isLoading || !credential) {
    return <PageSkeleton variant="detail" />;
  }

  const isTerminal = TERMINAL_STATUSES.has(credential.status);

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push('/issuance')}
        className="mb-2"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Volver a la cola de emisión
      </Button>
      <PageHeader
        title={`Credencial ${credential.credentialNumber}`}
        description={`Estado: ${credential.status}`}
      />

      <Tabs defaultValue="overview">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="photo">Fotografía</TabsTrigger>
          <TabsTrigger value="print">Imprimir</TabsTrigger>
          <TabsTrigger value="events">Eventos</TabsTrigger>
          <TabsTrigger value="operations">Operaciones</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewPanel credential={credential} />
        </TabsContent>

        <TabsContent value="photo">
          <PhotoPanel credential={credential} reuseCandidate={reuseCandidate} />
        </TabsContent>

        <TabsContent value="print">
          <PrintPreview credentialId={credential.id} />
        </TabsContent>

        <TabsContent value="events">
          <EventsPanel events={events} />
        </TabsContent>

        <TabsContent value="operations">
          <OperationsPanel
            credential={credential}
            isTerminal={isTerminal}
            onOpenReplace={() => setReplaceOpen(true)}
          />
        </TabsContent>
      </Tabs>

      <ReplaceDialog
        open={replaceOpen}
        onOpenChange={setReplaceOpen}
        form={replaceForm}
        setForm={setReplaceForm}
        credentialId={credential.id}
      />
    </div>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-text-muted">{label}</Label>
      <p className="text-sm">{value || '—'}</p>
    </div>
  );
}

function OverviewPanel({
  credential,
}: {
  credential: {
    credentialNumber: string;
    cardCode?: string | null;
    holderName?: string | null;
    credentialType: string;
    status: string;
    issuedAt: string | null;
    expiresAt: string | null;
    producedAt: string | null;
    readyAt: string | null;
    deliveredAt: string | null;
    observations?: string | null;
    authorizedZones?: string[] | null;
  };
}) {
  return (
    <div className="grid grid-cols-1 gap-4 rounded-xl border border-border bg-surface p-4 md:grid-cols-2">
      <Field label="N° de credencial" value={credential.credentialNumber} />
      <Field label="Código de tarjeta" value={credential.cardCode} />
      <Field label="Titular" value={credential.holderName} />
      <Field label="Tipo" value={credential.credentialType} />
      <Field label="Emisión" value={formatDateTime(credential.issuedAt)} />
      <Field label="Vencimiento" value={formatDateTime(credential.expiresAt)} />
      <Field
        label="Producción"
        value={formatDateTime(credential.producedAt)}
      />
      <Field
        label="Lista para entrega"
        value={formatDateTime(credential.readyAt)}
      />
      <Field
        label="Entrega"
        value={formatDateTime(credential.deliveredAt)}
      />
      <Field label="Estado" value={credential.status} />
      <div className="md:col-span-2">
        <Field
          label="Zonas autorizadas"
          value={
            credential.authorizedZones && credential.authorizedZones.length ? (
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {credential.authorizedZones.map((zone) => (
                  <li key={zone}>{zone}</li>
                ))}
              </ul>
            ) : null
          }
        />
      </div>
      <div className="md:col-span-2">
        <Field label="Observaciones" value={credential.observations} />
      </div>
    </div>
  );
}

function PhotoPanel({
  credential,
  reuseCandidate,
}: {
  credential: { id: string; photoFileId?: string | null };
  reuseCandidate: { credentialId: string; fileId: string; capturedAt: string } | null | undefined;
}) {
  const attachPhoto = useAttachCredentialPhotoMutation(credential.id);
  const reusePhoto = useReuseCredentialPhotoMutation(credential.id);

  const handleCapture = async (file: Blob, source: 'CAPTURED' | 'UPLOADED') => {
    await attachPhoto.mutateAsync({ file, source });
    toast({
      title: 'Fotografía adjuntada',
      description:
        source === 'CAPTURED'
          ? 'Captura de cámara guardada.'
          : 'Archivo subido correctamente.',
    });
  };

  const handleReuse = async () => {
    await reusePhoto.mutateAsync();
    toast({ title: 'Fotografía reutilizada' });
  };

  const currentPhoto = credential.photoFileId
    ? `${API_BASE_URL}/credentials/${credential.id}/photo-file`
    : null;

  return (
    <div className="grid gap-6 rounded-xl border border-border bg-surface p-4 md:grid-cols-2">
      <div>
        <h3 className="mb-3 font-medium">Capturar / Subir fotografía</h3>
        <CameraCapture
          onCapture={handleCapture}
          disabled={attachPhoto.isPending}
          existingPreviewUrl={currentPhoto ?? undefined}
        />
      </div>
      <div className="space-y-4">
        <div>
          <h3 className="mb-2 font-medium">Reutilizar foto anterior</h3>
          {reuseCandidate ? (
            <div className="rounded-lg border border-input bg-muted/30 p-4 text-sm">
              <p>
                Existe una fotografía capturada el{' '}
                <strong>{formatDateTime(reuseCandidate.capturedAt)}</strong> en
                la credencial{' '}
                <code className="rounded bg-muted px-1">
                  {reuseCandidate.credentialId}
                </code>
                .
              </p>
              <Button
                className="mt-3"
                size="sm"
                variant="outline"
                onClick={handleReuse}
                disabled={reusePhoto.isPending}
              >
                <Recycle className="mr-2 h-4 w-4" />
                Reutilizar
              </Button>
            </div>
          ) : (
            <p className="text-sm text-text-muted">
              No hay fotografía previa reutilizable para este titular.
            </p>
          )}
        </div>
        <div className="border-t border-border pt-3">
          <h3 className="mb-2 font-medium">Foto actual</h3>
          {currentPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentPhoto}
              alt="Foto actual"
              className="h-48 rounded-lg border border-input object-cover"
            />
          ) : (
            <p className="text-sm text-text-muted">
              Aún no se ha adjuntado ninguna fotografía.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function EventsPanel({
  events,
}: {
  events: {
    id: string;
    eventType: string;
    fromStatus: string | null;
    toStatus: string | null;
    actorUserId: string | null;
    comment: string | null;
    occurredAt: string;
  }[];
}) {
  if (!events.length) {
    return (
      <p className="text-sm text-text-muted">
        Esta credencial todavía no registra eventos.
      </p>
    );
  }
  return (
    <ol className="space-y-2">
      {events.map((event) => (
        <li
          key={event.id}
          className="rounded-lg border border-border bg-surface p-3 text-sm"
        >
          <div className="flex justify-between">
            <span className="font-medium">{event.eventType}</span>
            <span className="text-xs text-text-muted">
              {formatDateTime(event.occurredAt)}
            </span>
          </div>
          <p className="text-xs text-text-muted">
            {event.fromStatus ?? '—'} → {event.toStatus ?? '—'} · por{' '}
            {event.actorUserId ?? '—'}
          </p>
          {event.comment && (
            <p className="mt-1 text-xs">{event.comment}</p>
          )}
        </li>
      ))}
    </ol>
  );
}

function OperationsPanel({
  credential,
  isTerminal,
  onOpenReplace,
}: {
  credential: { id: string; status: string };
  isTerminal: boolean;
  onOpenReplace: () => void;
}) {
  const transition = useCredentialTransitionMutation(credential.id);
  const run = (
    action: 'start_production' | 'mark_ready' | 'suspend' | 'revoke' | 'cancel' | 'reactivate',
    label: string,
  ) =>
    transition.mutate(
      { transition: action },
      { onSuccess: () => toast({ title: label }) },
    );

  return (
    <div className="grid gap-4 rounded-xl border border-border bg-surface p-4 md:grid-cols-2">
      <div>
        <h3 className="mb-3 font-medium">Transiciones de producción</h3>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => run('start_production', 'Producción iniciada')}
            disabled={transition.isPending || credential.status !== 'PENDING_PRODUCTION'}
          >
            <IdCard className="mr-2 h-4 w-4" />
            Iniciar producción
          </Button>
          <Button
            size="sm"
            onClick={() => run('mark_ready', 'Marcada lista')}
            disabled={transition.isPending || credential.status !== 'IN_PRODUCTION'}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Marcar lista
          </Button>
          {credential.status === 'SUSPENDED' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => run('reactivate', 'Reactivada')}
              disabled={transition.isPending}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reactivar
            </Button>
          )}
        </div>
      </div>
      <div>
        <h3 className="mb-3 font-medium">Acciones disciplinarias / reposición</h3>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => run('suspend', 'Credencial suspendida')}
            disabled={transition.isPending || credential.status === 'SUSPENDED' || isTerminal}
          >
            <ShieldAlert className="mr-2 h-4 w-4" />
            Suspender
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => run('revoke', 'Credencial revocada')}
            disabled={
              transition.isPending ||
              credential.status === 'REVOKED' ||
              credential.status === 'CANCELLED'
            }
          >
            <Ban className="mr-2 h-4 w-4" />
            Revocar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => run('cancel', 'Credencial cancelada')}
            disabled={
              transition.isPending ||
              credential.status === 'CANCELLED' ||
              isTerminal
            }
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={onOpenReplace}
            disabled={transition.isPending || isTerminal}
          >
            <Printer className="mr-2 h-4 w-4" />
            Reponer
          </Button>
        </div>
      </div>
    </div>
  );
}

function ReplaceDialog({
  open,
  onOpenChange,
  form,
  setForm,
  credentialId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: { reason: string; cardCode: string };
  setForm: React.Dispatch<
    React.SetStateAction<{ reason: string; cardCode: string }>
  >;
  credentialId: string;
}) {
  const replace = useReplaceCredentialMutation(credentialId);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reponer credencial</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-text-muted">
          La credencial actual será revocada y se creará una nueva con un número
          correlativo. La fotografía se mantendrá automáticamente.
        </p>
        <div className="space-y-3">
          <div>
            <Label>Motivo *</Label>
            <Textarea
              value={form.reason}
              onChange={(e) =>
                setForm((value) => ({ ...value, reason: e.target.value }))
              }
              placeholder="Pérdida, robo, daño físico..."
            />
          </div>
          <div>
            <Label>Código de nueva tarjeta (opcional)</Label>
            <Input
              value={form.cardCode}
              onChange={(e) =>
                setForm((value) => ({ ...value, cardCode: e.target.value }))
              }
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!form.reason.trim() || replace.isPending}
            onClick={async () => {
              try {
                await replace.mutateAsync({
                  reason: form.reason.trim(),
                  cardCode: form.cardCode.trim() || null,
                });
                toast({ title: 'Credencial repuesta' });
                onOpenChange(false);
                setForm({ reason: '', cardCode: '' });
              } catch (err) {
                toast({
                  title: 'Error al reponer',
                  description:
                    err instanceof Error ? err.message : undefined,
                  variant: 'destructive',
                });
              }
            }}
          >
            Confirmar reposición
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
