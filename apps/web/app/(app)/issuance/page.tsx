'use client';

import { useState } from 'react';
import {
  IdCard, PackageCheck, CheckCircle2, Clock,
  Play, Check, Send, FileText, RotateCcw, Eye, AlertTriangle,
} from 'lucide-react';
import { useSgaStore, useCurrentUserData, useStoreHydrated } from '@/lib/store';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { RequestTypeBadge } from '@/components/shared/RequestTypeBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { CredentialView } from '@/components/shared/CredentialView';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime } from '@/lib/constants';
import type { AccessRequest } from '@/lib/types';
import { toast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

type ReversionKind = 'cancelConfection' | 'returnToConfection' | 'correctDelivery';

interface ReversionMeta {
  kind: ReversionKind;
  reqId: string;
  reason: string;
}

export default function IssuancePage() {
  const hydrated = useStoreHydrated();
  const requests = useSgaStore((s) => s.requests);
  const companies = useSgaStore((s) => s.companies);
  const people = useSgaStore((s) => s.people);
  const userData = useCurrentUserData();
  const role = useSgaStore((s) => s.currentUser?.role);
  const startIssuance = useSgaStore((s) => s.startIssuance);
  const markReady = useSgaStore((s) => s.markReady);
  const registerDelivery = useSgaStore((s) => s.registerDelivery);
  const cancelConfection = useSgaStore((s) => s.cancelConfection);
  const returnToConfection = useSgaStore((s) => s.returnToConfection);
  const correctDelivery = useSgaStore((s) => s.correctDelivery);
  const router = useRouter();

  const [deliveryDialog, setDeliveryDialog] = useState(false);
  const [deliveryReqId, setDeliveryReqId] = useState<string | null>(null);
  const [deliveryForm, setDeliveryForm] = useState({ receivedBy: '', observation: '' });
  const [reversion, setReversion] = useState<ReversionMeta | null>(null);
  const [credentialReqId, setCredentialReqId] = useState<string | null>(null);

  if (!hydrated) {
    return (
      <div className="space-y-6">
        <PageHeader title="Emisión de credenciales (Cargando...)" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </div>
    );
  }

  const actorName = userData ? `${userData.firstName} ${userData.lastName}` : 'Usuario';
  const companyName = (cid: string) => companies.find((c) => c.id === cid)?.tradeName ?? '—';
  const personName = (pid?: string) => {
    if (!pid) return '—';
    const p = people.find((x) => x.id === pid);
    return p ? `${p.firstName} ${p.firstLastName}` : '—';
  };

  const pending = requests.filter((r) => r.status === 'APROBADA');
  const inProgress = requests.filter((r) => r.status === 'EN_CONFECCION');
  const ready = requests.filter((r) => r.status === 'LISTA_PARA_ENTREGA');
  const delivered = requests.filter((r) => r.status === 'ENTREGADA');

  const openDelivery = (reqId: string) => {
    setDeliveryReqId(reqId);
    setDeliveryForm({ receivedBy: '', observation: '' });
    setDeliveryDialog(true);
  };

  const handleDelivery = () => {
    if (!deliveryReqId) return;
    if (!deliveryForm.receivedBy) {
      toast({ title: 'Indique quién recibe el carné', variant: 'destructive' });
      return;
    }
    registerDelivery(deliveryReqId, deliveryForm.receivedBy, deliveryForm.observation, actorName);
    toast({ title: 'Entrega registrada' });
    setDeliveryDialog(false);
  };

  const REVERSION_LABELS: Record<ReversionKind, { title: string; description: string; success: string }> = {
    cancelConfection: {
      title: 'Regresar a Aprobada',
      description: 'La solicitud volverá al estado APROBADA. Se conservará el número de credencial si ya se generó.',
      success: 'Solicitud devuelta a Aprobada',
    },
    returnToConfection: {
      title: 'Regresar a Confección',
      description: 'La credencial volverá a estado EN_CONFECCION para corregir la confección.',
      success: 'Credencial devuelta a Confección',
    },
    correctDelivery: {
      title: 'Corregir entrega',
      description: 'Acción restringida a JEFE_DOCUMENTOS o ADMIN_GENERAL. La solicitud volverá a LISTA_PARA_ENTREGA.',
      success: 'Entrega corregida',
    },
  };

  const openReversion = (kind: ReversionKind, reqId: string) => {
    setReversion({ kind, reqId, reason: '' });
  };

  const handleReversion = () => {
    if (!reversion || !reversion.reason.trim()) {
      toast({ title: 'Indique el motivo de la reversión', variant: 'destructive' });
      return;
    }
    try {
      if (reversion.kind === 'cancelConfection') {
        cancelConfection(reversion.reqId, reversion.reason.trim(), actorName);
      } else if (reversion.kind === 'returnToConfection') {
        returnToConfection(reversion.reqId, reversion.reason.trim(), actorName);
      } else {
        correctDelivery(reversion.reqId, reversion.reason.trim(), actorName);
      }
      toast({ title: REVERSION_LABELS[reversion.kind].success });
      setReversion(null);
    } catch (err) {
      toast({
        title: 'No se pudo realizar la reversión',
        description: err instanceof Error ? err.message : 'Error inesperado',
        variant: 'destructive',
      });
    }
  };

  const canCorrectDelivery = role === 'JEFE_DOCUMENTOS' || role === 'ADMIN_GENERAL';
  const credentialRequest = credentialReqId
    ? requests.find((r) => r.id === credentialReqId) ?? null
    : null;
  const credentialPerson = credentialRequest
    ? people.find((p) => p.id === (credentialRequest.primaryPersonId ?? credentialRequest.personIds[0]))
    : undefined;

  return (
    <div className="space-y-6">
      <PageHeader title="Emisión de carnés" description="Confección y entrega de carnés aprobados" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted">Pendientes</span>
            <Clock className="h-4 w-4 text-warning" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-text-primary">{pending.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted">En confección</span>
            <IdCard className="h-4 w-4 text-brand-600" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-text-primary">{inProgress.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted">Listas para entrega</span>
            <PackageCheck className="h-4 w-4 text-info" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-text-primary">{ready.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted">Entregadas</span>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-text-primary">{delivered.length}</p>
        </div>
      </div>

      <Tabs defaultValue="pending">
        <TabsList className="flex h-auto flex-wrap gap-1 bg-surface-muted p-1">
          <TabsTrigger value="pending" className="text-xs">Pendientes de confección ({pending.length})</TabsTrigger>
          <TabsTrigger value="progress" className="text-xs">En confección ({inProgress.length})</TabsTrigger>
          <TabsTrigger value="ready" className="text-xs">Listas para entrega ({ready.length})</TabsTrigger>
          <TabsTrigger value="delivered" className="text-xs">Entregadas ({delivered.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          {pending.length === 0 ? (
            <EmptyState icon={IdCard} title="Sin solicitudes pendientes" description="No hay solicitudes aprobadas pendientes de confección." />
          ) : (
            <IssuanceList
              requests={pending}
              companyName={companyName}
              personName={personName}
              actionLabel="Iniciar confección"
              actionIcon={Play}
              onAction={(r) => { startIssuance(r.id, actorName); toast({ title: 'Confección iniciada' }); }}
              onView={(r) => router.push(`/requests/${r.id}`)}
            />
          )}
        </TabsContent>

        <TabsContent value="progress" className="mt-4">
          {inProgress.length === 0 ? (
            <EmptyState icon={IdCard} title="Sin carnés en confección" />
          ) : (
            <IssuanceList
              requests={inProgress}
              companyName={companyName}
              personName={personName}
              actionLabel="Marcar como lista"
              actionIcon={Check}
              onAction={(r) => { markReady(r.id, actorName); toast({ title: 'Marcada como lista para entrega' }); }}
              onViewCredential={(r) => setCredentialReqId(r.id)}
              onRevert={(r) => openReversion('cancelConfection', r.id)}
              revertLabel="Regresar a Aprobada"
              revertIcon={RotateCcw}
              onView={(r) => router.push(`/requests/${r.id}`)}
              extraInfo={(r) => r.issuance?.startedAt && <span className="text-xs text-text-muted">Iniciada: {formatDateTime(r.issuance.startedAt)}</span>}
            />
          )}
        </TabsContent>

        <TabsContent value="ready" className="mt-4">
          {ready.length === 0 ? (
            <EmptyState icon={PackageCheck} title="Sin carnés listos para entrega" />
          ) : (
            <IssuanceList
              requests={ready}
              companyName={companyName}
              personName={personName}
              actionLabel="Registrar entrega"
              actionIcon={Send}
              onAction={(r) => openDelivery(r.id)}
              onViewCredential={(r) => setCredentialReqId(r.id)}
              onRevert={(r) => openReversion('returnToConfection', r.id)}
              revertLabel="Regresar a Confección"
              revertIcon={RotateCcw}
              onView={(r) => router.push(`/requests/${r.id}`)}
              extraInfo={(r) => r.issuance?.readyAt && <span className="text-xs text-text-muted">Lista desde: {formatDateTime(r.issuance.readyAt)}</span>}
            />
          )}
        </TabsContent>

        <TabsContent value="delivered" className="mt-4">
          {delivered.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Sin carnés entregados" />
          ) : (
            <IssuanceList
              requests={delivered}
              companyName={companyName}
              personName={personName}
              onViewCredential={(r) => setCredentialReqId(r.id)}
              onRevert={canCorrectDelivery ? (r) => openReversion('correctDelivery', r.id) : undefined}
              revertLabel="Corregir entrega"
              revertIcon={AlertTriangle}
              onView={(r) => router.push(`/requests/${r.id}`)}
              extraInfo={(r) => (
                <div className="space-y-1">
                  {r.issuance?.cardNumber && <span className="block text-xs text-text-muted">Credencial: {r.issuance.cardNumber}</span>}
                  {r.issuance?.deliveredAt && <span className="block text-xs text-text-muted">Entregada: {formatDateTime(r.issuance.deliveredAt)}</span>}
                  {r.issuance?.receivedBy && <span className="block text-xs text-text-muted">Recibido por: {r.issuance.receivedBy}</span>}
                </div>
              )}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Delivery dialog */}
      <Dialog open={deliveryDialog} onOpenChange={setDeliveryDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar entrega de carné</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="mb-1.5 block text-sm font-medium">Nombre de quien recibe <span className="text-danger">*</span></Label>
              <Input value={deliveryForm.receivedBy} onChange={(e) => setDeliveryForm({ ...deliveryForm, receivedBy: e.target.value })} placeholder="Nombre completo" />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm font-medium">Observación</Label>
              <Textarea value={deliveryForm.observation} onChange={(e) => setDeliveryForm({ ...deliveryForm, observation: e.target.value })} rows={3} placeholder="Observaciones de la entrega" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeliveryDialog(false)}>Cancelar</Button>
            <Button onClick={handleDelivery}><Send className="mr-2 h-4 w-4" />Registrar entrega</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reversion dialog (shared across all three kinds) */}
      <AlertDialog open={!!reversion} onOpenChange={(o) => !o && setReversion(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {reversion ? REVERSION_LABELS[reversion.kind].title : ''}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {reversion ? REVERSION_LABELS[reversion.kind].description : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label htmlFor="reversion-reason" className="mb-1.5 block text-sm font-medium">
              Motivo <span className="text-danger">*</span>
            </Label>
            <Textarea
              id="reversion-reason"
              value={reversion?.reason ?? ''}
              onChange={(e) =>
                setReversion((prev) =>
                  prev ? { ...prev, reason: e.target.value } : prev
                )
              }
              rows={3}
              placeholder="Justifique la reversión"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReversion}>
              Confirmar reversión
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Credential viewer */}
      {credentialRequest && (
        <CredentialView
          request={credentialRequest}
          person={credentialPerson}
          companyName={
            companies.find((c) => c.id === credentialRequest.companyId)?.tradeName
          }
          open={!!credentialReqId}
          onOpenChange={(o) => !o && setCredentialReqId(null)}
        />
      )}
    </div>
  );
}

function IssuanceList({
  requests,
  companyName,
  personName,
  actionLabel,
  actionIcon: ActionIcon,
  onAction,
  onView,
  onViewCredential,
  onRevert,
  revertLabel,
  revertIcon: RevertIcon,
  extraInfo,
}: {
  requests: AccessRequest[];
  companyName: (cid: string) => string;
  personName: (pid?: string) => string;
  actionLabel?: string;
  actionIcon?: React.ComponentType<{ className?: string }>;
  onAction?: (r: AccessRequest) => void;
  onView?: (r: AccessRequest) => void;
  onViewCredential?: (r: AccessRequest) => void;
  onRevert?: (r: AccessRequest) => void;
  revertLabel?: string;
  revertIcon?: React.ComponentType<{ className?: string }>;
  extraInfo?: (r: AccessRequest) => React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      {requests.map((r) => (
        <div key={r.id} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <IdCard className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-text-primary">{r.number}</p>
                <RequestTypeBadge type={r.type} />
              </div>
              <p className="text-xs text-text-muted">{companyName(r.companyId)} · {personName(r.primaryPersonId)}</p>
              {extraInfo && extraInfo(r)}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={r.status} />
            {onView && (
              <Button variant="outline" size="sm" onClick={() => onView(r)}>
                <FileText className="mr-1.5 h-3.5 w-3.5" />Ver
              </Button>
            )}
            {onViewCredential && (
              <Button variant="outline" size="sm" onClick={() => onViewCredential(r)}>
                <Eye className="mr-1.5 h-3.5 w-3.5" />Credencial
              </Button>
            )}
            {onRevert && RevertIcon && revertLabel && (
              <Button variant="outline" size="sm" onClick={() => onRevert(r)}>
                <RevertIcon className="mr-1.5 h-3.5 w-3.5" />{revertLabel}
              </Button>
            )}
            {onAction && ActionIcon && (
              <Button size="sm" onClick={() => onAction(r)}>
                <ActionIcon className="mr-1.5 h-3.5 w-3.5" />{actionLabel}
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
