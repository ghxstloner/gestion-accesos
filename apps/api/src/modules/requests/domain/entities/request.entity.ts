/**
 * Request root aggregate.
 *
 * Owns the lifecycle of an access request including its associated people,
 * vehicles, equipment, access points, and access areas. Status transitions
 * are routed through RequestStatePolicy.
 *
 * Prisma-aligned status values: DRAFT / SUBMITTED / UNDER_DOCUMENT_REVIEW /
 * RETURNED_FOR_CORRECTION / DOCUMENTS_APPROVED / PENDING_FINAL_APPROVAL /
 * APPROVED / REJECTED / IN_PRODUCTION / READY_FOR_DELIVERY / DELIVERED / CANCELLED
 */

import {
  BusinessRuleError,
  NotFoundError,
  ValidationError,
} from '../../../../common/domain/errors/domain-error';

export type RequestStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_DOCUMENT_REVIEW'
  | 'RETURNED_FOR_CORRECTION'
  | 'DOCUMENTS_APPROVED'
  | 'PENDING_FINAL_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'IN_PRODUCTION'
  | 'READY_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

export type RequestTypeCode = string;

export type RequestPersonRole = 'PRIMARY' | 'BENEFICIARY';

export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface RequestPersonLink {
  id: string;
  requestId: string;
  personId: string;
  role: RequestPersonRole;
  personalEmergency: boolean;
  usePreviousPhoto: boolean;
  departmentSnapshot: string | null;
  positionSnapshot: string | null;
  companyNameSnapshot: string | null;
  identificationSnapshot: string | null;
  fullNameSnapshot: string | null;
  createdAt: Date;
}

export interface RequestVehicleLink {
  id: string;
  requestId: string;
  brand: string;
  model: string;
  plateNumber: string;
  color: string | null;
  year: number | null;
  description: string | null;
  createdAt: Date;
}

export interface RequestEquipmentLink {
  id: string;
  requestId: string;
  brand: string | null;
  equipmentType: string;
  serialNumber: string | null;
  description: string | null;
  quantity: number;
  createdAt: Date;
}

export interface RequestAccessPointLink {
  id: string;
  requestId: string;
  accessPointId: string;
  createdAt: Date;
}

export interface RequestAccessAreaLink {
  id: string;
  requestId: string;
  accessAreaId: string;
  justification: string | null;
  reviewStatus: ReviewStatus;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  reviewComment: string | null;
  createdAt: Date;
}

export interface RequestProps {
  id: string;
  requestNumber: string | null;
  companyId: string;
  requestTypeId: string;
  requestTypeCode: RequestTypeCode | null;
  createdByUserId: string;
  createdByCompanyId: string | null;
  authorizedSignerId: string | null;
  rejectionReasonId: string | null;
  reason: string;
  serviceCompanyName: string | null;
  validFrom: Date | null;
  validUntil: Date | null;
  scheduleFrom: string | null;
  scheduleUntil: string | null;
  observations: string | null;
  status: RequestStatus;
  version: number;
  submittedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  personLinks: RequestPersonLink[];
  vehicles: RequestVehicleLink[];
  equipment: RequestEquipmentLink[];
  accessPoints: RequestAccessPointLink[];
  accessAreas: RequestAccessAreaLink[];
}

export interface NewRequestInput {
  companyId: string;
  requestTypeId: string;
  requestTypeCode: RequestTypeCode | null;
  createdByUserId: string;
  createdByCompanyId: string | null;
  reason: string;
  serviceCompanyName?: string | null;
  validFrom?: Date | null;
  validUntil?: Date | null;
  scheduleFrom?: string | null;
  scheduleUntil?: string | null;
  observations?: string | null;
}

