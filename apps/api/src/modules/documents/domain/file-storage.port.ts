/**
 * File storage abstraction. Implementations handle physical persistence of
 * uploaded files (local disk, S3, etc.) and compute integrity hashes.
 *
 * Spec ref: section 15.
 */

export interface StoredFile {
  storageKey: string;
  storedFilename: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  sha256: string;
}

export interface UploadFile {
  originalFilename: string;
  mimeType: string;
  size: number;
  /** Stream of file bytes. */
  stream: NodeJS.ReadableStream;
}

export const FILE_STORAGE = Symbol('FILE_STORAGE');

export interface FileStoragePort {
  /**
   * Persist a file. Implementations MUST:
   * - reject files larger than MaxFileSize
   * - reject mime types not in the allowlist
   * - sanitize the original filename
   * - compute a sha256 of the file
   * - return a unique storageKey
   */
  store(upload: UploadFile, namespace: string): Promise<StoredFile>;

  /** Resolve a file's absolute path / endpoint. Returns null if missing. */
  resolveReadLocation(storageKey: string): { path: string } | null;

  /** Delete a file. Returns whether anything was removed. */
  remove(storageKey: string): Promise<boolean>;
}
