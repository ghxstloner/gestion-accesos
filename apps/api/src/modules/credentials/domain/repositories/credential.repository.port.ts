export const CREDENTIAL_REPOSITORY = Symbol('CREDENTIAL_REPOSITORY');

export interface CredentialListFilters {
  status?: string;
  credentialType?: string;
  requestId?: string;
  personId?: string;
  search?: string;
}

export interface CredentialRecord {
  id: string;
  credentialNumber: string;
  requestId: string;
  credentialType: string;
  personId: string | null;
  status: string;
  issuedAt: Date | null;
  expiresAt: Date | null;
  producedAt: Date | null;
  readyAt: Date | null;
  deliveredAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CredentialEventRecord {
  id: string;
  credentialId: string;
  eventType: string;
  fromStatus: string | null;
  toStatus: string;
  actorUserId: string | null;
  comment: string | null;
  occurredAt: Date;
}

export interface DeliveryRecordInfo {
  id: string;
  credentialId: string;
  deliveredByUserId: string;
  receivedByName: string;
  receivedByIdentification: string;
  deliveredAt: Date;
  observations: string | null;
  correctedAt: Date | null;
  correctionReason: string | null;
}

export interface CredentialListPage {
  items: CredentialRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CredentialRepositoryPort {
  findById(id: string): Promise<CredentialRecord | null>;
  findByRequestId(requestId: string): Promise<CredentialRecord | null>;
  findByCredentialNumber(number: string): Promise<CredentialRecord | null>;
  list(inputs: { filters: CredentialListFilters; page: number; pageSize: number }): Promise<CredentialListPage>;
  save(record: CredentialRecord): Promise<void>;
  countByPrefixThisYear(prefix: string): Promise<number>;

  // Events
  listEvents(credentialId: string): Promise<CredentialEventRecord[]>;
  saveEvent(event: CredentialEventRecord): Promise<void>;

  // Delivery
  findDeliveryByCredential(credentialId: string): Promise<DeliveryRecordInfo | null>;
  saveDelivery(record: DeliveryRecordInfo): Promise<void>;
  markDeliveryCorrected(credentialId: string, reason: string): Promise<void>;
}
