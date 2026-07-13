import type {
  Role,
  RequestStatus,
  RequestType,
  ZoneColor,
  EntityStatus,
} from './types';

export const ROLES: Record<Role, { label: string; short: string }> = {
  ADMIN_GENERAL: { label: 'Administrador general', short: 'Admin' },
  ADMIN_EMPRESA: { label: 'Administrador de empresa', short: 'Admin empresa' },
  SOLICITANTE: { label: 'Solicitante / Colaborador', short: 'Solicitante' },
  REVISOR: { label: 'Receptor de documentos', short: 'Revisor' },
  JEFE_DOCUMENTOS: { label: 'Jefe de documentos de acceso', short: 'Jefe docs' },
  EMISOR_CARNE: { label: 'Emisor de carné', short: 'Emisor' },
};

export const ROLE_LIST = Object.entries(ROLES).map(([key, val]) => ({
  value: key as Role,
  label: val.label,
}));

export const REQUEST_STATUS_META: Record<
  RequestStatus,
  { label: string; tone: 'neutral' | 'info' | 'warning' | 'success' | 'danger' | 'brand' }
> = {
  BORRADOR: { label: 'Borrador', tone: 'neutral' },
  ENVIADA: { label: 'Enviada', tone: 'info' },
  EN_REVISION_DOCUMENTAL: { label: 'En revisión documental', tone: 'warning' },
  DEVUELTA_PARA_CORRECCION: { label: 'Devuelta para corrección', tone: 'warning' },
  DOCUMENTOS_APROBADOS: { label: 'Documentos aprobados', tone: 'info' },
  PENDIENTE_APROBACION: { label: 'Pendiente de aprobación', tone: 'warning' },
  APROBADA: { label: 'Aprobada', tone: 'success' },
  RECHAZADA: { label: 'Rechazada', tone: 'danger' },
  EN_CONFECCION: { label: 'En confección', tone: 'brand' },
  LISTA_PARA_ENTREGA: { label: 'Lista para entrega', tone: 'info' },
  ENTREGADA: { label: 'Entregada', tone: 'success' },
  CANCELADA: { label: 'Cancelada', tone: 'neutral' },
};

export const REQUEST_TYPE_META: Record<
  RequestType,
  { label: string; short: string; icon: string }
> = {
  CARNE_PERMANENTE: { label: 'Carné permanente', short: 'Carné', icon: 'id-card' },
  PERMISO_PERSONA: { label: 'Permiso temporal para persona', short: 'Persona', icon: 'user' },
  PERMISO_VEHICULO: { label: 'Permiso temporal para vehículo', short: 'Vehículo', icon: 'car' },
  PERMISO_HERRAMIENTA: { label: 'Permiso temporal para herramienta o equipo', short: 'Equipo', icon: 'wrench' },
};

export const ENTITY_STATUS_META: Record<
  EntityStatus,
  { label: string; tone: 'success' | 'neutral' | 'danger' }
> = {
  ACTIVE: { label: 'Activo', tone: 'success' },
  INACTIVE: { label: 'Inactivo', tone: 'neutral' },
  BLOCKED: { label: 'Bloqueado', tone: 'danger' },
};

export const ZONE_COLOR_META: Record<
  ZoneColor,
  { label: string; hex: string; soft: string }
> = {
  ROJA: { label: 'Roja', hex: '#D92D20', soft: '#FEECEB' },
  NARANJA: { label: 'Naranja', hex: '#E7A008', soft: '#FFF7DC' },
  AZUL: { label: 'Azul', hex: '#155EEF', soft: '#E7F0FF' },
  AMARILLA: { label: 'Amarilla', hex: '#F2C94C', soft: '#FEF6D7' },
  VERDE: { label: 'Verde', hex: '#17A673', soft: '#E9F8F2' },
  BLANCA: { label: 'Blanca', hex: '#667085', soft: '#F1F4F8' },
  CELESTE: { label: 'Celeste', hex: '#38BDF8', soft: '#E0F4FE' },
};

