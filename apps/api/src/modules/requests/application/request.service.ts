import { Injectable, Inject } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../common/domain/errors/domain-error';
import { canReadAcrossCompanies } from '../../../common/domain/access-scope';
import { AuthenticatedUser } from '../../../common/presentation/decorators/authenticated-user';
import { AuthorizedSignerService } from '../../authorized-signers/application/authorized-signer.service';
import { CatalogService } from '../../catalogs/application/catalog.service';
import { PersonService } from '../../people/application/person.service';
import { NotificationService } from '../../notifications/application/notification.service';
import { Request } from '../domain/entities/request.entity';
import type {
  RequestPersonLink,
  RequestVehicleLink,
  RequestEquipmentLink,
  RequestAccessPointLink,
  RequestAccessAreaLink,
  RequestPersonRole,
} from '../domain/entities/request.entity';
import { RequestEvent } from '../domain/entities/request-event.entity';
import {
  RequestStatePolicy,
  REQUEST_TRANSITIONS,
} from '../domain/request-state.policy';
import type { RequestTransition } from '../domain/request-state.policy';
import {
  REQUEST_REPOSITORY,
  type RequestRepositoryPort,
  type RequestListFilters,
} from '../domain/repositories/request.repository.port';
import {
  REQUEST_EVENT_REPOSITORY,
  type RequestEventRepositoryPort,
} from '../domain/repositories/request-event.repository.port';
import {
  REQUEST_SUBMISSION_REPOSITORY,
  type RequestSubmissionRepositoryPort,
} from '../domain/repositories/request-submission.repository.port';

export interface CreateRequestInput {
  requestTypeId: string;
  authorizedSignerId?: string | null;
  reason: string;
  serviceCompanyName?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
  scheduleFrom?: string | null;
  scheduleUntil?: string | null;
  observations?: string | null;
  personLinks?: Array<{
    personId: string;
    role: RequestPersonRole;
    personalEmergency?: boolean;
    usePreviousPhoto?: boolean;
  }>;
  vehicles?: Array<{
    brand: string;
    model: string;
    plateNumber: string;
    color?: string | null;
    year?: number | null;
    description?: string | null;
  }>;
  equipment?: Array<{
    brand?: string | null;
    equipmentType: string;
    serialNumber?: string | null;
    description?: string | null;
    quantity?: number;
  }>;
  accessPoints?: Array<{ accessPointId: string }>;
  accessAreas?: Array<{ accessAreaId: string; justification?: string | null }>;
}

export type UpdateRequestInput = Partial<CreateRequestInput>;

export interface TransitionInput {
  requestId: string;
  transition: RequestTransition;
  reasonCode?: string | null;
  comment?: string | null;
}

export interface ScopedRequestList {
  companyId?: string;
  createdByUserId?: string;
  status?: string;
  requestTypeId?: string;
  search?: string;
  page: number;
  pageSize: number;
}

@Injectable()
export class RequestService {
  constructor(
    @Inject(REQUEST_REPOSITORY)
    private readonly requests: RequestRepositoryPort,
    @Inject(REQUEST_EVENT_REPOSITORY)
    private readonly events: RequestEventRepositoryPort,
    @Inject(REQUEST_SUBMISSION_REPOSITORY)
    private readonly submissions: RequestSubmissionRepositoryPort,
    private readonly catalogService: CatalogService,
    private readonly personService: PersonService,
    private readonly authorizedSignerService: AuthorizedSignerService,
    private readonly notificationService: NotificationService,
  ) {}

  /* ── reads ── */

  async getById(actor: AuthenticatedUser, id: string): Promise<Request> {
    const req = await this.requests.findById(id);
    if (!req) throw new NotFoundError('Request', id);
    this.assertCanRead(actor, req);
    return req;
  }

  async listEvents(actor: AuthenticatedUser, requestId: string) {
    const req = await this.getById(actor, requestId);
    return this.events.listByRequest(req.id);
  }

