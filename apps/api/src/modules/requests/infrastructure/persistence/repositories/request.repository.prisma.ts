import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../../generated/prisma/client.js';
import { PrismaService } from '../../../../../common/infrastructure/prisma/prisma.service';
import {
  ConflictError,
  NotFoundError,
} from '../../../../../common/domain/errors/domain-error';
import { Request } from '../../../domain/entities/request.entity';
import type { RequestStatus } from '../../../domain/entities/request.entity';
import {
  REQUEST_REPOSITORY,
  type RequestListFilters,
  type RequestRepositoryPort,
  type PaginatedRequests,
} from '../../../domain/repositories/request.repository.port';
import { RequestMapper } from '../mappers/request.mapper';

const REQUEST_INCLUDE = {
  requestType: { select: { id: true, code: true, name: true } },
  personLinks: true,
  vehicles: true,
  equipment: true,
  accessPoints: true,
  accessAreas: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.RequestInclude;

@Injectable()
export class RequestPrismaRepository implements RequestRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Request | null> {
    const row = await this.prisma.request.findUnique({
      where: { id },
      include: REQUEST_INCLUDE,
    });
    return row ? RequestMapper.toDomain(row) : null;
  }

  async findMany(
    filters: RequestListFilters,
    page: number,
    pageSize: number,
  ): Promise<PaginatedRequests> {
    const where: Prisma.RequestWhereInput = {};
    if (filters.companyId) where.companyId = filters.companyId;
    if (filters.createdByUserId)
      where.createdByUserId = filters.createdByUserId;
    if (filters.status) where.status = filters.status;
    if (filters.requestTypeId) where.requestTypeId = filters.requestTypeId;
    if (filters.search) {
      where.OR = [
        { requestNumber: { contains: filters.search } },
        { reason: { contains: filters.search } },
        { observations: { contains: filters.search } },
      ];
    }

    const skip = (page - 1) * pageSize;
    const [rows, total] = await Promise.all([
      this.prisma.request.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: REQUEST_INCLUDE,
      }),
      this.prisma.request.count({ where }),
    ]);

    return {
      items: rows.map((r) => RequestMapper.toDomain(r)),
      total,
      page,
      pageSize,
    };
  }

  async save(req: Request): Promise<void> {
    const props = req.toProps();
    const existing = await this.prisma.request.findUnique({
      where: { id: props.id },
      select: { version: true },
    });

    if (existing) {
      // optimistic locking
      if (existing.version !== props.version - 1 && props.status === 'DRAFT') {
        // Allow version mismatch only if the entity reported the increment already
      }
      await this.prisma.$transaction(async (tx) => {
        const updated = await tx.request.update({
          where: { id: props.id, version: props.version - 1 },
          data: RequestMapper.toPersistenceUpdate(req),
        });
        if (!updated) {
          throw new ConflictError(
            `Optimistic lock failed for request ${props.id}`,
          );
        }
        await this.syncChildren(tx, props.id, req);
      });
    } else {
      await this.prisma.$transaction(async (tx) => {
        await tx.request.create({
          data: RequestMapper.toPersistenceCreate(req),
        });
        await this.syncChildren(tx, props.id, req, true);
      });
    }
  }

  private async syncChildren(
    tx: Prisma.TransactionClient,
    requestId: string,
    req: Request,
    isCreate = false,
  ): Promise<void> {
    const props = req.toProps();

    // Person links — full replace on edit; bulk insert on create
    if (!isCreate) {
      await tx.requestPerson.deleteMany({ where: { requestId } });
      await tx.requestVehicle.deleteMany({ where: { requestId } });
      await tx.requestEquipment.deleteMany({ where: { requestId } });
      await tx.requestAccessPoint.deleteMany({ where: { requestId } });
      await tx.requestAccessArea.deleteMany({ where: { requestId } });
    }

    if (props.personLinks.length) {
      await tx.requestPerson.createMany({
        data: props.personLinks.map((p) => ({
          id: p.id,
          requestId,
          personId: p.personId,
          role: p.role,
          personalEmergency: p.personalEmergency,
          usePreviousPhoto: p.usePreviousPhoto,
          departmentSnapshot: p.departmentSnapshot,
          positionSnapshot: p.positionSnapshot,
          companyNameSnapshot: p.companyNameSnapshot,
          identificationSnapshot: p.identificationSnapshot,
          fullNameSnapshot: p.fullNameSnapshot,
          createdAt: p.createdAt,
        })),
      });
    }
    if (props.vehicles.length) {
      await tx.requestVehicle.createMany({
        data: props.vehicles.map((v) => ({
          id: v.id,
          requestId,
          brand: v.brand,
          model: v.model,
          plateNumber: v.plateNumber,
          color: v.color,
          year: v.year,
          description: v.description,
          createdAt: v.createdAt,
        })),
      });
    }
    if (props.equipment.length) {
      await tx.requestEquipment.createMany({
        data: props.equipment.map((e) => ({
          id: e.id,
          requestId,
          brand: e.brand,
          equipmentType: e.equipmentType,
          serialNumber: e.serialNumber,
          description: e.description,
          quantity: e.quantity,
          createdAt: e.createdAt,
        })),
      });
    }
    if (props.accessPoints.length) {
      await tx.requestAccessPoint.createMany({
        data: props.accessPoints.map((p) => ({
          id: p.id,
          requestId,
          accessPointId: p.accessPointId,
          createdAt: p.createdAt,
        })),
      });
    }
    if (props.accessAreas.length) {
      await tx.requestAccessArea.createMany({
        data: props.accessAreas.map((a) => ({
          id: a.id,
          requestId,
          accessAreaId: a.accessAreaId,
          justification: a.justification,
          reviewStatus: a.reviewStatus,
          reviewedBy: a.reviewedBy,
          reviewedAt: a.reviewedAt,
          reviewComment: a.reviewComment,
          createdAt: a.createdAt,
        })),
      });
    }
  }

  async delete(id: string): Promise<void> {
    const req = await this.findById(id);
    if (!req) throw new NotFoundError('Request', id);
    if (req.status !== 'DRAFT') {
      throw new ConflictError(`Cannot delete request in status ${req.status}`);
    }
    await this.prisma.request.delete({ where: { id } });
  }

  /**
   * Implementation note: We use the count of requests for a (prefix, year, companyId)
   * tuple plus 1 as the sequence. This is good enough for an MVP and avoids the need
   * for a dedicated sequence table. The transaction guarantees atomicity for number
   * assignment at submission time.
   */
  async nextSequenceNumber(prefix: string, year: number): Promise<number> {
    // Not used by the current implementation; we rely on countForNumber instead.
    return 0;
  }

  async countForNumber(
    prefix: string,
    year: number,
    companyId: string,
  ): Promise<number> {
    const yearStart = new Date(`${year}-01-01T00:00:00.000Z`);
    const yearEnd = new Date(`${year + 1}-01-01T00:00:00.000Z`);
    return this.prisma.request.count({
      where: {
        companyId,
        requestNumber: { startsWith: `${prefix}-${year}-` },
        createdAt: { gte: yearStart, lt: yearEnd },
      },
    });
  }
}

export const REQUEST_REPOSITORY_PROVIDER = {
  provide: REQUEST_REPOSITORY,
  useClass: RequestPrismaRepository,
};
