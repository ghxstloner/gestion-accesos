'use client';

import { useMemo } from 'react';
import { useCatalogsQuery, type CatalogItemResponse } from '@/hooks/api-hooks';
import type { CatalogEntry, Catalogs, ZoneColor } from '@/lib/types';

const CATALOG_KIND: Record<keyof Catalogs, string> = {
  requestTypes: 'REQUEST_TYPE',
  idTypes: 'IDENTIFICATION_TYPE',
  documentTypes: 'DOCUMENT_TYPE',
  accessPoints: 'ACCESS_POINT',
  securityZones: 'SECURITY_ZONE',
  accessAreas: 'ACCESS_AREA',
  rejectionReasons: 'REJECTION_REASON',
};

function toCatalogEntry(row: CatalogItemResponse): CatalogEntry {
  return {
    id: row.id,
    label: row.name,
    code: row.code,
    description: row.description ?? undefined,
    active: row.isActive,
    zoneColor: row.parentZoneCode as ZoneColor | undefined,
  };
}

export function useActiveCatalog<K extends keyof Catalogs>(key: K): CatalogEntry[] {
  const { data = [] } = useCatalogsQuery(CATALOG_KIND[key]);
  return useMemo(() => data.filter((row) => row.isActive).map(toCatalogEntry), [data]);
}

export const useActiveRequestTypes = () => useActiveCatalog('requestTypes');
export const useActiveIdTypes = () => useActiveCatalog('idTypes');
export const useActiveDocumentTypes = () => useActiveCatalog('documentTypes');
export const useActiveAccessPoints = () => useActiveCatalog('accessPoints');
export const useActiveSecurityZones = () => useActiveCatalog('securityZones');
export const useActiveAccessAreas = () => useActiveCatalog('accessAreas');
export const useActiveRejectionReasons = () => useActiveCatalog('rejectionReasons');

export interface ZoneGroup {
  zoneColor: ZoneColor;
  areas: { id: string; code: string; name: string }[];
}

export function useZonesWithAreas(): ZoneGroup[] {
  const zones = useActiveSecurityZones();
  const areas = useActiveAccessAreas();
  return useMemo(
    () =>
      zones
        .map((zone) => ({
          zoneColor: zone.code as ZoneColor,
          areas: areas
            .filter((area) => area.zoneColor === zone.code)
            .map((area) => ({
              id: area.id,
              code: area.code.split('-').slice(1).join('-') || area.code,
              name: area.label,
            })),
        }))
        .filter((group) => group.areas.length > 0),
    [areas, zones],
  );
}

export function useActiveCatalogLabels<K extends keyof Catalogs>(key: K): string[] {
  return useActiveCatalog(key).map((entry) => entry.label);
}