  async list(actor: AuthenticatedUser, query: ScopedRequestList) {
    // System admin can list everything (no implicit company scope); everyone else is scoped.
    if (
      !canReadAcrossCompanies(actor.roles)
    ) {
      if (query.companyId && query.companyId !== actor.companyId) {
        throw new ForbiddenError('Cannot list requests for another company');
      }
      query.companyId = actor.companyId ?? undefined;
    }
    const filters: RequestListFilters = {
      companyId: query.companyId,
      createdByUserId: query.createdByUserId,
      status: query.status as RequestListFilters['status'],
      requestTypeId: query.requestTypeId,
      search: query.search,
    };
    return this.requests.findMany(filters, query.page, query.pageSize);
  }

  /* ── writes ── */

  async create(
    actor: AuthenticatedUser,
    input: CreateRequestInput,
  ): Promise<Request> {
    if (actor.roles.includes('SYSTEM_ADMIN')) {
      throw new ForbiddenError(
        'System admins cannot create requests on behalf of a company',
      );
    }
    if (!actor.companyId) {
      throw new ForbiddenError('User is not associated with a company');
    }

    // Validate requestType catalog item exists and is of kind REQUEST_TYPE
    const catalogItem = await this.catalogService.findById(input.requestTypeId);
    if (!catalogItem) {
      throw new ValidationError(
        `Request type ${input.requestTypeId} does not exist`,
      );
    }
    if (catalogItem.kind !== 'REQUEST_TYPE') {
      throw new ValidationError(
        `${input.requestTypeId} is not a REQUEST_TYPE catalog`,
      );
    }

    // Validate all referenced people, access points, areas exist and belong to the same company
    if (input.personLinks?.length) {
      for (const link of input.personLinks) {
        const person = await this.personService.getByIdAndCompany(
          link.personId,
          actor.companyId,
        );
        if (!person) throw new NotFoundError('Person', link.personId);
      }
    }
    if (input.accessPoints?.length) {
      await this.assertCatalogItemsOfKind(
        input.accessPoints.map((p) => p.accessPointId),
        'ACCESS_POINT',
      );
    }
    if (input.accessAreas?.length) {
      await this.assertCatalogItemsOfKind(
        input.accessAreas.map((a) => a.accessAreaId),
        'ACCESS_AREA',
      );
    }
    if (input.authorizedSignerId) {
      await this.authorizedSignerService.getActiveSignerForRequest(
        input.authorizedSignerId,
        actor.companyId,
      );
    }

    const id = randomUUID();
    const req = Request.create(
      {
        companyId: actor.companyId,
        requestTypeId: input.requestTypeId,
        requestTypeCode: catalogItem.code,
        createdByUserId: actor.userId,
        createdByCompanyId: actor.companyId,
        reason: input.reason,
        serviceCompanyName: input.serviceCompanyName ?? null,
        validFrom: input.validFrom ? new Date(input.validFrom) : null,
        validUntil: input.validUntil ? new Date(input.validUntil) : null,
        scheduleFrom: input.scheduleFrom ?? null,
        scheduleUntil: input.scheduleUntil ?? null,
        observations: input.observations ?? null,
      },
      id,
    );

    if (input.authorizedSignerId) {
      req.assignAuthorizedSigner(input.authorizedSignerId);
    }

    if (input.personLinks) {
      for (const link of input.personLinks)
        req.addPersonLink(this.makePersonLink(id, link));
    }
    if (input.vehicles) {
      for (const v of input.vehicles)
        req.addVehicle(this.makeVehicleLink(id, v));
    }
    if (input.equipment) {
      for (const e of input.equipment)
        req.addEquipment(this.makeEquipmentLink(id, e));
    }
    if (input.accessPoints) {
      for (const ap of input.accessPoints)
        req.addAccessPoint(this.makeAccessPointLink(id, ap));
    }
    if (input.accessAreas) {
      for (const aa of input.accessAreas)
        req.addAccessArea(this.makeAccessAreaLink(id, aa));
    }

    await this.requests.save(req);
    await this.recordEvent(req, 'CREATED', null, req.status, actor, null);
    return req;
  }

