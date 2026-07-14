/**
 * Stable catalog seed definitions — single source of truth for the seed runner
 * AND the catalog validator in the domain layer. Codes here are part of the
 * BUSINESS CONTRACT and must NEVER be renamed.
 */

export type CatalogKindCode =
  | 'REQUEST_TYPE'
  | 'IDENTIFICATION_TYPE'
  | 'DOCUMENT_TYPE'
  | 'ACCESS_POINT'
  | 'SECURITY_ZONE'
  | 'ACCESS_AREA'
  | 'REJECTION_REASON';

export interface CatalogSeedEntry {
  code: string;
  name: string;
  description?: string;
  /** Optional parent binding — e.g. an ACCESS_AREA's zone code (ROJA, AZUL...). */
  parentZoneCode?: string;
  metadata?: Record<string, unknown>;
}

export interface CatalogSeedGroup {
  kind: CatalogKindCode;
  entries: CatalogSeedEntry[];
}

const t = (
  code: string,
  name: string,
  extras: Partial<CatalogSeedEntry> = {},
): CatalogSeedEntry => ({ code, name, ...extras });

export const CATALOG_SEEDS: CatalogSeedGroup[] = [
  {
    kind: 'REQUEST_TYPE',
    entries: [
      t('PERMANENT_CARD', 'Carné permanente', {
        description: 'Carné permanente para personal',
      }),
      t('TEMPORARY_PERSON', 'Permiso temporal para persona', {
        description: 'Acceso temporal de persona',
      }),
      t('TEMPORARY_VEHICLE', 'Permiso temporal para vehículo', {
        description: 'Acceso temporal de vehículo',
      }),
      t('TEMPORARY_EQUIPMENT', 'Permiso temporal para herramienta o equipo', {
        description: 'Acceso temporal de herramienta/equipo',
      }),
    ],
  },
  {
    kind: 'IDENTIFICATION_TYPE',
    entries: [
      t('CEDULA', 'Cédula'),
      t('PASAPORTE', 'Pasaporte'),
      t('RUC', 'RUC'),
      t('CARNET_EXTRANJERIA', 'Carnet de extranjería'),
    ],
  },
  {
    kind: 'DOCUMENT_TYPE',
    entries: [
      t('CEDULA', 'Cédula o pasaporte'),
      t('FOTO', 'Fotografía'),
      t('CARTA_TRABAJO', 'Carta de trabajo'),
      t('PAZ_SALVO', 'Paz y salvo'),
      t('CERT_EMPRESA', 'Certificación de la empresa'),
      t('AUTORIZACION', 'Documento de autorización'),
      t('DOC_VEHICULO', 'Documento del vehículo'),
      t('LISTADO_EQUIPOS', 'Listado de herramientas o equipos'),
    ],
  },
  {
    kind: 'ACCESS_POINT',
    entries: [
      t('EMP_T1T2', 'Puerta de empleados T1–T2'),
      t('FOOD_COURT', 'Food Court'),
      t('PORTON_1', 'Portón No. 1'),
      t('PORTON_2', 'Portón No. 2'),
      t('PORTON_3', 'Portón No. 3'),
      t('PORTON_8', 'Portón No. 8'),
      t('PORTON_9', 'Portón No. 9'),
      t('PORTON_10', 'Portón No. 10'),
      t('PORTON_11', 'Portón No. 11'),
      t('PORTON_12', 'Portón No. 12'),
      t('PORTON_13', 'Portón No. 13'),
      t('PORTON_14', 'Portón No. 14'),
      t('PORTON_15', 'Portón No. 15'),
      t('EDIF_CARGA', 'Edificio de carga'),
    ],
  },
  {
    kind: 'SECURITY_ZONE',
    entries: [
      t('ROJA', 'Roja', { description: 'Zona de seguridad crítica' }),
      t('NARANJA', 'Naranja'),
      t('AZUL', 'Azul'),
      t('AMARILLA', 'Amarilla'),
      t('VERDE', 'Verde'),
      t('BLANCA', 'Blanca'),
      t('CELESTE', 'Celeste'),
    ],
  },
  {
    kind: 'ACCESS_AREA',
    entries: [
      t('ROJA-A', 'Plataforma', { parentZoneCode: 'ROJA' }),
      t('ROJA-B', 'Calle de rodaje', { parentZoneCode: 'ROJA' }),
      t('ROJA-C', 'Pista', { parentZoneCode: 'ROJA' }),
      t('NARANJA-A', 'Puente de abordaje', { parentZoneCode: 'NARANJA' }),
      t('NARANJA-B', 'SATE / Hipódromo', { parentZoneCode: 'NARANJA' }),
      t('VERDE-A', 'Plataforma', { parentZoneCode: 'VERDE' }),
      t('VERDE-B', 'Calle de rodaje', { parentZoneCode: 'VERDE' }),
      t('VERDE-C', 'Pista', { parentZoneCode: 'VERDE' }),
      t('AZUL-A', 'Aduana', { parentZoneCode: 'AZUL' }),
      t('AZUL-B', 'Migración', { parentZoneCode: 'AZUL' }),
      t('AMARILLA-A', 'Zona internacional', { parentZoneCode: 'AMARILLA' }),
      t('AMARILLA-B', 'Salas de preembarque', { parentZoneCode: 'AMARILLA' }),
      t('BLANCA-T1', 'Terminal 1', { parentZoneCode: 'BLANCA' }),
      t('BLANCA-T2', 'Terminal 2', { parentZoneCode: 'BLANCA' }),
      t('BLANCA-TC', 'Terminal de carga', { parentZoneCode: 'BLANCA' }),
      t('BLANCA-APC', 'Área pública controlada', { parentZoneCode: 'BLANCA' }),
      t('CELESTE-ADM', 'Administrativo', { parentZoneCode: 'CELESTE' }),
    ],
  },
  {
    kind: 'REJECTION_REASON',
    entries: [
      t('DOC_INCOMPLETO', 'Documentación incompleta'),
      t('DOC_ILEGIBLE', 'Documento ilegible'),
      t('DOC_VENCIDO', 'Documento vencido'),
      t('INFO_INCONSISTENTE', 'Información inconsistente'),
      t('FIRMA_NO_AUTH', 'Firma no autorizada'),
      t('ZONA_NO_AUTH', 'Zona no autorizada'),
      t('NO_REQUISITOS', 'No cumple requisitos'),
      t('OTRO', 'Otro'),
    ],
  },
];

/** Setter-friendly set of codes per kind (used by the domain entity for validates). */
export const CATALOG_CODES_BY_KIND: Record<CatalogKindCode, readonly string[]> =
  Object.fromEntries(
    CATALOG_SEEDS.map((g) => [g.kind, g.entries.map((e) => e.code)]),
  ) as unknown as Record<CatalogKindCode, readonly string[]>;
