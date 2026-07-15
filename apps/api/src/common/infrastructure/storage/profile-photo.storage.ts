import {
  BadRequestException,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Response } from 'express';

const MIME_EXTENSIONS: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

export async function storeProfilePhoto(
  file: Express.Multer.File | undefined,
): Promise<string> {
  if (!file) throw new BadRequestException('La fotografía es obligatoria');
  const extension = MIME_EXTENSIONS[file.mimetype];
  if (!extension)
    throw new BadRequestException('La fotografía debe ser PNG, JPG o WEBP');
  const directory = join(process.env.STORAGE_PATH ?? './storage', 'profiles');
  await mkdir(directory, { recursive: true });
  const filename = `${randomUUID()}${extension}`;
  await writeFile(join(directory, filename), file.buffer);
  return filename;
}

export function streamProfilePhoto(
  filename: string,
  response: Response,
): StreamableFile {
  if (!/^[a-f0-9-]+\.(png|jpg|webp)$/.test(filename))
    throw new NotFoundException();
  const path = join(
    process.env.STORAGE_PATH ?? './storage',
    'profiles',
    filename,
  );
  if (!existsSync(path)) throw new NotFoundException();
  const extension = extname(filename);
  response.setHeader(
    'Content-Type',
    extension === '.png'
      ? 'image/png'
      : extension === '.webp'
        ? 'image/webp'
        : 'image/jpeg',
  );
  response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  return new StreamableFile(createReadStream(path));
}
