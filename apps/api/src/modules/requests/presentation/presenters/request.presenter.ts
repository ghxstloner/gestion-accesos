import { Request } from '../../domain/entities/request.entity';
import type {
  RequestPersonLink,
  RequestVehicleLink,
  RequestEquipmentLink,
  RequestAccessPointLink,
  RequestAccessAreaLink,
} from '../../domain/entities/request.entity';
import { RequestEvent } from '../../domain/entities/request-event.entity';

export interface PersonLinkResponse {
  id: string;
  personId: string;
  role: string;
  personalEmergency: boolean;
  usePreviousPhoto: boolean;
  departmentSnapshot: string | null;
  positionSnapshot: string | null;
  companyNameSnapshot: string | null;
  identificationSnapshot: string | null;
  fullNameSnapshot: string | null;
}

export interface VehicleResponse {
  id: string;
  brand: string;
  model: string;
  plateNumber: string;
  color: string | null;
  year: number | null;
  description: string | null;
}

export interface EquipmentResponse {
  id: string;
  brand: string | null;
  equipmentType: string;
  serialNumber: string | null;
  description: string | null;
  quantity: number;
}

export interface AccessPointResponse {
  id: string;
  accessPointId: string;
}

export interface AccessAreaResponse {
  id: string;
  accessAreaId: string;
  justification: string | null;
  reviewStatus: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewComment: string | null;
}

export interface RequestResponseDto {
  id: string;
  requestNumber: string | null;
  companyId: string;
  requestTypeId: string;
  requestTypeCode: string | null;
  createdByUserId: string;
  createdByCompanyId: string | null;
  authorizedSignerId: string | null;
  rejectionReasonId: string | null;
  reason: string;
  serviceCompanyName: string | null;
  validFrom: string | null;
  validUntil: string | null;
  scheduleFrom: string | null;
  scheduleUntil: string | null;
  observations: string | null;
  status: string;
  version: number;
  submittedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  personLinks: PersonLinkResponse[];
  vehicles: VehicleResponse[];
  equipment: EquipmentResponse[];
  accessPoints: AccessPointResponse[];
  accessAreas: AccessAreaResponse[];
}

export interface RequestListItemDto {
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
  createdAt: string;
  updatedAt: string;
  personCount: number;
  vehicleCount: number;
}

export interface RequestEventResponseDto {
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

export class RequestPresenter {
  static toResponse(req: Request): RequestResponseDto {
    const props = req.toProps();
    return {
      id: props.id,
      requestNumber: props.requestNumber,
      companyId: props.companyId,
      requestTypeId: props.requestTypeId,
      requestTypeCode: props.requestTypeCode,
      createdByUserId: props.createdByUserId,
      createdByCompanyId: props.createdByCompanyId,
      authorizedSignerId: props.authorizedSignerId,
      rejectionReasonId: props.rejectionReasonId,
      reason: props.reason,
      serviceCompanyName: props.serviceCompanyName,
      validFrom: props.validFrom ? props.validFrom.toISOString() : null,
      validUntil: props.validUntil ? props.validUntil.toISOString() : null,
      scheduleFrom: props.scheduleFrom,
      scheduleUntil: props.scheduleUntil,
      observations: props.observations,
      status: props.status,
      version: props.version,
      submittedAt: props.submittedAt ? props.submittedAt.toISOString() : null,
      cancelledAt: props.cancelledAt ? props.cancelledAt.toISOString() : null,
      createdAt: props.createdAt.toISOString(),
      updatedAt: props.updatedAt.toISOString(),
      personLinks: props.personLinks.map((p) => this.toPersonLink(p)),
      vehicles: props.vehicles.map((v) => this.toVehicle(v)),
      equipment: props.equipment.map((e) => this.toEquipment(e)),
      accessPoints: props.accessPoints.map((p) => this.toAccessPoint(p)),
      accessAreas: props.accessAreas.map((a) => this.toAccessArea(a)),
    };
  }

  static toListItem(req: Request): RequestListItemDto {
    const props = req.toProps();
    return {
      id: props.id,
      requestNumber: props.requestNumber,
      companyId: props.companyId,
      createdByUserId: props.createdByUserId,
      status: props.status,
      requestTypeCode: props.requestTypeCode,
      reason: props.reason,
      validFrom: props.validFrom ? props.validFrom.toISOString() : null,
      validUntil: props.validUntil ? props.validUntil.toISOString() : null,
      primaryPersonId:
        props.personLinks.find((link) => link.role === 'PRIMARY')?.personId ??
        null,
      createdAt: props.createdAt.toISOString(),
      updatedAt: props.updatedAt.toISOString(),
      personCount: props.personLinks.length,
      vehicleCount: props.vehicles.length,
    };
  }

  static toEvent(event: RequestEvent): RequestEventResponseDto {
    return {
      id: event.id,
      eventType: event.eventType,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      actorUserId: event.actorUserId,
      actorRoleCode: event.actorRoleCode,
      reasonCode: event.reasonCode,
      comment: event.comment,
      occurredAt: event.occurredAt.toISOString(),
    };
  }

  private static toPersonLink(link: RequestPersonLink): PersonLinkResponse {
    return {
      id: link.id,
      personId: link.personId,
      role: link.role,
      personalEmergency: link.personalEmergency,
      usePreviousPhoto: link.usePreviousPhoto,
      departmentSnapshot: link.departmentSnapshot,
      positionSnapshot: link.positionSnapshot,
      companyNameSnapshot: link.companyNameSnapshot,
      identificationSnapshot: link.identificationSnapshot,
      fullNameSnapshot: link.fullNameSnapshot,
    };
  }

  private static toVehicle(v: RequestVehicleLink): VehicleResponse {
    return {
      id: v.id,
      brand: v.brand,
      model: v.model,
      plateNumber: v.plateNumber,
      color: v.color,
      year: v.year,
      description: v.description,
    };
  }

  private static toEquipment(e: RequestEquipmentLink): EquipmentResponse {
    return {
      id: e.id,
      brand: e.brand,
      equipmentType: e.equipmentType,
      serialNumber: e.serialNumber,
      description: e.description,
      quantity: e.quantity,
    };
  }

  private static toAccessPoint(p: RequestAccessPointLink): AccessPointResponse {
    return { id: p.id, accessPointId: p.accessPointId };
  }

  private static toAccessArea(a: RequestAccessAreaLink): AccessAreaResponse {
    return {
      id: a.id,
      accessAreaId: a.accessAreaId,
      justification: a.justification,
      reviewStatus: a.reviewStatus,
      reviewedBy: a.reviewedBy,
      reviewedAt: a.reviewedAt ? a.reviewedAt.toISOString() : null,
      reviewComment: a.reviewComment,
    };
  }
}
