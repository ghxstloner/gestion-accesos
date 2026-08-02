export const CREDENTIAL_REPOSITORY = Symbol('CREDENTIAL_REPOSITORY');

export interface CredentialListFilters {
  status?: string;
  credentialType?: string;
  requestId?: string;
  subjectUserId?: string;
  cardCode?: string;
  credentialNumber?: string;
  search?: string;
}

export interface CredentialRecord {
  id: string;
  credentialNumber: string;
  cardCode: string | null;
  requestId: string;
  credentialType: string;
  subjectUserId: string | null;
  holderName: string | null;
  authorizedZones: string[] | null;
  status: string;
  issuedAt: Date | null;
  expiresAt: Date | null;
  producedAt: Date | null;
  readyAt: Date | null;
  deliveredAt: Date | null;
  observations: string | null;
  photoFileId: string | null;
  photoSource: string | null;
  photoCapturedAt: Date | null;
  photoReusedFromCredentialId: string | null;
  cardMaterialData: string | null;
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

export interface CustodyRecordInfo {
  id: string;
  credentialId: string;
  subjectUserId: string;
  holderName: string | null;
  documentType: string;
  documentIdentifier: string;
  temporaryPermitRef: string | null;
  receivedByUserId: string;
  depositTime: Date;
  expectedReturnAt: Date | null;
  depositNotes: string | null;
  returnTime: Date | null;
  returnedByUserId: string | null;
  returnReceivedBy: string | null;
  returnCondition: string | null;
  returnNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustodyListFilters {
  status?: 'ACTIVE' | 'RETURNED' | 'OVERDUE';
  subjectUserId?: string;
  search?: string;
}

export interface FileMetadataRecord {
  id: string;
  storageKey: string;
  originalFilename: string;
  storedFilename: string;
  mimeType: string;
  size: number;
  sha256: string;
  createdAt: Date;
}

export interface CredentialRepositoryPort {
  findById(id: string): Promise<CredentialRecord | null>;
  findByRequestId(requestId: string): Promise<CredentialRecord | null>;
  findByCredentialNumber(number: string): Promise<CredentialRecord | null>;
  findActiveByCardCode(cardCode: string): Promise<CredentialRecord | null>;
  findLatestWithPhotoForSubject(
    subjectUserId: string,
  ): Promise<CredentialRecord | null>;
  list(inputs: {
    filters: CredentialListFilters;
    page: number;
    pageSize: number;
  }): Promise<CredentialListPage>;
  save(record: CredentialRecord): Promise<void>;
  countByPrefixThisYear(prefix: string): Promise<number>;

  // Events
  listEvents(credentialId: string): Promise<CredentialEventRecord[]>;
  saveEvent(event: CredentialEventRecord): Promise<void>;

  // Delivery
  findDeliveryByCredential(
    credentialId: string,
  ): Promise<DeliveryRecordInfo | null>;
  saveDelivery(record: DeliveryRecordInfo): Promise<void>;
  markDeliveryCorrected(credentialId: string, reason: string): Promise<void>;

  // Custody
  findCustody(id: string): Promise<CustodyRecordInfo | null>;
  findCustodyByCredential(
    credentialId: string,
  ): Promise<CustodyRecordInfo | null>;
  listCustody(inputs: {
    filters: CustodyListFilters;
    page: number;
    pageSize: number;
  }): Promise<{ items: CustodyRecordInfo[]; total: number }>;
  saveCustody(record: CustodyRecordInfo): Promise<void>;

  // File metadata helpers used by photo capture/reuse flows.
  saveFileMetadata(record: FileMetadataRecord): Promise<void>;
  findFileMetadata(id: string): Promise<FileMetadataRecord | null>;
}
