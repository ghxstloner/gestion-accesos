export type ID = string;

export type Role =
  | 'ADMIN_GENERAL'
  | 'ADMIN_EMPRESA'
  | 'SOLICITANTE'
  | 'REVISOR'
  | 'JEFE_DOCUMENTOS'
  | 'EMISOR_CARNE';

export type EntityStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED';

export type RequestStatus =
  | 'BORRADOR'
  | 'ENVIADA'
  | 'EN_REVISION_DOCUMENTAL'
  | 'DEVUELTA_PARA_CORRECCION'
  | 'DOCUMENTOS_APROBADOS'
  | 'PENDIENTE_APROBACION'
  | 'APROBADA'
  | 'RECHAZADA'
  | 'EN_CONFECCION'
  | 'LISTA_PARA_ENTREGA'
  | 'ENTREGADA'
  | 'CANCELADA';

export type RequestType =
  | 'CARNE_PERMANENTE'
  | 'PERMISO_PERSONA'
  | 'PERMISO_VEHICULO'
  | 'PERMISO_HERRAMIENTA';

export type IdType =
  | 'CEDULA'
  | 'PASAPORTE'
  | 'RUC'
  | 'CARNET_EXTRANJERIA';

export type Gender = 'MASCULINO' | 'FEMENINO' | 'OTRO';

export type CivilStatus =
  | 'SOLTERO'
  | 'CASADO'
  | 'DIVORCIADO'
  | 'VIUDO'
  | 'UNION_LIBRE';

export type BloodType =
  | 'A+'
  | 'A-'
  | 'B+'
  | 'B-'
  | 'AB+'
  | 'AB-'
  | 'O+'
  | 'O-';

export type ZoneColor =
  | 'ROJA'
  | 'NARANJA'
  | 'AZUL'
  | 'AMARILLA'
  | 'VERDE'
  | 'BLANCA'
  | 'CELESTE';

export interface Company {
  id: ID;
  legalName: string;
  tradeName: string;
  taxId: string;
  email: string;
  phone: string;
  address: string;
  logoUrl?: string;
  primaryContact: string;
  status: EntityStatus;
  createdAt: string;
}

export interface User {
  id: ID;
  firstName: string;
  lastName: string;
  email: string;
  companyId: ID;
  role: Role;
  status: EntityStatus;
  lastAccess: string | null;
  createdAt: string;
}

export interface Person {
  id: ID;
  firstName: string;
  middleName?: string;
  firstLastName: string;
  secondLastName?: string;
  marriedLastName?: string;
  idType: IdType;
  idNumber: string;
  socialSecurityNumber?: string;
  birthDate: string;
  gender: Gender;
  civilStatus: CivilStatus;
  nationality: string;
  bloodType?: BloodType;
  phone: string;
  mobile: string;
  email: string;
  address: string;
  physicalAilment?: string;
  companyId: ID;
  department: string;
  position: string;
  yearsOfService: number;
  workedAtAirportBefore: boolean;
  previousCompany?: string;
  hadPreviousCard: boolean;
  reusePhoto: boolean;
  status: EntityStatus;
  createdAt: string;
}

export interface AuthorizedSigner {
  id: ID;
  companyId: ID;
  personId: ID;
  position: string;
  startDate: string;
  endDate: string;
  status: EntityStatus;
  documentName?: string;
  signatureName?: string;
  createdAt: string;
}

export interface Vehicle {
  id: ID;
  make: string;
  model: string;
  plate: string;
  color: string;
  year: number;
  description?: string;
}

export interface Tool {
  id: ID;
  make: string;
  type: string;
  serialNumber: string;
  description?: string;
  quantity: number;
}

export interface AccessZoneSelection {
  zoneColor: ZoneColor;
  areaCode: string;
  areaName: string;
  justification: string;
}

export interface DocumentItem {
  id: ID;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  status: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';
  observation?: string;
  requestId?: ID;
}

export interface RequestHistoryEvent {
  id: ID;
  status: RequestStatus;
  action: string;
  actor: string;
  actorRole: Role;
  comment?: string;
  timestamp: string;
}

export interface AccessRequest {
  id: ID;
  number: string;
  type: RequestType;
  companyId: ID;
  signerId?: ID;
  reason: string;
  serviceCompany?: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  observations?: string;
  personIds: ID[];
  primaryPersonId?: ID;
  personExtras?: Record<ID, {
    department?: string;
    position?: string;
    yearsOfService?: number;
    reusePhoto?: boolean;
    emergencyPersonnel?: boolean;
    observations?: string;
  }>;
  vehicles: Vehicle[];
  tools: Tool[];
  accessPoints: string[];
  zones: AccessZoneSelection[];
  documents: DocumentItem[];
  status: RequestStatus;
  assignedTo?: ID;
  createdBy: ID;
  createdAt: string;
  updatedAt: string;
  history: RequestHistoryEvent[];
  issuance?: {
    startedAt?: string;
    readyAt?: string;
    /** Credential (carné) number, generated once when `markReady` runs. */
    cardNumber?: string;
    deliveredAt?: string;
    receivedBy?: string;
    deliveryObservation?: string;
    /** User id of the último actor that touched the issuance flow. */
    actedBy?: ID;
  };
}

export interface Notification {
  id: ID;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'danger';
  read: boolean;
  createdAt: string;
}

export interface ActivityEvent {
  id: ID;
  action: string;
  entity: string;
  entityId: ID;
  actor: string;
  timestamp: string;
}

export interface CatalogEntry {
  id: ID;
  label: string;
  code: string;
  description?: string;
  active: boolean;
  /** Used by accessAreas entries to bind them to a security zone color. */
  zoneColor?: ZoneColor;
}

export interface Catalogs {
  requestTypes: CatalogEntry[];
  idTypes: CatalogEntry[];
  documentTypes: CatalogEntry[];
  accessPoints: CatalogEntry[];
  securityZones: CatalogEntry[];
  accessAreas: CatalogEntry[];
  rejectionReasons: CatalogEntry[];
}

export interface CurrentUser {
  userId: ID;
  role: Role;
}