export const SECURITY_ZONES: {
  color: ZoneColor;
  areas: { code: string; name: string }[];
}[] = [
  {
    color: 'ROJA',
    areas: [
      { code: 'A', name: 'Plataforma' },
      { code: 'B', name: 'Calle de rodaje' },
      { code: 'C', name: 'Pista' },
    ],
  },
  {
    color: 'NARANJA',
    areas: [
      { code: 'A', name: 'Puente de abordaje' },
      { code: 'B', name: 'SATE / Hipódromo' },
    ],
  },
  {
    color: 'AZUL',
    areas: [
      { code: 'A', name: 'Aduana' },
      { code: 'B', name: 'Migración' },
    ],
  },
  {
    color: 'AMARILLA',
    areas: [
      { code: 'A', name: 'Zona internacional' },
      { code: 'B', name: 'Salas de preembarque' },
    ],
  },
  {
    color: 'VERDE',
    areas: [
      { code: 'A', name: 'Plataforma' },
      { code: 'B', name: 'Calle de rodaje' },
      { code: 'C', name: 'Pista' },
    ],
  },
  {
    color: 'BLANCA',
    areas: [
      { code: 'T1', name: 'Terminal 1' },
      { code: 'T2', name: 'Terminal 2' },
      { code: 'TC', name: 'Terminal de carga' },
      { code: 'APC', name: 'Área pública controlada' },
    ],
  },
  {
    color: 'CELESTE',
    areas: [{ code: 'ADM', name: 'Administrativo' }],
  },
];

export const ACCESS_POINTS = [
  'Puerta de empleados T1–T2',
  'Food Court',
  'Portón No. 1',
  'Portón No. 2',
  'Portón No. 3',
  'Portón No. 8',
  'Portón No. 9',
  'Portón No. 10',
  'Portón No. 11',
  'Portón No. 12',
  'Portón No. 13',
  'Portón No. 14',
  'Portón No. 15',
  'Edificio de carga',
];

export const DOCUMENT_TYPES = [
  'Cédula o pasaporte',
  'Fotografía',
  'Carta de trabajo',
  'Paz y salvo',
  'Certificación de la empresa',
  'Documento de autorización',
  'Documento del vehículo',
  'Listado de herramientas o equipos',
];

export const REJECTION_REASONS = [
  'Documentación incompleta',
  'Documento ilegible',
  'Documento vencido',
  'Información inconsistente',
  'Firma no autorizada',
  'Zona no autorizada',
  'No cumple requisitos',
  'Otro',
];

export const ID_TYPES = [
  { value: 'CEDULA', label: 'Cédula' },
  { value: 'PASAPORTE', label: 'Pasaporte' },
  { value: 'RUC', label: 'RUC' },
  { value: 'CARNET_EXTRANJERIA', label: 'Carnet de extranjería' },
];

export const GENDERS = [
  { value: 'MASCULINO', label: 'Masculino' },
  { value: 'FEMENINO', label: 'Femenino' },
  { value: 'OTRO', label: 'Otro' },
];

export const CIVIL_STATUSES = [
  { value: 'SOLTERO', label: 'Soltero(a)' },
  { value: 'CASADO', label: 'Casado(a)' },
  { value: 'DIVORCIADO', label: 'Divorciado(a)' },
  { value: 'VIUDO', label: 'Viudo(a)' },
  { value: 'UNION_LIBRE', label: 'Unión libre' },
];

export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export const NATIONALITIES = [
  'Panameña',
  'Colombiana',
  'Estadounidense',
  'Mexicana',
  'Venezolana',
  'Costarricense',
  'Argentina',
  'Brasileña',
  'Española',
];

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-PA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-PA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function calcAge(birthDate: string): number | null {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}

export function genId(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export function genRequestNumber(seq: number): string {
  const year = new Date().getFullYear();
  return `SGA-${year}-${String(seq).padStart(6, '0')}`;
}
