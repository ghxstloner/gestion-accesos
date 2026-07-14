import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../../../generated/prisma/client';
import { PrismaService } from '../../../../../common/infrastructure/prisma/prisma.service';
import { RequestEvent } from '../../../domain/entities/request-event.entity';
import type { RequestEventProps } from '../../../domain/entities/request-event.entity';
import {
  REQUEST_EVENT_REPOSITORY,
  type RequestEventRepositoryPort,
} from '../../../domain/repositories/request-event.repository.port';

// Loose casts for Prisma enums — domain values are validated by RequestStatePolicy.
type PrismaEventType = Prisma.RequestEventCreateInput['eventType'];
type PrismaRequestStatus = Prisma.RequestEventCreateInput['toStatus'];

@Injectable()
export class RequestEventPrismaRepository implements RequestEventRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(event: RequestEvent): Promise<void> {
    const props = event.toProps();
    const data: Prisma.RequestEventUncheckedCreateInput = {
      id: props.id,
      requestId: props.requestId,
      eventType: props.eventType as PrismaEventType,
      fromStatus: props.fromStatus,
      toStatus: props.toStatus,
      actorUserId: props.actorUserId,
      actorRoleCode: props.actorRoleCode,
      actorCompanyId: props.actorCompanyId,
      reasonCode: props.reasonCode,
      comment: props.comment,
      metadata: (props.metadata as Prisma.InputJsonValue) ?? undefined,
      ipAddress: props.ipAddress,
      userAgent: props.userAgent,
      correlationId: props.correlationId,
    };
    await this.prisma.requestEvent.create({ data });
  }

  async listByRequest(requestId: string): Promise<RequestEvent[]> {
    const rows = await this.prisma.requestEvent.findMany({
      where: { requestId },
      orderBy: { occurredAt: 'asc' },
    });
    return rows.map((row) => {
      const props: RequestEventProps = {
        id: row.id,
        requestId: row.requestId,
        eventType: row.eventType,
        fromStatus: row.fromStatus,
        toStatus: row.toStatus,
        actorUserId: row.actorUserId,
        actorRoleCode: row.actorRoleCode,
        actorCompanyId: row.actorCompanyId,
        reasonCode: row.reasonCode,
        comment: row.comment,
        metadata: (row.metadata as Record<string, unknown> | null) ?? null,
        ipAddress: row.ipAddress,
        userAgent: row.userAgent,
        correlationId: row.correlationId,
        occurredAt: row.occurredAt,
      };
      return RequestEvent.reconstitute(props);
    });
  }
}

export const REQUEST_EVENT_REPOSITORY_PROVIDER = {
  provide: REQUEST_EVENT_REPOSITORY,
  useClass: RequestEventPrismaRepository,
};
