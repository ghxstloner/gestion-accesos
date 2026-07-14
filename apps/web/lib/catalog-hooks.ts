'use client';

import { useMemo } from 'react';
import { useSgaStore } from '@/lib/store';
import type { CatalogEntry, Catalogs, ZoneColor } from '@/lib/types';

/**
 * Live catalog helpers — read from the Zustand store so that admin edits
 * made at `/catalogs` (CRUD activate/deactivate) propagate to the wizard,
 * filters, badges, review inbox and issuance UI reactively.
 *
 * The static arrays in `lib/constants.ts` (REQUEST_TYPES etc.) are kept as
 * immutable fallbacks; in active UIs prefer the hooks here so user-edited
 * catalogs actually drive the components.
 */

/** All catalog entries for a given key, filtered to `active`. */
export function useActiveCatalog<K extends keyof Catalogs>(key: K): CatalogEntry[] {
  return useSgaStore(
    (s) => s.catalogs[key]
  ).filter((e) => e.active);
}

/** Convenience tuple hooks for the wizard/forms. */
export const useActiveRequestTypes = () => useActiveCatalog('requestTypes');
export const useActiveIdTypes = () => useActiveCatalog('idTypes');
export const useActiveDocumentTypes = () => useActiveCatalog('documentTypes');
export const useActiveAccessPoints = () => useActiveCatalog('accessPoints');
export const useActiveSecurityZones = () => useActiveCatalog('securityZones');
export const useActiveAccessAreas = () => useActiveCatalog('accessAreas');
export const useActiveRejectionReasons = () => useActiveCatalog('rejectionReasons');

/**
 * Group active access areas by their zone color, returning the structure the
 * wizard's Step 6 needs: `{ zoneColor, areas: [{ code, name }] }`. The area
 * `code` carries the `<ZONE>-<AREA>` suffix which the wizard splits on.
 */
export interface ZoneGroup {
  zoneColor: ZoneColor;
  areas: { code: string; name: string }[];
}

export function useZonesWithAreas(): ZoneGroup[] {
  const zones = useActiveSecurityZones();
  const areas = useActiveAccessAreas();
  return useMemo(() => {
    return zones
      .map((z) => ({
        zoneColor: z.code as ZoneColor,
        areas: areas
          .filter((a) => a.code.startsWith(`${z.code}-`))
          .map((a) => ({ code: a.code.split('-').slice(1).join('-'), name: a.label })),
      }))
      .filter((g) => g.areas.length > 0);
  }, [zones, areas]);
}

/** Plain string labels for selects / filters derived from a catalog key. */
export function useActiveCatalogLabels<K extends keyof Catalogs>(key: K): string[] {
  return useActiveCatalog(key).map((e) => e.label);
}
