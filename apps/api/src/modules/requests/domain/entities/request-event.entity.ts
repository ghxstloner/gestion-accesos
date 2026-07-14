/**
 * Immutable record of a single transition in a Request's lifecycle.
 *
 * Spec ref: section 17. One row per state change, never updated or deleted.
 */

import type { RequestStatus } from './request.entity';

export type RequestEventRowType = string; // loose; specific values come from RequestStatePolicy

export interface RequestEventProps {
  id: string;
  requestId: string;
  eventType: string;
  fromStatus: RequestStatus | null;
  toStatus: RequestStatus;
  actorUserId: string | null;
  actorRoleCode: string | null;
  actorCompanyId: string | null;
  reasonCode: string | null;
  comment: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  correlationId: string | null;
  occurredAt: Date;
}

export interface NewRequestEventInput {
  requestId: string;
  eventType: string;
  fromStatus: RequestStatus | null;
  toStatus: RequestStatus;
  actorUserId: string | null;
  actorRoleCode: string | null;
  actorCompanyId: string | null;
  reasonCode?: string | null;
  comment?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

export class RequestEvent {
  private constructor(private readonly props: RequestEventProps) {}

  static create(input: NewRequestEventInput, id: string): RequestEvent {
    return new RequestEvent({
      id,
      requestId: input.requestId,
      eventType: input.eventType,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      actorUserId: input.actorUserId,
      actorRoleCode: input.actorRoleCode,
      actorCompanyId: input.actorCompanyId,
      reasonCode: input.reasonCode ?? null,
      comment: input.comment ?? null,
      metadata: input.metadata ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      correlationId: input.correlationId ?? null,
      occurredAt: new Date(),
    });
  }

  static reconstitute(props: RequestEventProps): RequestEvent {
    return new RequestEvent(props);
  }

  get id(): string {
    return this.props.id;
  }
  get requestId(): string {
    return this.props.requestId;
  }
  get eventType(): string {
    return this.props.eventType;
  }
  get fromStatus(): RequestStatus | null {
    return this.props.fromStatus;
  }
  get toStatus(): RequestStatus {
    return this.props.toStatus;
  }
  get actorUserId(): string | null {
    return this.props.actorUserId;
  }
  get actorRoleCode(): string | null {
    return this.props.actorRoleCode;
  }
  get actorCompanyId(): string | null {
    return this.props.actorCompanyId;
  }
  get reasonCode(): string | null {
    return this.props.reasonCode;
  }
  get comment(): string | null {
    return this.props.comment;
  }
  get metadata(): Record<string, unknown> | null {
    return this.props.metadata;
  }
  get ipAddress(): string | null {
    return this.props.ipAddress;
  }
  get userAgent(): string | null {
    return this.props.userAgent;
  }
  get correlationId(): string | null {
    return this.props.correlationId;
  }
  get occurredAt(): Date {
    return this.props.occurredAt;
  }

  toProps(): RequestEventProps {
    return {
      ...this.props,
      metadata: this.props.metadata ? { ...this.props.metadata } : null,
    };
  }
}
