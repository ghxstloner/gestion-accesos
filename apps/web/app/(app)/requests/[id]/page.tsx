'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, User, Building2, Car, Wrench, MapPin, FileText,
  ShieldCheck, Clock, CheckCircle2, XCircle, RotateCcw, Send,
  IdCard, PackageCheck,
} from 'lucide-react';
import { useSgaStore } from '@/lib/store';
import { PageHeader, DetailSection } from '@/components/shared/PageHeader';
import { StatusBadge, Badge } from '@/components/shared/StatusBadge';
import { RequestTypeBadge } from '@/components/shared/RequestTypeBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { CredentialView } from '@/components/shared/CredentialView';
import { Button } from '@/components/ui/button';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ZONE_COLOR_META, formatDate, formatDateTime, ROLES, REQUEST_STATUS_META } from '@/lib/constants';
import { toast } from '@/hooks/use-toast';
import { useStoreHydrated } from '@/lib/store';

export default function RequestDetailPage() {
  const hydrated = useStoreHydrated();
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const [credentialOpen, setCredentialOpen] = useState(false);
  const request = useSgaStore((s) => s.requests.find((r) => r.id === id));
  const companies = useSgaStore((s) => s.companies);
  const people = useSgaStore((s) => s.people);
  const users = useSgaStore((s) => s.users);
  const signers = useSgaStore((s) => s.authorizedSigners);
  const role = useSgaStore((s) => s.currentUser?.role);
  const submitRequest = useSgaStore((s) => s.submitRequest);

  if (!hydrated) {
    return (
      <div className="space-y-6">
        <PageHeader title="Detalle de la solicitud (Cargando...)" />
        <div className="space-y-4">
          <Skeleton className="h-[400px] w-full" />
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={() => router.push('/requests')}><ArrowLeft className="mr-2 h-4 w-4" />Volver</Button>
        <p className="text-sm text-text-muted">Solicitud no encontrada.</p>
      </div>
    );
  }

  const company = companies.find((c) => c.id === request.companyId);
  const signer = signers.find((s) => s.id === request.signerId);
  const signerPerson = signer ? people.find((p) => p.id === signer.personId) : null;
  const createdBy = users.find((u) => u.id === request.createdBy);
  const assignedTo = users.find((u) => u.id === request.assignedTo);
  const reqPeople = people.filter((p) => request.personIds.includes(p.id));

  const canSubmit = request.status === 'BORRADOR' && (role === 'ADMIN_EMPRESA' || role === 'SOLICITANTE');
  const canEdit = request.status === 'BORRADOR' || request.status === 'DEVUELTA_PARA_CORRECCION';
  const primaryPerson = people.find((p) => p.id === (request.primaryPersonId ?? request.personIds[0]));
  const canViewCredential =
    !!request.issuance &&
    (request.status === 'EN_CONFECCION' ||
      request.status === 'LISTA_PARA_ENTREGA' ||
      request.status === 'ENTREGADA' ||
      !!request.issuance.cardNumber);

  return (
    <div className="space-y-6">
      <PageHeader
        title={request.number}
        description={request.reason}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push('/requests')}><ArrowLeft className="mr-2 h-4 w-4" />Volver</Button>
            {canEdit && (
              <Button variant="outline" onClick={() => router.push(`/requests/new?edit=${request.id}`)}>
                <RotateCcw className="mr-2 h-4 w-4" />Editar
              </Button>
            )}
            {canViewCredential && (
              <Button variant="outline" onClick={() => setCredentialOpen(true)}>
                <IdCard className="mr-2 h-4 w-4" />Ver credencial
              </Button>
            )}
            {canSubmit && (
              <ConfirmDialog
                trigger={<Button><Send className="mr-2 h-4 w-4" />Enviar solicitud</Button>}
                title="Enviar solicitud"
                description="¿Confirma el envío de la solicitud para su revisión?"
                confirmLabel="Enviar"
                onConfirm={() => {
                  submitRequest(request.id);
                  toast({ title: 'Solicitud enviada' });
                }}
              />
            )}
          </div>
        }
      />

      {/* Header card */}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <RequestTypeBadge type={request.type} />
          <StatusBadge status={request.status} />
          <span className="text-xs text-text-muted">Creada el {formatDate(request.createdAt)}</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div>
            <p className="text-xs text-text-muted">Solicitante</p>
            <p className="font-medium text-text-primary">{createdBy ? `${createdBy.firstName} ${createdBy.lastName}` : '—'}</p>
          </div>
          {assignedTo && (
            <div>
              <p className="text-xs text-text-muted">Responsable</p>
              <p className="font-medium text-text-primary">{assignedTo.firstName} {assignedTo.lastName}</p>
            </div>
          )}
        </div>
      </div>

      <Tabs defaultValue="info">
        <TabsList className="flex h-auto flex-wrap gap-1 bg-surface-muted p-1">
          <TabsTrigger value="info" className="text-xs">Información</TabsTrigger>
          <TabsTrigger value="beneficiaries" className="text-xs">Beneficiarios</TabsTrigger>
          <TabsTrigger value="access" className="text-xs">Accesos</TabsTrigger>
          <TabsTrigger value="documents" className="text-xs">Documentos</TabsTrigger>
          <TabsTrigger value="history" className="text-xs">Historial</TabsTrigger>
          {request.status === 'ENTREGADA' || request.status === 'EN_CONFECCION' || request.status === 'LISTA_PARA_ENTREGA' ? (
            <TabsTrigger value="issuance" className="text-xs">Emisión</TabsTrigger>
          ) : null}
        </TabsList>

        {/* Info tab */}
        <TabsContent value="info" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <DetailSection title="Información general">
              <dl className="space-y-3">
                <InfoRow icon={Building2} label="Empresa" value={company?.tradeName ?? '—'} />
                <InfoRow icon={ShieldCheck} label="Firmante autorizado" value={signerPerson ? `${signerPerson.firstName} ${signerPerson.firstLastName} — ${signer?.position}` : '—'} />
                <InfoRow icon={FileText} label="Motivo" value={request.reason} />
                {request.serviceCompany && <InfoRow icon={Building2} label="Empresa de asistencia" value={request.serviceCompany} />}
                <InfoRow icon={Clock} label="Vigencia" value={`${formatDate(request.startDate)} — ${formatDate(request.endDate)}`} />
                <InfoRow icon={Clock} label="Horario" value={`${request.startTime} — ${request.endTime}`} />
                {request.observations && <InfoRow icon={FileText} label="Observaciones" value={request.observations} />}
              </dl>
            </DetailSection>

            <DetailSection title="Solicitante">
              <dl className="space-y-3">
                <InfoRow icon={User} label="Creado por" value={createdBy ? `${createdBy.firstName} ${createdBy.lastName}` : '—'} />
                <InfoRow icon={User} label="Correo" value={createdBy?.email ?? '—'} />
                <InfoRow icon={Building2} label="Empresa" value={company?.legalName ?? '—'} />
                <InfoRow icon={Clock} label="Fecha de creación" value={formatDateTime(request.createdAt)} />
                <InfoRow icon={Clock} label="Última actualización" value={formatDateTime(request.updatedAt)} />
              </dl>
            </DetailSection>
          </div>
        </TabsContent>

        {/* Beneficiaries tab */}
        <TabsContent value="beneficiaries" className="mt-4">
          <DetailSection title="Beneficiarios">
            {reqPeople.length === 0 ? (
              <EmptyState icon={User} title="Sin beneficiarios" />
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
                    {request.personExtras?.[p.id] && (
                      <div className="hidden text-right text-xs text-text-muted sm:block">
                        {request.personExtras[p.id].department && <p>{request.personExtras[p.id].department}</p>}
                        {request.personExtras[p.id].emergencyPersonnel && <p className="text-warning">Personal de emergencia</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </DetailSection>

          {request.vehicles.length > 0 && (
            <div className="mt-6">
              <DetailSection title="Vehículos">
                <div className="space-y-2">
                  {request.vehicles.map((v) => (
                    <div key={v.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                      <Car className="h-5 w-5 text-brand-600" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-text-primary">{v.make} {v.model}</p>
                        <p className="text-xs text-text-muted">{v.plate} · {v.color} · {v.year}</p>
                      </div>
                      {v.description && <span className="text-xs text-text-muted">{v.description}</span>}
                    </div>
                  ))}
                </div>
              </DetailSection>
            </div>
          )}

          {request.tools.length > 0 && (
            <div className="mt-6">
              <DetailSection title="Herramientas / Equipos">
                <div className="space-y-2">
                  {request.tools.map((t) => (
                    <div key={t.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                      <Wrench className="h-5 w-5 text-brand-600" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-text-primary">{t.make} {t.type}</p>
                        <p className="text-xs text-text-muted">S/N: {t.serialNumber} · Cantidad: {t.quantity}</p>
                      </div>
                      {t.description && <span className="text-xs text-text-muted">{t.description}</span>}
                    </div>
                  ))}
                </div>
              </DetailSection>
            </div>
          )}
        </TabsContent>

        {/* Access tab */}
        <TabsContent value="access" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <DetailSection title="Puntos de acceso">
              {request.accessPoints.length === 0 ? (
                <p className="text-sm text-text-muted">Sin puntos de acceso.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {request.accessPoints.map((ap) => (
                    <span key={ap} className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-sm text-text-secondary">
                      <MapPin className="h-3.5 w-3.5 text-brand-600" />{ap}
                    </span>
                  ))}
                </div>
              )}
            </DetailSection>

            <DetailSection title="Zonas de seguridad">
              {request.zones.length === 0 ? (
                <p className="text-sm text-text-muted">Sin zonas seleccionadas.</p>
              ) : (
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
              )}
            </DetailSection>
          </div>
        </TabsContent>

        {/* Documents tab */}
        <TabsContent value="documents" className="mt-4">
          <DetailSection title="Documentos adjuntos">
            {request.documents.length === 0 ? (
              <EmptyState icon={FileText} title="Sin documentos" />
            ) : (
              <div className="space-y-2">
                {request.documents.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                    <FileText className="h-5 w-5 text-brand-600" />
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-text-primary">{d.name}</p>
                      <p className="text-xs text-text-muted">{d.type} · Subido el {formatDate(d.uploadedAt)}</p>
                    </div>
                    {d.status === 'APROBADO' && <Badge tone="success"><CheckCircle2 className="h-3 w-3" />Aprobado</Badge>}
                    {d.status === 'RECHAZADO' && <Badge tone="danger"><XCircle className="h-3 w-3" />Rechazado</Badge>}
                    {d.status === 'PENDIENTE' && <Badge tone="warning">Pendiente</Badge>}
                    {d.observation && <span className="text-xs text-danger">{d.observation}</span>}
                  </div>
                ))}
              </div>
            )}
          </DetailSection>
        </TabsContent>

        {/* History tab */}
        <TabsContent value="history" className="mt-4">
          <DetailSection title="Historial de la solicitud">
            {request.history.length === 0 ? (
              <p className="text-sm text-text-muted">Sin eventos.</p>
            ) : (
              <div className="relative space-y-4 pl-6">
                <div className="absolute left-2 top-2 bottom-2 w-px bg-border" />
                {request.history.map((ev) => {
                  const meta = REQUEST_STATUS_META[ev.status];
                  return (
                    <div key={ev.id} className="relative">
                      <div className={`absolute -left-[18px] top-1.5 h-3 w-3 rounded-full border-2 border-surface ${meta.tone === 'success' ? 'bg-success' : meta.tone === 'danger' ? 'bg-danger' : meta.tone === 'warning' ? 'bg-warning' : meta.tone === 'brand' ? 'bg-brand-600' : 'bg-brand-400'}`} />
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-text-primary">{ev.action}</p>
                          <p className="text-xs text-text-muted">{ev.actor} · {ROLES[ev.actorRole].label}</p>
                          {ev.comment && <p className="mt-1 text-xs text-text-secondary">{ev.comment}</p>}
                        </div>
                        <span className="shrink-0 text-xs text-text-muted">{formatDateTime(ev.timestamp)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </DetailSection>
        </TabsContent>

        {/* Issuance tab */}
        {(request.status === 'ENTREGADA' || request.status === 'EN_CONFECCION' || request.status === 'LISTA_PARA_ENTREGA') && (
          <TabsContent value="issuance" className="mt-4">
            <DetailSection title="Información de emisión">
              <dl className="space-y-3">
                {request.issuance?.startedAt && <InfoRow icon={IdCard} label="Confección iniciada" value={formatDateTime(request.issuance.startedAt)} />}
                {request.issuance?.cardNumber && <InfoRow icon={IdCard} label="Número de credencial" value={request.issuance.cardNumber} />}
                {request.issuance?.readyAt && <InfoRow icon={PackageCheck} label="Lista para entrega" value={formatDateTime(request.issuance.readyAt)} />}
                {request.issuance?.deliveredAt && <InfoRow icon={CheckCircle2} label="Entregada" value={formatDateTime(request.issuance.deliveredAt)} />}
                {request.issuance?.receivedBy && <InfoRow icon={User} label="Recibido por" value={request.issuance.receivedBy} />}
                {request.issuance?.deliveryObservation && <InfoRow icon={FileText} label="Observación" value={request.issuance.deliveryObservation} />}
              </dl>
            </DetailSection>
          </TabsContent>
        )}
      </Tabs>

      {canViewCredential && (
        <CredentialView
          request={request}
          person={primaryPerson}
          companyName={company?.tradeName}
          open={credentialOpen}
          onOpenChange={setCredentialOpen}
        />
      )}
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
