import type {
  Prisma,
  Request as PrismaRequest,
  RequestPerson as PrismaRequestPerson,
  RequestVehicle as PrismaRequestVehicle,
  RequestEquipment as PrismaRequestEquipment,
  RequestAccessPoint as PrismaRequestAccessPoint,
  RequestAccessArea as PrismaRequestAccessArea,
  CatalogItem as PrismaCatalogItem,
} from '../../../../../generated/prisma/client';
import {
  Request,
  type RequestProps,
  type RequestPersonLink,
  type RequestVehicleLink,
  type RequestEquipmentLink,
  type RequestAccessPointLink,
  type RequestAccessAreaLink,
  type RequestStatus,
  type RequestTypeCode,
  type RequestPersonRole,
  type ReviewStatus,
} from '../../../domain/entities/request.entity';

type RequestRow = PrismaRequest & {
  requestType: Pick<PrismaCatalogItem, 'id' | 'code' | 'name'>;
  personLinks: PrismaRequestPerson[];
  vehicles: PrismaRequestVehicle[];
  equipment: PrismaRequestEquipment[];
  accessPoints: PrismaRequestAccessPoint[];
  accessAreas: PrismaRequestAccessArea[];
};

const REQUEST_TYPE_CODES: readonly string[] = [
  'NEW_PERSONNEL',
  'TEMPORARY_PERSONNEL',
  'VEHICLE',
  'EQUIPMENT',
];

function toRequestTypeCode(code: string | null): RequestTypeCode | null {
  if (!code) return null;
  return REQUEST_TYPE_CODES.includes(code) ? code : null;
}

export class RequestMapper {
  static toDomain(row: RequestRow): Request {
    const props: RequestProps = {
      id: row.id,
      requestNumber: row.requestNumber,
      companyId: row.companyId,
      requestTypeId: row.requestTypeId,
      requestTypeCode: toRequestTypeCode(row.requestType?.code ?? null),
      createdByUserId: row.createdByUserId,
      createdByCompanyId: row.createdByCompanyId,
      authorizedSignerId: row.authorizedSignerId,
      rejectionReasonId: row.rejectionReasonId,
      reason: row.reason,
      serviceCompanyName: row.serviceCompanyName,
      validFrom: row.validFrom,
      validUntil: row.validUntil,
      scheduleFrom: row.scheduleFrom,
      scheduleUntil: row.scheduleUntil,
      observations: row.observations,
      status: row.status,
      version: row.version,
      submittedAt: row.submittedAt,
      cancelledAt: row.cancelledAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      personLinks: row.personLinks.map((p) => this.toPersonLink(p)),
      vehicles: row.vehicles.map((v) => this.toVehicleLink(v)),
      equipment: row.equipment.map((e) => this.toEquipmentLink(e)),
      accessPoints: row.accessPoints.map((a) => this.toAccessPointLink(a)),
      accessAreas: row.accessAreas.map((a) => this.toAccessAreaLink(a)),
    };
    return Request.reconstitute(props);
  }

  private static toPersonLink(row: PrismaRequestPerson): RequestPersonLink {
    return {
      id: row.id,
      requestId: row.requestId,
      personId: row.personId,
      role: row.role,
      personalEmergency: row.personalEmergency,
      usePreviousPhoto: row.usePreviousPhoto,
      departmentSnapshot: row.departmentSnapshot,
      positionSnapshot: row.positionSnapshot,
      companyNameSnapshot: row.companyNameSnapshot,
      identificationSnapshot: row.identificationSnapshot,
      fullNameSnapshot: row.fullNameSnapshot,
      createdAt: row.createdAt,
    };
  }

  private static toVehicleLink(row: PrismaRequestVehicle): RequestVehicleLink {
    return {
      id: row.id,
      requestId: row.requestId,
      brand: row.brand,
      model: row.model,
      plateNumber: row.plateNumber,
      color: row.color,
      year: row.year,
      description: row.description,
      createdAt: row.createdAt,
    };
  }

  private static toEquipmentLink(
    row: PrismaRequestEquipment,
  ): RequestEquipmentLink {
    return {
      id: row.id,
      requestId: row.requestId,
      brand: row.brand,
      equipmentType: row.equipmentType,
      serialNumber: row.serialNumber,
      description: row.description,
      quantity: row.quantity,
      createdAt: row.createdAt,
    };
  }

  private static toAccessPointLink(
    row: PrismaRequestAccessPoint,
  ): RequestAccessPointLink {
    return {
      id: row.id,
      requestId: row.requestId,
      accessPointId: row.accessPointId,
      createdAt: row.createdAt,
    };
  }

  private static toAccessAreaLink(
    row: PrismaRequestAccessArea,
  ): RequestAccessAreaLink {
    return {
      id: row.id,
      requestId: row.requestId,
      accessAreaId: row.accessAreaId,
      justification: row.justification,
      reviewStatus: row.reviewStatus,
      reviewedBy: row.reviewedBy,
      reviewedAt: row.reviewedAt,
      reviewComment: row.reviewComment,
      createdAt: row.createdAt,
    };
  }

  static toPersistenceCreate(req: Request): Prisma.RequestUncheckedCreateInput {
    const props = req.toProps();
    return {
      id: props.id,
      requestNumber: props.requestNumber,
      companyId: props.companyId,
      requestTypeId: props.requestTypeId,
      createdByUserId: props.createdByUserId,
      createdByCompanyId: props.createdByCompanyId,
      authorizedSignerId: props.authorizedSignerId,
      rejectionReasonId: props.rejectionReasonId,
      reason: props.reason,
      serviceCompanyName: props.serviceCompanyName,
      validFrom: props.validFrom,
      validUntil: props.validUntil,
      scheduleFrom: props.scheduleFrom,
      scheduleUntil: props.scheduleUntil,
      observations: props.observations,
      status: props.status,
      version: props.version,
      submittedAt: props.submittedAt,
      cancelledAt: props.cancelledAt,
    };
  }

  static toPersistenceUpdate(req: Request): Prisma.RequestUncheckedUpdateInput {
    const props = req.toProps();
    return {
      requestNumber: props.requestNumber,
      authorizedSignerId: props.authorizedSignerId,
      rejectionReasonId: props.rejectionReasonId,
      reason: props.reason,
      serviceCompanyName: props.serviceCompanyName,
      validFrom: props.validFrom,
      validUntil: props.validUntil,
      scheduleFrom: props.scheduleFrom,
      scheduleUntil: props.scheduleUntil,
      observations: props.observations,
      status: props.status,
      version: props.version,
      submittedAt: props.submittedAt,
      cancelledAt: props.cancelledAt,
    };
  }
}
