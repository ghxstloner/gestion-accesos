import type {
  CredentialResponse,
  DocumentResponse,
  RequestEventResponse,
  RequestListItem,
  RequestResponse,
} from '@/hooks/api-workflow-hooks';
import type { CatalogEntry, RequestStatus, RequestType, AccessRequest, Role, User, ZoneColor } from '@/lib/types';

const STATUS_FROM_API: Record<string, RequestStatus> = {
  DRAFT: 'BORRADOR',
  SUBMITTED: 'ENVIADA',
  UNDER_DOCUMENT_REVIEW: 'EN_REVISION_DOCUMENTAL',
  RETURNED_FOR_CORRECTION: 'DEVUELTA_PARA_CORRECCION',
  DOCUMENTS_APPROVED: 'DOCUMENTOS_APROBADOS',
  PENDING_FINAL_APPROVAL: 'PENDIENTE_APROBACION',
  APPROVED: 'APROBADA',
  REJECTED: 'RECHAZADA',
  IN_PRODUCTION: 'EN_CONFECCION',
  READY_FOR_DELIVERY: 'LISTA_PARA_ENTREGA',
  DELIVERED: 'ENTREGADA',
  CANCELLED: 'CANCELADA',
};

const TYPE_FROM_API: Record<string, RequestType> = {
  PERMANENT_CARD: 'CARNE_PERMANENTE',
  TEMPORARY_PERSON: 'PERMISO_PERSONA',
  TEMPORARY_VEHICLE: 'PERMISO_VEHICULO',
  TEMPORARY_EQUIPMENT: 'PERMISO_HERRAMIENTA',
};

const VALID_ZONE_COLORS = new Set<ZoneColor>([
  'ROJA', 'NARANJA', 'AZUL', 'AMARILLA', 'VERDE', 'BLANCA', 'CELESTE',
]);

/**
 * Resolves a ZoneColor from a possibly-messy source. Accepts:
 *  - a valid ZoneColor directly,
 *  - an area code like "ROJA-A" (prefix before first dash),
 *  - anything else falls back to 'BLANCA' (neutral grey) so the UI never crashes.
 */
function coerceZoneColor(raw: string | undefined | null): ZoneColor {
  if (raw && VALID_ZONE_COLORS.has(raw as ZoneColor)) return raw as ZoneColor;
  if (raw) {
    const prefix = raw.split('-')[0].toUpperCase();
    if (VALID_ZONE_COLORS.has(prefix as ZoneColor)) return prefix as ZoneColor;
  }
  return 'BLANCA';
}

const EVENT_LABELS: Record<string, string> = {
  CREATED: 'Borrador creado',
  SUBMITTED: 'Solicitud enviada',
  RESUBMITTED: 'Solicitud reenviada',
  DOCUMENTS_APPROVED: 'Documentos aprobados',
  APPROVED: 'Solicitud aprobada',
  RETURNED: 'Devuelta para corrección',
  REJECTED: 'Solicitud rechazada',
  CANCELLED: 'Solicitud cancelada',
};

export const toFrontendRequestStatus = (status: string): RequestStatus =>
  STATUS_FROM_API[status] ?? 'BORRADOR';

export const toBackendRequestStatus = (status: RequestStatus): string =>
  Object.entries(STATUS_FROM_API).find(([, value]) => value === status)?.[0] ?? status;

export const toFrontendRequestType = (code: string | null): RequestType =>
  TYPE_FROM_API[code ?? ''] ?? 'PERMISO_PERSONA';

export const toBackendRequestTypeCode = (type: RequestType): string =>
  Object.entries(TYPE_FROM_API).find(([, value]) => value === type)?.[0] ?? type;

export function toAccessRequestSummary(row: RequestListItem): AccessRequest {
  return {
    id: row.id,
    number: row.requestNumber ?? 'Borrador',
    type: toFrontendRequestType(row.requestTypeCode),
    companyId: row.companyId,
    reason: row.reason,
    startDate: row.validFrom ?? '',
    endDate: row.validUntil ?? '',
    startTime: '',
    endTime: '',
    personIds: [],
    primaryPersonId: row.primaryParticipantUserId ?? row.primaryPersonId ?? undefined,
    vehicles: [],
    tools: [],
    accessPoints: [],
    zones: [],
    documents: [],
    status: toFrontendRequestStatus(row.status),
    createdBy: row.createdByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    history: [],
  };
}