export class Request {
  private readonly _id: string;
  private _requestNumber: string | null;
  private readonly _companyId: string;
  private readonly _requestTypeId: string;
  private _requestTypeCode: RequestTypeCode | null;
  private readonly _createdByUserId: string;
  private _createdByCompanyId: string | null;
  private _authorizedSignerId: string | null;
  private _rejectionReasonId: string | null;
  private _reason: string;
  private _serviceCompanyName: string | null;
  private _validFrom: Date | null;
  private _validUntil: Date | null;
  private _scheduleFrom: string | null;
  private _scheduleUntil: string | null;
  private _observations: string | null;
  private _status: RequestStatus;
  private _version: number;
  private _submittedAt: Date | null;
  private _cancelledAt: Date | null;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _personLinks: RequestPersonLink[];
  private _vehicles: RequestVehicleLink[];
  private _equipment: RequestEquipmentLink[];
  private _accessPoints: RequestAccessPointLink[];
  private _accessAreas: RequestAccessAreaLink[];

  private constructor(props: RequestProps) {
    this._id = props.id;
    this._requestNumber = props.requestNumber;
    this._companyId = props.companyId;
    this._requestTypeId = props.requestTypeId;
    this._requestTypeCode = props.requestTypeCode;
    this._createdByUserId = props.createdByUserId;
    this._createdByCompanyId = props.createdByCompanyId;
    this._authorizedSignerId = props.authorizedSignerId;
    this._rejectionReasonId = props.rejectionReasonId;
    this._reason = props.reason;
    this._serviceCompanyName = props.serviceCompanyName;
    this._validFrom = props.validFrom;
    this._validUntil = props.validUntil;
    this._scheduleFrom = props.scheduleFrom;
    this._scheduleUntil = props.scheduleUntil;
    this._observations = props.observations;
    this._status = props.status;
    this._version = props.version;
    this._submittedAt = props.submittedAt;
    this._cancelledAt = props.cancelledAt;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
    this._personLinks = [...props.personLinks];
    this._vehicles = [...props.vehicles];
    this._equipment = [...props.equipment];
    this._accessPoints = [...props.accessPoints];
    this._accessAreas = [...props.accessAreas];
  }

  static create(input: NewRequestInput, id: string): Request {
    if (!input.reason || input.reason.trim().length === 0) {
      throw new ValidationError('Reason is required');
    }
    if (input.reason.length > 5000) {
      throw new ValidationError('Reason must be <= 5000 chars');
    }
    if (
      input.scheduleFrom &&
      input.scheduleUntil &&
      input.scheduleFrom > input.scheduleUntil
    ) {
      throw new ValidationError('scheduleUntil must be >= scheduleFrom');
    }
    if (
      input.validFrom &&
      input.validUntil &&
      input.validFrom > input.validUntil
    ) {
      throw new ValidationError('validUntil must be >= validFrom');
    }
    const now = new Date();
    return new Request({
      id,
      requestNumber: null,
      companyId: input.companyId,
      requestTypeId: input.requestTypeId,
      requestTypeCode: input.requestTypeCode,
      createdByUserId: input.createdByUserId,
      createdByCompanyId: input.createdByCompanyId,
      authorizedSignerId: null,
      rejectionReasonId: null,
      reason: input.reason.trim(),
      serviceCompanyName: input.serviceCompanyName ?? null,
      validFrom: input.validFrom ?? null,
      validUntil: input.validUntil ?? null,
      scheduleFrom: input.scheduleFrom ?? null,
      scheduleUntil: input.scheduleUntil ?? null,
      observations: input.observations ?? null,
      status: 'DRAFT',
      version: 1,
      submittedAt: null,
      cancelledAt: null,
      createdAt: now,
      updatedAt: now,
      personLinks: [],
      vehicles: [],
      equipment: [],
      accessPoints: [],
      accessAreas: [],
    });
  }

  static reconstitute(props: RequestProps): Request {
    return new Request(props);
  }

