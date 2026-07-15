import type {
  CredentialResponse,
  DocumentResponse,
  RequestEventResponse,
  RequestListItem,
  RequestResponse,
} from '@/hooks/api-workflow-hooks';
import type { CatalogEntry, RequestStatus, RequestType, AccessRequest, Role, User } from '@/lib/types';

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
    primaryPersonId: row.primaryPersonId ?? undefined,
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
  const credential = context.credentials?.find((item) => item.requestId === row.id);
  return {
    ...summary,
    signerId: row.authorizedSignerId ?? undefined,
    serviceCompany: row.serviceCompanyName ?? undefined,
    startTime: row.scheduleFrom ?? '',
    endTime: row.scheduleUntil ?? '',
    observations: row.observations ?? undefined,
    personIds: row.personLinks.map((link) => link.personId),
    primaryPersonId:
      row.personLinks.find((link) => link.role === 'PRIMARY')?.personId ?? undefined,
    personExtras: Object.fromEntries(
      row.personLinks.map((link) => [
        link.personId,
        {
          department: link.departmentSnapshot ?? undefined,
          position: link.positionSnapshot ?? undefined,
          reusePhoto: link.usePreviousPhoto,
          emergencyPersonnel: link.personalEmergency,
        },
      ]),
    ),
    vehicles: row.vehicles.map((vehicle) => ({
      id: vehicle.id,
      make: vehicle.brand,
      model: vehicle.model,
      plate: vehicle.plateNumber,
      color: vehicle.color ?? '',
      year: vehicle.year ?? new Date().getFullYear(),
      description: vehicle.description ?? undefined,
    })),
    tools: row.equipment.map((item) => ({
      id: item.id,
      make: item.brand ?? '',
      type: item.equipmentType,
      serialNumber: item.serialNumber ?? '',
      description: item.description ?? undefined,
      quantity: item.quantity,
    })),
    accessPoints: row.accessPoints.map(
      (link) =>
        context.accessPoints?.find((item) => item.id === link.accessPointId)?.label ??
        link.accessPointId,
    ),
    zones: row.accessAreas.map((link) => {
      const area = context.accessAreas?.find((item) => item.id === link.accessAreaId);
      const code = area?.code ?? link.accessAreaId;
      return {
        zoneColor: (area?.zoneColor ?? code.split('-')[0]) as AccessRequest['zones'][number]['zoneColor'],
        areaCode: code.split('-').slice(1).join('-') || code,
        areaName: area?.label ?? code,
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