  async update(
    actor: AuthenticatedUser,
    id: string,
    patch: UpdateRequestInput,
  ): Promise<Request> {
    const req = await this.getById(actor, id);
    this.assertCanEdit(actor, req);
    if (!RequestStatePolicy.isEditable(req.status)) {
      throw new BusinessRuleError(
        `Request is not editable in status ${req.status}`,
      );
    }

    req.updateDetails({
      reason: patch.reason,
      serviceCompanyName: patch.serviceCompanyName,
      validFrom: patch.validFrom ? new Date(patch.validFrom) : undefined,
      validUntil: patch.validUntil ? new Date(patch.validUntil) : undefined,
      scheduleFrom: patch.scheduleFrom,
      scheduleUntil: patch.scheduleUntil,
      observations: patch.observations,
    });

    if (patch.authorizedSignerId) {
      await this.authorizedSignerService.getActiveSignerForRequest(
        patch.authorizedSignerId,
        req.companyId,
      );
      req.assignAuthorizedSigner(patch.authorizedSignerId);
    }

    if (patch.personLinks) {
      for (const link of req.personLinks) req.removePersonLink(link.id);
      for (const link of patch.personLinks)
        req.addPersonLink(this.makePersonLink(id, link));
    }
    if (patch.vehicles) {
      for (const v of req.vehicles) req.removeVehicle(v.id);
      for (const v of patch.vehicles)
        req.addVehicle(this.makeVehicleLink(id, v));
    }
    if (patch.equipment) {
      for (const e of req.equipment) req.removeEquipment(e.id);
      for (const e of patch.equipment)
        req.addEquipment(this.makeEquipmentLink(id, e));
    }
    if (patch.accessPoints) {
      for (const ap of req.accessPoints) req.removeAccessPoint(ap.id);
      for (const ap of patch.accessPoints)
        req.addAccessPoint(this.makeAccessPointLink(id, ap));
    }
    if (patch.accessAreas) {
      for (const aa of req.accessAreas) req.removeAccessArea(aa.id);
      for (const aa of patch.accessAreas)
        req.addAccessArea(this.makeAccessAreaLink(id, aa));
    }

    await this.requests.save(req);
    return req;
  }

  async delete(actor: AuthenticatedUser, id: string): Promise<void> {
    const req = await this.getById(actor, id);
    this.assertCanEdit(actor, req);
    await this.requests.delete(id);
  }

  /* ── state transitions ── */

  async transition(
    actor: AuthenticatedUser,
    input: TransitionInput,
  ): Promise<Request> {
    const req = await this.getById(actor, input.requestId);
    const fromStatus = req.status;
    const toStatus = RequestStatePolicy.assertTransition(
      fromStatus,
      input.transition,
    );

    this.assertCanTransition(actor, input.transition, req);

    if (input.transition === 'submit' || input.transition === 'resubmit') {
      if (req.personLinks.length === 0) {
        throw new BusinessRuleError(
          'Cannot submit a request with no person links',
        );
      }
      if (!req.requestNumber) {
        const year = new Date().getFullYear();
        const seq =
          (await this.requests.countForNumber('SGA', year, req.companyId)) + 1;
        req.setRequestNumber(`SGA-${year}-${String(seq).padStart(6, '0')}`);
      }
    }
    if (input.transition === 'reject') {
      if (!input.reasonCode && !input.comment) {
        throw new ValidationError(
          'Either reasonCode or comment is required to reject a request',
        );
      }
    }

    req.applyTransition(toStatus);
    await this.requests.save(req);

    // Persist a submission snapshot when the request is being submitted/resubmitted
    if (input.transition === 'submit' || input.transition === 'resubmit') {
      await this.captureSubmissionSnapshot(req, actor.userId);
    }

    const eventType = REQUEST_TRANSITIONS[input.transition].eventType;
    await this.recordEvent(req, eventType, fromStatus, toStatus, actor, {
      reasonCode: input.reasonCode ?? null,
      comment: input.comment ?? null,
    });

    // Notify the applicant on key transitions (best-effort).
    if (req.createdByUserId && req.createdByUserId !== actor.userId) {
      const props = req.toProps();
      const messages: Record<'return' | 'reject' | 'approve_final', { type: string; title: string; message: string }> = {
        return: {
          type: 'request.returned',
          title: `Solicitud ${props.requestNumber ?? req.id} devuelta`,
          message: 'Su solicitud fue devuelta para corrección.',
        },
        reject: {
          type: 'request.rejected',
          title: `Solicitud ${props.requestNumber ?? req.id} rechazada`,
          message: input.comment ?? 'Su solicitud fue rechazada.',
        },
        approve_final: {
          type: 'request.approved',
          title: `Solicitud ${props.requestNumber ?? req.id} aprobada`,
          message: 'Su solicitud fue aprobada.',
        },
      };
      const msg = messages[input.transition as keyof typeof messages];
      if (msg) {
        await this.notificationService.send({
          userId: req.createdByUserId,
          type: msg.type,
          title: msg.title,
          message: msg.message,
          entityType: 'Request',
          entityId: req.id,
        });
      }
    }

    return req;
  }

