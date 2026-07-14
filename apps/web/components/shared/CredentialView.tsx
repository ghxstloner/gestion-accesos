'use client';

import {
  IdCard,
  Building2,
  MapPin,
  Calendar,
  ShieldAlert,
  User,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ZONE_COLOR_META, formatDate } from '@/lib/constants';
import type { AccessRequest, Person } from '@/lib/types';

export interface CredentialViewProps {
  request: AccessRequest;
  /** Primary person whose data appears on the card. */
  person: Person | undefined;
  /** Trade name of the requesting company. */
  companyName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Visual rendering of an issued credential (carné). Opens in a Dialog so it
 * can be reused from the request detail page and the issuance list. When the
 * credential hasn't been generated yet (status < LISTA_PARA_ENTREGA) the
 * number is hidden and a helpful notice is shown.
 */
export function CredentialView({
  request,
  person,
  companyName,
  open,
  onOpenChange,
}: CredentialViewProps) {
  const cardNumber = request.issuance?.cardNumber;
  const isReady =
    request.status === 'LISTA_PARA_ENTREGA' ||
    request.status === 'ENTREGADA' ||
    !!cardNumber;

  const fullName = person
    ? `${person.firstName} ${person.firstLastName}`
    : '—';
  const idNumber = person?.idNumber ?? '—';
  const position =
    request.personExtras?.[request.primaryPersonId ?? '']?.position ??
    person?.position ??
    '—';
  const isEmergency =
    request.personExtras?.[request.primaryPersonId ?? '']?.emergencyPersonnel ??
    false;
  const typeLabel = REQUEST_TYPE_LABELS[request.type] ?? request.type;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md"
        aria-describedby="credential-desc"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IdCard className="h-5 w-5 text-brand-600" />
            Credencial {cardNumber ?? ''}
          </DialogTitle>
          <DialogDescription id="credential-desc">
            Vista de la credencial generada para esta solicitud.
          </DialogDescription>
        </DialogHeader>

        {!isReady ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <p className="text-sm text-text-muted">
              La credencial aún no ha sido generada. Estará disponible cuando la
              solicitud pase a estado <strong>Lista para entrega</strong>.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* The credential paper */}
            <div className="overflow-hidden rounded-xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white shadow-sm">
              <div className="flex items-center justify-between bg-brand-700 px-4 py-3 text-white">
                <div>
                  <p className="text-[10px] uppercase tracking-wider opacity-80">
                    Amaxonia · Sistema de Gestión de Accesos
                  </p>
                  <p className="text-sm font-semibold">{typeLabel}</p>
                </div>
                {isEmergency && (
                  <span className="flex items-center gap-1 rounded-full bg-warning px-2 py-0.5 text-[10px] font-semibold text-warning-foreground">
                    <ShieldAlert className="h-3 w-3" />Emergencia
                  </span>
                )}
              </div>
              <div className="flex gap-4 p-4">
                {/* Photo placeholder avatar */}
                <div className="flex h-20 w-16 flex-shrink-0 items-center justify-center rounded-md bg-brand-100 text-lg font-bold text-brand-700">
                  {person ? `${person.firstName[0]}${person.firstLastName[0]}` : '?'}
                </div>
                <div className="flex-1 space-y-1 text-sm">
                  <CredentialRow icon={User} label="Nombre" value={fullName} />
                  <CredentialRow icon={IdCard} label="Identificación" value={idNumber} />
                  <CredentialRow icon={Building2} label="Cargo" value={position} />
                  <CredentialRow
                    icon={Building2}
                    label="Empresa"
                    value={companyName ?? '—'}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-px bg-border">
                <CredentialMeta
                  label="N° Credencial"
                  value={cardNumber ?? '—'}
                />
                <CredentialMeta
                  label="Emisión"
                  value={request.issuance?.readyAt ? formatDate(request.issuance.readyAt) : '—'}
                />
                <CredentialMeta
                  label="Vigencia desde"
                  value={request.startDate ? formatDate(request.startDate) : '—'}
                />
                <CredentialMeta
                  label="Vigencia hasta"
                  value={request.endDate ? formatDate(request.endDate) : '—'}
                />
              </div>
            </div>

            {/* Zones summary */}
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                Zonas autorizadas
              </p>
              {request.zones.length === 0 ? (
                <p className="text-sm text-text-muted">Sin zonas definidas.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {request.zones.map((z) => {
                    const meta = ZONE_COLOR_META[z.zoneColor];
                    return (
                      <span
                        key={`${z.zoneColor}-${z.areaCode}`}
                        className="rounded-md border px-2 py-0.5 text-xs"
                        style={{
                          backgroundColor: meta?.soft,
                          color: meta?.hex,
                          borderColor: `${meta?.hex}40`,
                        }}
                      >
                        {meta?.label} · {z.areaCode}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Status footer */}
            <div className="flex items-center justify-between rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs">
              <span className="flex items-center gap-1 text-text-muted">
                <Calendar className="h-3.5 w-3.5" />
                {request.issuance?.deliveredAt
                  ? `Entregada el ${formatDate(request.issuance.deliveredAt)}`
                  : 'Pendiente de entrega'}
              </span>
              <StatusBadge status={request.status} />
            </div>

            <p className="flex items-center gap-1 text-[11px] text-text-disabled">
              <MapPin className="h-3 w-3" />
              Documento simulado — no válido como identificación física.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

const REQUEST_TYPE_LABELS: Record<AccessRequest['type'], string> = {
  CARNE_PERMANENTE: 'Carné permanente',
  PERMISO_PERSONA: 'Permiso persona',
  PERMISO_VEHICULO: 'Permiso vehículo',
  PERMISO_HERRAMIENTA: 'Permiso herramienta',
};

function CredentialRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <Icon className="h-3.5 w-3.5 flex-shrink-0 text-text-muted" />
      <span className="text-text-muted">{label}:</span>
      <span className="font-medium text-text-primary">{value}</span>
    </div>
  );
}

function CredentialMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface p-2">
      <p className="text-[10px] uppercase tracking-wide text-text-muted">{label}</p>
      <p className="text-sm font-semibold text-text-primary">{value}</p>
    </div>
  );
}