export function toAccessRequest(
  row: RequestResponse,
  context: {
    accessPoints?: CatalogEntry[];
    accessAreas?: CatalogEntry[];
    documentTypes?: CatalogEntry[];
    documents?: DocumentResponse[];
    events?: RequestEventResponse[];
    credentials?: CredentialResponse[];
    users?: User[];
  } = {},
): AccessRequest {
  const summary = toAccessRequestSummary(row);
  const nameForUser = (id: string | null) => {
    const user = context.users?.find((item) => item.id === id);
    return user ? `${user.firstName} ${user.lastName}` : 'Sistema';
  };
  // Backend contract is `participants`/`participantUserId`; older payloads used
  // `personLinks`/`personId`. Normalize once so the rest of the mapper is agnostic.
  const rawParticipants = row.participants ?? row.personLinks ?? [];
  const personLinks = rawParticipants.map((link) => ({
    id: link.id,
    personId: 'participantUserId' in link && link.participantUserId
      ? link.participantUserId
      : ('personId' in link ? (link as { personId?: string }).personId : '') ?? '',
    role: link.role,
    personalEmergency: link.personalEmergency,
    usePreviousPhoto: link.usePreviousPhoto,
    departmentSnapshot: link.departmentSnapshot,
    positionSnapshot: link.positionSnapshot,
  }));
  const credential = context.credentials?.find((item) => item.requestId === row.id);
  return {
    ...summary,
    signerId: row.authorizedSignerId ?? undefined,
    serviceCompany: row.serviceCompanyName ?? undefined,
    startTime: row.scheduleFrom ?? '',
    endTime: row.scheduleUntil ?? '',
    observations: row.observations ?? undefined,
    personIds: personLinks.map((link) => link.personId),
    primaryPersonId:
      personLinks.find((link) => link.role === 'PRIMARY')?.personId ?? undefined,
    personExtras: Object.fromEntries(
      personLinks.map((link) => [
        link.personId,
        {
          department: link.departmentSnapshot ?? undefined,
          position: link.positionSnapshot ?? undefined,
          reusePhoto: link.usePreviousPhoto,
          emergencyPersonnel: link.personalEmergency,
        },
      ]),
    ),
    vehicles: (row.vehicles ?? []).map((vehicle) => ({
      id: vehicle.id,
      make: vehicle.brand,
      model: vehicle.model,
      plate: vehicle.plateNumber,
      color: vehicle.color ?? '',
      year: vehicle.year ?? new Date().getFullYear(),
      description: vehicle.description ?? undefined,
    })),
    tools: (row.equipment ?? []).map((item) => ({
      id: item.id,
      make: item.brand ?? '',
      type: item.equipmentType,
      serialNumber: item.serialNumber ?? '',
      description: item.description ?? undefined,
      quantity: item.quantity,
    })),
    accessPoints: (row.accessPoints ?? []).map(
      (link) =>
        context.accessPoints?.find((item) => item.id === link.accessPointId)?.label ??
        link.accessPointId,
    ),
    zones: (row.accessAreas ?? []).map((link) => {
      const area = context.accessAreas?.find((item) => item.id === link.accessAreaId);
      // Prefer the catalog's structured code (e.g. "ROJA-A") over the raw
      // accessAreaId (which is a UUID on the backend) so zoneColor resolves
      // correctly even when the catalog is still loading.
      const code = area?.code ?? link.accessAreaId;
      const zoneColor = coerceZoneColor(area?.zoneColor ?? code);
      return {
        zoneColor,
        areaCode: code.includes('-') ? code.split('-').slice(1).join('-') : '',
        areaName: area?.label ?? (code.includes('-') ? code.split('-').slice(1).join('-') : code),
        justification: link.justification ?? '',
      };
    }),
    documents: (context.documents ?? []).map((document) => {
      const current = document.versions.find((version) => version.id === document.currentVersionId) ?? document.versions.at(-1);
      return {
        id: document.id,
        name: current?.originalFilename ?? 'Documento',
        type:
          context.documentTypes?.find((item) => item.id === document.documentTypeId)?.label ??
          document.documentTypeId,
        size: current?.size ?? 0,
        uploadedAt: current?.uploadedAt ?? document.createdAt,
        status:
          document.status === 'APPROVED'
            ? 'APROBADO'
            : document.status === 'REJECTED'
              ? 'RECHAZADO'
              : 'PENDIENTE',
        requestId: row.id,
      };
    }),
    history: (context.events ?? []).map((event) => ({
      id: event.id,
      status: toFrontendRequestStatus(event.toStatus),
      action: EVENT_LABELS[event.eventType] ?? event.eventType,
      actor: nameForUser(event.actorUserId),
      actorRole: 'SOLICITANTE' as Role,
      comment: event.comment ?? undefined,
      timestamp: event.occurredAt,
    })),
    issuance: credential
      ? {
          startedAt: credential.producedAt ?? undefined,
          readyAt: credential.readyAt ?? undefined,
          cardNumber: credential.credentialNumber,
          deliveredAt: credential.deliveredAt ?? undefined,
          actedBy: credential.createdBy,
        }
      : undefined,
  };
}
