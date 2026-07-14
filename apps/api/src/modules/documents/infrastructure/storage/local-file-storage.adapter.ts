import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, stat, rm } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { Readable } from 'node:stream';
import {
  BusinessRuleError,
  ValidationError,
} from '../../../../common/domain/errors/domain-error';
import {
  FILE_STORAGE,
  type FileStoragePort,
  type StoredFile,
  type UploadFile,
} from '../../domain/file-storage.port';
import {
  FILE_STORAGE_CONFIG,
  type FileStorageConfig,
  sanitizeFilename,
} from '../../domain/file-storage-config';

@Injectable()
export class LocalFileStorageAdapter implements FileStoragePort {
  constructor(private readonly config: FileStorageConfig) {}

  async store(upload: UploadFile, namespace: string): Promise<StoredFile> {
    if (upload.size <= 0) {
      throw new ValidationError('File is empty');
    }
    if (upload.size > this.config.maxFileSize) {
      throw new ValidationError(
        `File exceeds the ${this.config.maxFileSize} byte limit`,
      );
    }
    const mime = upload.mimeType.toLowerCase();
    if (!this.config.allowedMimeTypes.includes(mime)) {
      throw new BusinessRuleError(`MIME type ${mime} is not allowed`);
    }

    const sanitized = sanitizeFilename(upload.originalFilename);
    const id = randomUUID();
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const storageKey = `${namespace}/${year}/${month}/${id}-${sanitized}`;
    const fullPath = resolve(join(this.config.storagePath, storageKey));

    await mkdir(dirname(fullPath), { recursive: true });

    const hash = createHash('sha256');
    let totalBytes = 0;
    const out = createWriteStream(fullPath);
    const stream = upload.stream as Readable;

    await new Promise<void>((resolveFn, rejectFn) => {
      stream.on('data', (chunk: Buffer) => {
        totalBytes += chunk.length;
        if (totalBytes > this.config.maxFileSize) {
          rejectFn(new ValidationError(`File exceeds the ${this.config.maxFileSize} byte limit`));
          stream.destroy();
          out.destroy();
        }
        hash.update(chunk);
      });
      stream.pipe(out);
      stream.on('error', rejectFn);
      out.on('error', rejectFn);
      out.on('finish', () => resolveFn());
    });

    return {
      storageKey,
      storedFilename: sanitized,
      originalFilename: upload.originalFilename,
      mimeType: mime,
      size: totalBytes,
      sha256: hash.digest('hex'),
    };
  }

  resolveReadLocation(storageKey: string): { path: string } | null {
    const fullPath = resolve(join(this.config.storagePath, storageKey));
    return { path: fullPath };
  }

  async remove(storageKey: string): Promise<boolean> {
    const fullPath = resolve(join(this.config.storagePath, storageKey));
    try {
      const stats = await stat(fullPath);
      if (stats.isFile()) {
        await rm(fullPath);
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }
}

export const FILE_STORAGE_CONFIG_PROVIDER = (config: FileStorageConfig) => ({
  provide: FILE_STORAGE_CONFIG,
  useValue: config,
});
