'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, FileText, CheckCircle2, XCircle, RotateCcw,
  Check, X, Building2,
  Clock, ShieldCheck, MapPin,
} from 'lucide-react';
import { useSgaStore } from '@/lib/store';
import { PageHeader, DetailSection } from '@/components/shared/PageHeader';
import { StatusBadge, Badge } from '@/components/shared/StatusBadge';
import { RequestTypeBadge } from '@/components/shared/RequestTypeBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { formatDate, formatDateTime, ZONE_COLOR_META } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useAuthorizedSignersQuery, useCompaniesQuery, usePeopleQuery, useUsersQuery } from '@/hooks/api-hooks';
import {
  useDocumentsByRequestQuery,
  useRequestEventsQuery,
  useRequestQuery,
  useReviewDocumentMutation,
  useReviewTasksByRequestQuery,
  useReviewTaskTransitionMutation,
} from '@/hooks/api-workflow-hooks';
import { useActiveAccessAreas, useActiveAccessPoints, useActiveDocumentTypes, useActiveRejectionReasons } from '@/lib/catalog-hooks';
import { toAccessRequest } from '@/lib/request-mapping';

export default function ReviewDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { data: requestRow, isLoading } = useRequestQuery(id);
  const { data: companies = [] } = useCompaniesQuery();
  const { data: people = [] } = usePeopleQuery();
  const { data: users = [] } = useUsersQuery();
  const { data: signers = [] } = useAuthorizedSignersQuery();
  const { data: documents = [] } = useDocumentsByRequestQuery(id);
  const { data: events = [] } = useRequestEventsQuery(id);
  const { data: reviewTasks = [] } = useReviewTasksByRequestQuery(id);
  const accessPoints = useActiveAccessPoints();
  const accessAreas = useActiveAccessAreas();
  const documentTypes = useActiveDocumentTypes();
  const rejectionReasons = useActiveRejectionReasons();
  const request = requestRow
    ? toAccessRequest(requestRow, { accessPoints, accessAreas, documentTypes, documents, events, users })
    : undefined;
  const role = useSgaStore((s) => s.currentUser?.role);
  const reviewDocument = useReviewDocumentMutation();
  const transitionReview = useReviewTaskTransitionMutation();

  const [returnDialog, setReturnDialog] = useState(false);
  const [rejectDialog, setRejectDialog] = useState(false);
  const [returnForm, setReturnForm] = useState({ reason: '', comment: '' });
  const [rejectForm, setRejectForm] = useState({ reason: '', comment: '' });
  const [rejectDocId, setRejectDocId] = useState<string | null>(null);
  const [rejectDocObs, setRejectDocObs] = useState('');

  if (isLoading) return <p className="text-sm text-text-muted">Cargando solicitud…</p>;

  if (!request) {
    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={() => router.push('/reviews')}><ArrowLeft className="mr-2 h-4 w-4" />Volver</Button>
        <p className="text-sm text-text-muted">Solicitud no encontrada.</p>
      </div>
    );
  }

  const company = companies.find((c) => c.id === request.companyId);
  const signer = signers.find((s) => s.id === request.signerId);
  const signerPerson = signer ? people.find((p) => p.id === signer.personId) : null;
  const reqPeople = people.filter((p) => request.personIds.includes(p.id));
  const documentTask = reviewTasks.find((task) => task.taskType === 'DOCUMENT_REVIEW' && task.status !== 'COMPLETED');
  const finalTask = reviewTasks.find((task) => task.taskType === 'FINAL_APPROVAL' && task.status !== 'COMPLETED');

  const isReviewer = role === 'REVISOR' || role === 'ADMIN_GENERAL';
  const isJefe = role === 'JEFE_DOCUMENTOS' || role === 'ADMIN_GENERAL';
  const canReviewDocs = request.status === 'EN_REVISION_DOCUMENTAL' && isReviewer;
  const canApprove = request.status === 'PENDIENTE_APROBACION' && isJefe;

  const docProgress = request.documents.length > 0
    ? Math.round((request.documents.filter((d) => d.status === 'APROBADO').length / request.documents.length) * 100)
    : 0;

  const handleApproveStage = () => {
    if (!documentTask) return;
    transitionReview.mutate(
      { taskId: documentTask.id, transition: 'approve_documents' },
      { onSuccess: () => toast({ title: 'Etapa documental aprobada' }) },
    );
  };

  const handleReturn = () => {
    if (!returnForm.comment) {
      toast({ title: 'El comentario es obligatorio', variant: 'destructive' });
      return;
    }
    const task = canApprove ? finalTask : documentTask;
    if (!task) return;
    const reasonCode = rejectionReasons.find((reason) => reason.id === returnForm.reason)?.code;
    transitionReview.mutate(
      { taskId: task.id, transition: 'return', reasonCode, comment: returnForm.comment },
      { onSuccess: () => toast({ title: 'Solicitud devuelta' }) },
    );
    setReturnDialog(false);
    setReturnForm({ reason: '', comment: '' });
  };

  const handleReject = () => {
    if (!rejectForm.comment) {
      toast({ title: 'El comentario es obligatorio', variant: 'destructive' });
      return;
    }
    const task = canApprove ? finalTask : documentTask;
    if (!task) return;
    const reasonCode = rejectionReasons.find((reason) => reason.id === rejectForm.reason)?.code;
    transitionReview.mutate(
      { taskId: task.id, transition: 'reject', reasonCode, comment: rejectForm.comment },
      { onSuccess: () => toast({ title: 'Solicitud rechazada' }) },
    );
    setRejectDialog(false);
    setRejectForm({ reason: '', comment: '' });
  };

  const handleApprove = () => {
    if (!finalTask) return;
    transitionReview.mutate(
      { taskId: finalTask.id, transition: 'approve_final' },
      { onSuccess: () => toast({ title: 'Solicitud aprobada' }) },
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={request.number}
        description={request.reason}
        actions={
          <Button variant="outline" onClick={() => router.push('/reviews')}><ArrowLeft className="mr-2 h-4 w-4" />Volver</Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <RequestTypeBadge type={request.type} />
        <StatusBadge status={request.status} />
        <span className="text-xs text-text-muted">{company?.tradeName}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="space-y-6 lg:col-span-2">
          <DetailSection title="Información general">
            <dl className="space-y-3">
              <InfoRow icon={Building2} label="Empresa" value={company?.legalName ?? '—'} />
              <InfoRow icon={ShieldCheck} label="Firmante" value={signerPerson ? `${signerPerson.firstName} ${signerPerson.firstLastName} — ${signer?.position}` : '—'} />
              <InfoRow icon={FileText} label="Motivo" value={request.reason} />
              <InfoRow icon={Clock} label="Vigencia" value={`${formatDate(request.startDate)} — ${formatDate(request.endDate)}`} />
              <InfoRow icon={Clock} label="Horario" value={`${request.startTime} — ${request.endTime}`} />
              {request.observations && <InfoRow icon={FileText} label="Observaciones" value={request.observations} />}
            </dl>
          </DetailSection>

          <DetailSection title="Beneficiarios">
            {reqPeople.length === 0 ? (
              <p className="text-sm text-text-muted">Sin beneficiarios.</p>
            ) : (
              <div className="space-y-2">
                {reqPeople.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                      {p.firstName[0]}{p.firstLastName[0]}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-text-primary">
                        {p.firstName} {p.firstLastName}
                        {request.primaryPersonId === p.id && <Badge tone="brand" className="ml-2">Principal</Badge>}
                      </p>
                      <p className="text-xs text-text-muted">{p.idNumber} · {p.position}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DetailSection>

          {request.accessPoints.length > 0 && (
            <DetailSection title="Puntos de acceso">
              <div className="flex flex-wrap gap-2">
                {request.accessPoints.map((ap) => (
                  <span key={ap} className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-sm text-text-secondary">
                    <MapPin className="h-3.5 w-3.5 text-brand-600" />{ap}
                  </span>
                ))}
              </div>
            </DetailSection>
          )}

          {request.zones.length > 0 && (
            <DetailSection title="Zonas de seguridad">
              <div className="space-y-2">
                {request.zones.map((z) => {
                  const meta = ZONE_COLOR_META[z.zoneColor];
                  return (
                    <div key={`${z.zoneColor}-${z.areaCode}`} className="rounded-lg border border-border p-3">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: meta.hex }} />
                        <span className="text-sm font-medium text-text-primary">Zona {meta.label} — {z.areaCode}</span>
                        <span className="text-sm text-text-muted">{z.areaName}</span>
                      </div>
                      {z.justification && <p className="mt-1 text-xs text-text-muted">{z.justification}</p>}
                    </div>
                  );
                })}
              </div>
            </DetailSection>
          )}

          {/* Actions */}
          {(canReviewDocs || canApprove) && (
            <DetailSection title="Acciones de revisión">
              <div className="flex flex-wrap gap-2">
                {canReviewDocs && (
                  <>
                    <Button onClick={handleApproveStage} disabled={request.documents.some((d) => d.status === 'PENDIENTE' || d.status === 'RECHAZADO')}>
                      <CheckCircle2 className="mr-2 h-4 w-4" />Aprobar etapa
                    </Button>
                    <Button variant="outline" onClick={() => setReturnDialog(true)}>
                      <RotateCcw className="mr-2 h-4 w-4" />Devolver para corrección
                    </Button>
                    <Button variant="outline" className="text-danger border-danger/30 hover:bg-danger-soft" onClick={() => setRejectDialog(true)}>
                      <XCircle className="mr-2 h-4 w-4" />Rechazar solicitud
                    </Button>
                  </>
                )}
                {canApprove && (
                  <>
                    <Button onClick={handleApprove}>
                      <CheckCircle2 className="mr-2 h-4 w-4" />Aprobar solicitud
                    </Button>
                    <Button variant="outline" onClick={() => setReturnDialog(true)}>
                      <RotateCcw className="mr-2 h-4 w-4" />Devolver
                    </Button>
                    <Button variant="outline" className="text-danger border-danger/30 hover:bg-danger-soft" onClick={() => setRejectDialog(true)}>
                      <XCircle className="mr-2 h-4 w-4" />Rechazar
                    </Button>
                  </>
                )}
              </div>
            </DetailSection>
          )}
        </div>

        {/* Right panel: documents */}
        <div className="space-y-6">
          <DetailSection title="Documentos">
            {/* Progress */}
            <div className="mb-4">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-medium text-text-muted">Progreso documental</span>
                <span className="text-xs font-semibold text-text-primary">{docProgress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                <div className={cn('h-full rounded-full transition-all', docProgress === 100 ? 'bg-success' : 'bg-brand-600')} style={{ width: `${docProgress}%` }} />
              </div>
            </div>

            {request.documents.length === 0 ? (
              <EmptyState icon={FileText} title="Sin documentos" />
            ) : (
              <div className="space-y-3">
                {request.documents.map((d) => (
                  <div key={d.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-start gap-2.5">
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-text-primary">{d.name}</p>
                        <p className="text-xs text-text-muted">{d.type}</p>
                      </div>
                      {d.status === 'APROBADO' && <Badge tone="success"><CheckCircle2 className="h-3 w-3" /></Badge>}
                      {d.status === 'RECHAZADO' && <Badge tone="danger"><XCircle className="h-3 w-3" /></Badge>}
                      {d.status === 'PENDIENTE' && <Badge tone="warning">Pendiente</Badge>}
                    </div>
                    {d.observation && (
                      <p className="mt-2 text-xs text-danger bg-danger-soft rounded p-2">{d.observation}</p>
                    )}
                    {canReviewDocs && (
                      <div className="mt-2 flex gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs text-success border-success/30 hover:bg-success-soft"
                          onClick={() => reviewDocument.mutate(
                            { documentId: d.id, requestId: request.id, decision: 'APPROVED' },
                            { onSuccess: () => toast({ title: 'Documento aprobado' }) },
                          )}
                        >
                          <Check className="h-3 w-3" />Aprobar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs text-danger border-danger/30 hover:bg-danger-soft"
                          onClick={() => { setRejectDocId(d.id); setRejectDocObs(''); }}
                        >
                          <X className="h-3 w-3" />Rechazar
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </DetailSection>

          <DetailSection title="Historial reciente">
            <div className="relative space-y-3 pl-4">
              <div className="absolute left-1.5 top-1 bottom-1 w-px bg-border" />
              {request.history.slice(-5).reverse().map((ev) => (
                <div key={ev.id} className="relative">
                  <div className="absolute -left-[12px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-brand-500" />
                  <p className="text-xs font-medium text-text-primary">{ev.action}</p>
                  <p className="text-[10px] text-text-muted">{ev.actor} · {formatDateTime(ev.timestamp)}</p>
                </div>
              ))}
            </div>
          </DetailSection>
        </div>
      </div>

      {/* Return dialog */}
      <Dialog open={returnDialog} onOpenChange={setReturnDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Devolver solicitud para corrección</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="mb-1.5 block text-sm font-medium">Motivo</Label>
              <Select value={returnForm.reason} onValueChange={(v) => setReturnForm({ ...returnForm, reason: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccione motivo" /></SelectTrigger>
                <SelectContent>
                  {rejectionReasons.map((reason) => <SelectItem key={reason.id} value={reason.id}>{reason.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-sm font-medium">Comentario <span className="text-danger">*</span></Label>
              <Textarea value={returnForm.comment} onChange={(e) => setReturnForm({ ...returnForm, comment: e.target.value })} rows={4} placeholder="Indique las correcciones necesarias" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnDialog(false)}>Cancelar</Button>
            <Button variant="outline" className="text-warning border-warning/30 hover:bg-warning-soft" onClick={handleReturn}>
              <RotateCcw className="mr-2 h-4 w-4" />Devolver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={rejectDialog} onOpenChange={setRejectDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rechazar solicitud</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="mb-1.5 block text-sm font-medium">Motivo</Label>
              <Select value={rejectForm.reason} onValueChange={(v) => setRejectForm({ ...rejectForm, reason: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccione motivo" /></SelectTrigger>
                <SelectContent>
                  {rejectionReasons.map((reason) => <SelectItem key={reason.id} value={reason.id}>{reason.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-sm font-medium">Comentario <span className="text-danger">*</span></Label>
              <Textarea value={rejectForm.comment} onChange={(e) => setRejectForm({ ...rejectForm, comment: e.target.value })} rows={4} placeholder="Justifique el rechazo" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleReject}>
              <XCircle className="mr-2 h-4 w-4" />Rechazar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document rejection dialog */}
      <Dialog open={!!rejectDocId} onOpenChange={(o) => !o && setRejectDocId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rechazar documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="mb-1.5 block text-sm font-medium">Observación <span className="text-danger">*</span></Label>
              <Textarea
                value={rejectDocObs}
                onChange={(e) => setRejectDocObs(e.target.value)}
                rows={4}
                placeholder="Indique el motivo del rechazo del documento"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDocId(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={!rejectDocObs.trim()}
              onClick={() => {
                if (!rejectDocId) return;
                reviewDocument.mutate(
                  { documentId: rejectDocId, requestId: request.id, decision: 'REJECTED', comment: rejectDocObs.trim() },
                  { onSuccess: () => toast({ title: 'Documento rechazado' }) },
                );
                setRejectDocId(null);
                setRejectDocObs('');
              }}
            >
              <XCircle className="mr-2 h-4 w-4" />Rechazar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
      <div>
        <dt className="text-xs font-medium text-text-muted">{label}</dt>
        <dd className="text-sm text-text-primary">{value}</dd>
      </div>
    </div>
  );
}
