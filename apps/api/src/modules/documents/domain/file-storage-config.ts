/**
 * Configurable file upload limits. Provided via dependency injection so tests
 * can override them without touching env files.
 */
export interface FileStorageConfig {
  storagePath: string;
  maxFileSize: number; // bytes
  allowedMimeTypes: readonly string[];
}

export const DEFAULT_ALLOWED_MIME_TYPES: readonly string[] = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
];

export const DEFAULT_FILE_STORAGE_CONFIG: FileStorageConfig = {
  storagePath: './storage',
  maxFileSize: 10 * 1024 * 1024, // 10 MiB
  allowedMimeTypes: DEFAULT_ALLOWED_MIME_TYPES,
};

export const FILE_STORAGE_CONFIG = Symbol('FILE_STORAGE_CONFIG');

/** Sanitize a user-supplied filename: keep extension, strip path separators and unsafe chars. */
export function sanitizeFilename(original: string): string {
  const base = original
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 180);
  const dotIdx = base.lastIndexOf('.');
  if (dotIdx <= 0) return base;
  const stem = base.slice(0, dotIdx);
  const ext = base.slice(dotIdx + 1).toLowerCase();
  return `${stem}.${ext}`;
}
