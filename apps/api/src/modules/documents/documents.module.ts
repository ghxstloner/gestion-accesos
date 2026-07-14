import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join, resolve } from 'node:path';
import { RequestsModule } from '../requests/requests.module';
import { CatalogsModule } from '../catalogs/catalogs.module';
import { DocumentService } from './application/document.service';
import { DocumentsController } from './presentation/controllers/documents.controller';
import {
  DOCUMENT_REPOSITORY_PROVIDER,
} from './infrastructure/persistence/repositories/document.repository.prisma';
import {
  DOCUMENT_REQUIREMENT_REPOSITORY_PROVIDER,
} from './infrastructure/persistence/repositories/document-requirement.repository.prisma';
import { LocalFileStorageAdapter } from './infrastructure/storage/local-file-storage.adapter';
import {
  FILE_STORAGE,
} from './domain/file-storage.port';
import {
  DEFAULT_FILE_STORAGE_CONFIG,
  FILE_STORAGE_CONFIG,
  type FileStorageConfig,
} from './domain/file-storage-config';

@Module({
  imports: [
    CatalogsModule,
    RequestsModule,
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const tmpDir = resolve(join(
          config.get<string>('STORAGE_PATH') ?? './storage',
          'tmp',
        ));
        const maxFile = Number(config.get<string>('MAX_FILE_SIZE') ?? 10 * 1024 * 1024);
        return {
          storage: diskStorage({
            destination: tmpDir,
            filename: (_req: unknown, file: Express.Multer.File, cb: (err: Error | null, name: string) => void) => {
              const rand = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
              const ext = extname(file.originalname);
              cb(null, `${rand}${ext}`);
            },
          }),
          limits: { fileSize: maxFile },
        };
      },
    }),
  ],
  controllers: [DocumentsController],
  providers: [
    DocumentService,
    DOCUMENT_REPOSITORY_PROVIDER,
    DOCUMENT_REQUIREMENT_REPOSITORY_PROVIDER,
    {
      provide: FILE_STORAGE_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService): FileStorageConfig => ({
        storagePath: config.get<string>('STORAGE_PATH') ?? DEFAULT_FILE_STORAGE_CONFIG.storagePath,
        maxFileSize: Number(config.get<string>('MAX_FILE_SIZE') ?? DEFAULT_FILE_STORAGE_CONFIG.maxFileSize),
        allowedMimeTypes: DEFAULT_FILE_STORAGE_CONFIG.allowedMimeTypes,
      }),
    },
    // LocalFileStorageAdapter picks up FILE_STORAGE_CONFIG via DI.
    LocalFileStorageAdapter,
    {
      provide: FILE_STORAGE,
      useExisting: LocalFileStorageAdapter,
    },
  ],
  exports: [DocumentService, FILE_STORAGE],
})
export class DocumentsModule {}