  get id(): string {
    return this._id;
  }
  get requestNumber(): string | null {
    return this._requestNumber;
  }
  get companyId(): string {
    return this._companyId;
  }
  get requestTypeId(): string {
    return this._requestTypeId;
  }
  get requestTypeCode(): RequestTypeCode | null {
    return this._requestTypeCode;
  }
  get createdByUserId(): string {
    return this._createdByUserId;
  }
  get createdByCompanyId(): string | null {
    return this._createdByCompanyId;
  }
  get authorizedSignerId(): string | null {
    return this._authorizedSignerId;
  }
  get rejectionReasonId(): string | null {
    return this._rejectionReasonId;
  }
  get reason(): string {
    return this._reason;
  }
  get serviceCompanyName(): string | null {
    return this._serviceCompanyName;
  }
  get validFrom(): Date | null {
    return this._validFrom;
  }
  get validUntil(): Date | null {
    return this._validUntil;
  }
  get scheduleFrom(): string | null {
    return this._scheduleFrom;
  }
  get scheduleUntil(): string | null {
    return this._scheduleUntil;
  }
  get observations(): string | null {
    return this._observations;
  }
  get status(): RequestStatus {
    return this._status;
  }
  get version(): number {
    return this._version;
  }
  get submittedAt(): Date | null {
    return this._submittedAt;
  }
  get cancelledAt(): Date | null {
    return this._cancelledAt;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }
  get personLinks(): ReadonlyArray<RequestPersonLink> {
    return this._personLinks;
  }
  get vehicles(): ReadonlyArray<RequestVehicleLink> {
    return this._vehicles;
  }
  get equipment(): ReadonlyArray<RequestEquipmentLink> {
    return this._equipment;
  }
  get accessPoints(): ReadonlyArray<RequestAccessPointLink> {
    return this._accessPoints;
  }
  get accessAreas(): ReadonlyArray<RequestAccessAreaLink> {
    return this._accessAreas;
  }

  toProps(): RequestProps {
    return {
      id: this._id,
      requestNumber: this._requestNumber,
      companyId: this._companyId,
      requestTypeId: this._requestTypeId,
      requestTypeCode: this._requestTypeCode,
      createdByUserId: this._createdByUserId,
      createdByCompanyId: this._createdByCompanyId,
      authorizedSignerId: this._authorizedSignerId,
      rejectionReasonId: this._rejectionReasonId,
      reason: this._reason,
      serviceCompanyName: this._serviceCompanyName,
      validFrom: this._validFrom,
      validUntil: this._validUntil,
      scheduleFrom: this._scheduleFrom,
      scheduleUntil: this._scheduleUntil,
      observations: this._observations,
      status: this._status,
      version: this._version,
      submittedAt: this._submittedAt,
      cancelledAt: this._cancelledAt,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
      personLinks: [...this._personLinks],
      vehicles: [...this._vehicles],
      equipment: [...this._equipment],
      accessPoints: [...this._accessPoints],
      accessAreas: [...this._accessAreas],
    };
  }

  /* ── mutations ── */

  setRequestNumber(number: string): void {
    this._requestNumber = number;
    this.touch();
  }

  assignAuthorizedSigner(signerId: string): void {
    this._authorizedSignerId = signerId;
    this.touch();
  }

  updateDetails(
    patch: Partial<
      Pick<
        RequestProps,
        | 'reason'
        | 'serviceCompanyName'
        | 'validFrom'
        | 'validUntil'
        | 'scheduleFrom'
        | 'scheduleUntil'
        | 'observations'
      >
    >,
  ): void {
    this.assertEditable();
    if (patch.reason !== undefined) {
      if (!patch.reason || patch.reason.trim().length === 0) {
        throw new ValidationError('Reason cannot be empty');
      }
      if (patch.reason.length > 5000) {
        throw new ValidationError('Reason must be <= 5000 chars');
      }
      this._reason = patch.reason.trim();
    }
    if (patch.serviceCompanyName !== undefined)
      this._serviceCompanyName = patch.serviceCompanyName;
    if (patch.validFrom !== undefined) this._validFrom = patch.validFrom;
    if (patch.validUntil !== undefined) this._validUntil = patch.validUntil;
    if (patch.scheduleFrom !== undefined)
      this._scheduleFrom = patch.scheduleFrom;
    if (patch.scheduleUntil !== undefined)
      this._scheduleUntil = patch.scheduleUntil;
    if (patch.observations !== undefined)
      this._observations = patch.observations;
    if (
      this._scheduleFrom &&
      this._scheduleUntil &&
      this._scheduleFrom > this._scheduleUntil
    ) {
      throw new ValidationError('scheduleUntil must be >= scheduleFrom');
    }
    if (
      this._validFrom &&
      this._validUntil &&
      this._validFrom > this._validUntil
    ) {
      throw new ValidationError('validUntil must be >= validFrom');
    }
    this.touch();
  }

