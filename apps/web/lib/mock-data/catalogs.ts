import { SEED_CATALOGS } from '@/lib/catalog-data';
import type { Catalogs } from '@/lib/types';

/**
 * Initial Zustand store payload for `catalogs`. The single source of truth is
 * `lib/catalog-data.ts` — admin edits persist via the store and the CRUD UI
 * at `/catalogs`.
 */
export const mockCatalogs: Catalogs = SEED_CATALOGS;