  /* ── helpers ── */

  private async assertCatalogItemsOfKind(
    ids: string[],
    kind: string,
  ): Promise<void> {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      const item = await this.catalogService.findById(id);
      if (!item) throw new NotFoundError('CatalogItem', id);
      if (item.kind !== kind) {
        throw new ValidationError(`Catalog item ${id} is not of kind ${kind}`);
      }
    }
  }

  private makePersonLink(
    requestId: string,
    input: NonNullable<CreateRequestInput['personLinks']>[number],
  ): RequestPersonLink {
    return {
      id: randomUUID(),
      requestId,
      personId: input.personId,
      role: input.role,
      personalEmergency: input.personalEmergency ?? false,
      usePreviousPhoto: input.usePreviousPhoto ?? false,
      departmentSnapshot: null,
      positionSnapshot: null,
      companyNameSnapshot: null,
      identificationSnapshot: null,
      fullNameSnapshot: null,
      createdAt: new Date(),
    };
  }

  private makeVehicleLink(
    requestId: string,
    input: NonNullable<CreateRequestInput['vehicles']>[number],
  ): RequestVehicleLink {
    return {
      id: randomUUID(),
      requestId,
      brand: input.brand,
      model: input.model,
      plateNumber: input.plateNumber,
      color: input.color ?? null,
      year: input.year ?? null,
      description: input.description ?? null,
      createdAt: new Date(),
    };
  }

  private makeEquipmentLink(
    requestId: string,
    input: NonNullable<CreateRequestInput['equipment']>[number],
  ): RequestEquipmentLink {
    return {
      id: randomUUID(),
      requestId,
      brand: input.brand ?? null,
      equipmentType: input.equipmentType,
      serialNumber: input.serialNumber ?? null,
      description: input.description ?? null,
      quantity: input.quantity ?? 1,
      createdAt: new Date(),
    };
  }

  private makeAccessPointLink(
    requestId: string,
    input: NonNullable<CreateRequestInput['accessPoints']>[number],
  ): RequestAccessPointLink {
    return {
      id: randomUUID(),
      requestId,
      accessPointId: input.accessPointId,
      createdAt: new Date(),
    };
  }

  private makeAccessAreaLink(
    requestId: string,
    input: NonNullable<CreateRequestInput['accessAreas']>[number],
  ): RequestAccessAreaLink {
    return {
      id: randomUUID(),
      requestId,
      accessAreaId: input.accessAreaId,
      justification: input.justification ?? null,
      reviewStatus: 'PENDING',
      reviewedBy: null,
      reviewedAt: null,
      reviewComment: null,
      createdAt: new Date(),
    };
  }

  private async recordEvent(
    req: Request,
    eventType: string,
    fromStatus: Request['status'] | null,
    toStatus: Request['status'],
    actor: AuthenticatedUser,
    extra: { reasonCode?: string | null; comment?: string | null } | null,
  ): Promise<void> {
    const event = RequestEvent.create(
      {
        requestId: req.id,
        eventType,
        fromStatus,
        toStatus,
        actorUserId: actor.userId,
        actorRoleCode: actor.roles[0] ?? null,
        actorCompanyId: actor.companyId ?? null,
        reasonCode: extra?.reasonCode ?? null,
        comment: extra?.comment ?? null,
      },
      randomUUID(),
    );
    await this.events.create(event);
  }

  private async captureSubmissionSnapshot(req: Request, actorUserId: string): Promise<void> {
    const props = req.toProps();
    const previous = await this.submissions.listByRequest(req.id);
    const last = previous[previous.length - 1] ?? null;
    const payload = {
      requestNumber: props.requestNumber,
      status: props.status,
      reason: props.reason,
      serviceCompanyName: props.serviceCompanyName,
      validFrom: props.validFrom ? props.validFrom.toISOString() : null,
      validUntil: props.validUntil ? props.validUntil.toISOString() : null,
      scheduleFrom: props.scheduleFrom,
      scheduleUntil: props.scheduleUntil,
      observations: props.observations,
      personLinks: props.personLinks.map((p) => ({ personId: p.personId, role: p.role })),
      vehicles: props.vehicles.map((v) => ({ plateNumber: v.plateNumber, brand: v.brand, model: v.model })),
      equipment: props.equipment.map((e) => ({ equipmentType: e.equipmentType, quantity: e.quantity })),
      accessPoints: props.accessPoints.map((a) => ({ accessPointId: a.accessPointId })),
      accessAreas: props.accessAreas.map((a) => ({ accessAreaId: a.accessAreaId, justification: a.justification })),
    };
    // Local hash function to avoid importing the persistence layer from application.
    const json = JSON.stringify(payload, Object.keys(payload).sort());
    const crypto = await import('node:crypto');
    const snapshotHash = crypto.createHash('sha256').update(json).digest('hex');
    await this.submissions.create({
      requestId: req.id,
      submittedBy: actorUserId,
      snapshotJson: payload,
      snapshotHash,
      previousSubmissionId: last ? last.id : null,
    });
  }

  /* ── authorization helpers ── */

  private assertCanRead(actor: AuthenticatedUser, req: Request): void {
    if (canReadAcrossCompanies(actor.roles)) return;
    if (req.companyId !== actor.companyId) {
      throw new ForbiddenError('Cannot access request from another company');
    }
  }

  private assertCanEdit(actor: AuthenticatedUser, req: Request): void {
    if (actor.roles.includes('SYSTEM_ADMIN')) return;
    if (req.companyId !== actor.companyId) {
      throw new ForbiddenError('Cannot modify request from another company');
    }
    const isCreator = req.createdByUserId === actor.userId;
    const isCompanyAdmin = actor.roles.includes('COMPANY_ADMIN');
    if (!isCreator && !isCompanyAdmin) {
      throw new ForbiddenError(
        'Only the creator or a company admin can modify this request',
      );
    }
  }

  private assertCanTransition(
    actor: AuthenticatedUser,
    transition: RequestTransition,
    req: Request,
  ): void {
    if (actor.roles.includes('SYSTEM_ADMIN')) return;
    if (req.companyId !== actor.companyId) {
      throw new ForbiddenError(
        'Cannot transition request from another company',
      );
    }

    if (actor.roles.includes('COMPANY_ADMIN')) return;

    const applicantTransitions: RequestTransition[] = [
      'submit',
      'resubmit',
      'cancel',
    ];
    if (applicantTransitions.includes(transition)) {
      if (req.createdByUserId !== actor.userId) {
        throw new ForbiddenError(
          `Only the creator can ${transition} this request`,
        );
      }
      return;
    }

    const reviewerRoles = [
      'DOCUMENT_RECEIVER',
      'ACCESS_DOCUMENTS_MANAGER',
      'CARD_ISSUER',
    ];
    const hasReviewerRole = actor.roles.some((r) => reviewerRoles.includes(r));
    if (!hasReviewerRole) {
      throw new ForbiddenError(
        `Your role cannot perform the ${transition} transition`,
      );
    }
  }
}