  setRejectionReason(reasonId: string | null): void {
    this._rejectionReasonId = reasonId;
    this.touch();
  }

  applyTransition(newStatus: RequestStatus, now: Date = new Date()): void {
    if (newStatus === 'SUBMITTED') this._submittedAt = now;
    if (newStatus === 'CANCELLED') this._cancelledAt = now;
    this._status = newStatus;
    this._version += 1;
    this.touch();
  }

  /* ── child collections ── */

  addPersonLink(link: RequestPersonLink): void {
    this.assertEditable();
    if (this._personLinks.some((p) => p.personId === link.personId)) {
      throw new BusinessRuleError(
        `Person ${link.personId} already linked to this request`,
      );
    }
    this._personLinks.push(link);
    this.touch();
  }

  removePersonLink(linkId: string): void {
    this.assertEditable();
    this._personLinks = this._personLinks.filter((p) => p.id !== linkId);
    this.touch();
  }

  addVehicle(link: RequestVehicleLink): void {
    this.assertEditable();
    if (
      this._vehicles.some(
        (v) => v.plateNumber.toUpperCase() === link.plateNumber.toUpperCase(),
      )
    ) {
      throw new BusinessRuleError(
        `Vehicle with plate ${link.plateNumber} already linked`,
      );
    }
    this._vehicles.push(link);
    this.touch();
  }

  removeVehicle(linkId: string): void {
    this.assertEditable();
    this._vehicles = this._vehicles.filter((v) => v.id !== linkId);
    this.touch();
  }

  addEquipment(link: RequestEquipmentLink): void {
    this.assertEditable();
    this._equipment.push(link);
    this.touch();
  }

  removeEquipment(linkId: string): void {
    this.assertEditable();
    this._equipment = this._equipment.filter((e) => e.id !== linkId);
    this.touch();
  }

  addAccessPoint(link: RequestAccessPointLink): void {
    this.assertEditable();
    if (
      this._accessPoints.some((p) => p.accessPointId === link.accessPointId)
    ) {
      throw new BusinessRuleError(
        `Access point ${link.accessPointId} already linked`,
      );
    }
    this._accessPoints.push(link);
    this.touch();
  }

  removeAccessPoint(linkId: string): void {
    this.assertEditable();
    this._accessPoints = this._accessPoints.filter((p) => p.id !== linkId);
    this.touch();
  }

  addAccessArea(link: RequestAccessAreaLink): void {
    this.assertEditable();
    if (this._accessAreas.some((a) => a.accessAreaId === link.accessAreaId)) {
      throw new BusinessRuleError(
        `Access area ${link.accessAreaId} already linked`,
      );
    }
    this._accessAreas.push(link);
    this.touch();
  }

  removeAccessArea(linkId: string): void {
    this.assertEditable();
    this._accessAreas = this._accessAreas.filter((a) => a.id !== linkId);
    this.touch();
  }

  setAccessAreaReview(
    linkId: string,
    status: ReviewStatus,
    reviewerId: string,
    comment: string | null,
  ): void {
    const area = this._accessAreas.find((a) => a.id === linkId);
    if (!area) throw new NotFoundError('AccessAreaLink', linkId);
    area.reviewStatus = status;
    area.reviewedBy = reviewerId;
    area.reviewedAt = new Date();
    area.reviewComment = comment;
    this.touch();
  }

  /* ── internal helpers ── */

  private assertEditable(): void {
    if (!Request.isEditableStatus(this._status)) {
      throw new BusinessRuleError(
        `Request is not editable in status ${this._status}`,
      );
    }
  }

  static isEditableStatus(status: RequestStatus): boolean {
    return status === 'DRAFT' || status === 'RETURNED_FOR_CORRECTION';
  }

  private touch(): void {
    this._updatedAt = new Date();
  }
}
