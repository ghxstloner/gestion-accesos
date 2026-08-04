import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
  Header,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { createReadStream } from 'node:fs';
import { open } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import { stat } from 'node:fs/promises';
import { basename } from 'node:path';
import { RequirePermissions } from '../../../../common/presentation/decorators/permissions.decorator';
import { CurrentUser } from '../../../../common/presentation/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../../common/presentation/decorators/authenticated-user';
import { ValidationError } from '../../../../common/domain/errors/domain-error';
import { validateUploadedFile } from '../../../../common/security/file-upload-validation';
import { DocumentService } from '../../application/document.service';
import {
  ReviewDocumentDto,
  DocumentSubjectTypeDto,
  ListDocumentsByRequestDto,
  DocumentRequirementQueryDto,
} from '../dto/document.dto';
import { DocumentPresenter } from '../presenters/document.presenter';
import {
  FILE_STORAGE,
  type FileStoragePort,
} from '../../domain/file-storage.port';

@ApiTags('documents')
@Controller('documents')
export class DocumentsController {
  /** Bytes read from the head of every uploaded file for magic-byte sniffing. */
  private static readonly MAGIC_BYTE_READ = 16;

  constructor(
    private readonly documentService: DocumentService,
    @Inject(FILE_STORAGE) private readonly storage: FileStoragePort,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List documents for a request' })
  async list(
    @Query() query: ListDocumentsByRequestDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    const docs = await this.documentService.listForRequest(
      actor,
      query.requestId,
    );
    return docs.map((d) => DocumentPresenter.toResponse(d));
  }

  @Get('requirements')
  @ApiOperation({ summary: 'List document requirements for a request type' })
  async listRequirements(@Query() query: DocumentRequirementQueryDto) {
    const reqs = await this.documentService.listRequirements(
      query.requestTypeId,
    );
    return reqs.map((r) => DocumentPresenter.toRequirement(r));
  }

  @Get(':id/reviews')
  @RequirePermissions('requests.review')
  @ApiOperation({ summary: 'List reviews for a document' })
  async listReviews(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    const reviews = await this.documentService.listReviews(actor, id);
    return reviews.map((r) => DocumentPresenter.toReview(r));
  }

  @Post()
  @RequirePermissions('requests.create')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  // Cap uploads to 10 / minute per source so attackers cannot flood disk.
  @Throttle({ medium: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Upload a document file' })
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('requestId') requestId: string,
    @Body('documentTypeId') documentTypeId: string,
    @Body('subjectType') subjectType: DocumentSubjectTypeDto,
    @Body('subjectId') subjectId: string | undefined,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    if (!file) throw new ValidationError('No file uploaded');
    if (!requestId) throw new ValidationError('requestId is required');
    if (!documentTypeId)
      throw new ValidationError('documentTypeId is required');
    if (!subjectType) throw new ValidationError('subjectType is required');

    // Validate MIME, extension, size and magic-byte signature *before* the
    // file is persisted so attackers cannot smuggle disguised payloads.
    const maxBytes = this.config.get<number>('MAX_FILE_SIZE') ?? 10_485_760;
    const head = await this.readMagicBytes(file.path);
    validateUploadedFile({
      declaredMime: file.mimetype,
      originalName: file.originalname,
      size: file.size,
      head,
      maxBytes,
    });

    const stream = createReadStream(file.path);
    const doc = await this.documentService.upload(actor, {
      requestId,
      documentTypeId,
      subjectType: subjectType,
      subjectId: subjectId ?? null,
      upload: {
        originalFilename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        stream,
      },
    });
    return DocumentPresenter.toResponse(doc);
  }

  @Post(':id/reviews')
  @RequirePermissions('requests.review')
  @Throttle({ medium: { ttl: 60_000, limit: 20 } })
  @ApiOperation({ summary: 'Review a document (approve or reject)' })
  async review(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewDocumentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    const review = await this.documentService.review(actor, {
      documentId: id,
      decision: dto.decision,
      comment: dto.comment ?? null,
    });
    return DocumentPresenter.toReview(review);
  }

  @Get(':id/download')
  @Header('Content-Type', 'application/octet-stream')
  @ApiOperation({ summary: 'Download the current version of a document' })
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const doc = await this.documentService.getById(actor, id);
    const current = doc.getCurrentVersion();
    if (!current) {
      res.status(404);
      throw new Error('No version to download');
    }
    const location = this.storage.resolveReadLocation(current.storageKey);
    if (!location) {
      res.status(404);
      throw new Error('File missing on disk');
    }
    const stats = await stat(location.path);
    const stream = createReadStream(location.path);
    const fileName = basename(current.storedFilename);
    res.set({
      'Content-Length': String(stats.size),
      'Content-Disposition': `attachment; filename="${fileName}"`,
    });
    return new StreamableFile(stream);
  }

  /**
   * Read the first bytes of an uploaded file from disk without buffering
   * the entire body into memory. Used by `validateUploadedFile` for the
   * magic-byte signature check.
   */
  private async readMagicBytes(path: string): Promise<Uint8Array> {
    let handle: FileHandle | undefined;
    try {
      handle = await open(path, 'r');
      const buf = Buffer.alloc(DocumentsController.MAGIC_BYTE_READ);
      const { bytesRead } = await handle.read(buf, 0, buf.length, 0);
      return new Uint8Array(buf.buffer, buf.byteOffset, bytesRead);
    } finally {
      await handle?.close();
    }
  }
}
