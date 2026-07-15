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
import type { Response } from 'express';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { basename } from 'node:path';
import { RequirePermissions } from '../../../../common/presentation/decorators/permissions.decorator';
import { CurrentUser } from '../../../../common/presentation/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../../common/presentation/decorators/authenticated-user';
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
  constructor(
    private readonly documentService: DocumentService,
    @Inject(FILE_STORAGE) private readonly storage: FileStoragePort,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List documents for a request' })
  async list(
    @Query() query: ListDocumentsByRequestDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    const docs = await this.documentService.listForRequest(actor, query.requestId);
    return docs.map((d) => DocumentPresenter.toResponse(d));
  }

  @Get('requirements')
  @ApiOperation({ summary: 'List document requirements for a request type' })
  async listRequirements(@Query() query: DocumentRequirementQueryDto) {
    const reqs = await this.documentService.listRequirements(query.requestTypeId);
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
  @ApiOperation({ summary: 'Upload a document file' })
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('requestId') requestId: string,
    @Body('documentTypeId') documentTypeId: string,
    @Body('subjectType') subjectType: DocumentSubjectTypeDto,
    @Body('subjectId') subjectId: string | undefined,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    if (!file) throw new Error('No file uploaded');
    if (!requestId) throw new Error('requestId is required');
    if (!documentTypeId) throw new Error('documentTypeId is required');
    if (!subjectType) throw new Error('subjectType is required');

    const stream = createReadStream(file.path);
    const doc = await this.documentService.upload(actor, {
      requestId,
      documentTypeId,
      subjectType: subjectType as 'REQUEST' | 'PERSON',
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
  @ApiOperation({ summary: 'Review a document (approve or reject)' })
  async review(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewDocumentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    const review = await this.documentService.review(actor, {
      documentId: id,
      decision: dto.decision as 'APPROVED' | 'REJECTED',
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
}
