import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiConsumes,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { IsString } from 'class-validator';
import type { Response } from 'express';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { basename } from 'node:path';
import { Readable } from 'node:stream';
import { AuthenticatedUser } from '../../../../common/presentation/decorators/authenticated-user';
import { CurrentUser } from '../../../../common/presentation/decorators/current-user.decorator';
import {
  BusinessRuleError,
  ValidationError,
} from '../../../../common/domain/errors/domain-error';
import { RequirePermissions } from '../../../../common/presentation/decorators/permissions.decorator';
import { CredentialService } from '../../application/credential.service';
import { CredentialMapper } from '../../infrastructure/persistence/mappers/credential.mapper';
import {
  CorrectDeliveryDto,
  DeliverCredentialDto,
  IssueCredentialDto,
  ListCredentialsDto,
  PhotoSourceDto,
  ReplaceCredentialDto,
  ReusePhotoDto,
  TransitionCredentialDto,
} from '../dto/credential.dto';
import {
  CredentialEventResponse,
  CredentialPresenter,
  DeliveryResponse,
} from '../presenters/credential.presenter';
import {
  FILE_STORAGE,
  type FileStoragePort,
} from '../../../documents/domain/file-storage.port';
import { DEFAULT_FILE_STORAGE_CONFIG } from '../../../documents/domain/file-storage-config';

class AttachPhotoDto {
  @ApiProperty({ enum: PhotoSourceDto })
  @IsString()
  source!: string;
}

@ApiTags('credentials')
@Controller('credentials')
export class CredentialsController {
  constructor(
    private readonly credentialService: CredentialService,
    @Inject(FILE_STORAGE) private readonly storage: FileStoragePort,
  ) {}

  @Post()
  @RequirePermissions('issuance.manage')
  @Throttle({ medium: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Issue a credential for an approved request' })
  async issue(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: IssueCredentialDto,
  ) {
    const cred = await this.credentialService.issue(actor, {
      requestId: dto.requestId,
      credentialType: dto.credentialType,
      subjectUserId: dto.subjectUserId ?? null,
      holderName: dto.holderName ?? null,
      authorizedZones: dto.authorizedZones ?? null,
      cardCode: dto.cardCode ?? null,
      issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : null,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      observations: dto.observations ?? null,
      comment: dto.comment ?? null,
    });
    return CredentialPresenter.toResponse(CredentialMapper.toRecord(cred));
  }

  @Get()
  @RequirePermissions('issuance.read')
  @ApiOperation({ summary: 'List credentials (issuance work queue)' })
  async list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListCredentialsDto,
  ) {
    const page = await this.credentialService.list(
      actor,
      {
        status: query.status,
        credentialType: query.credentialType,
        requestId: query.requestId,
        subjectUserId: query.subjectUserId,
        cardCode: query.cardCode,
        credentialNumber: query.credentialNumber,
        search: query.search,
      },
      query.page ?? 1,
      query.pageSize ?? 20,
    );
    return {
      items: CredentialPresenter.toList(page.items),
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
    };
  }

  @Get('by-request/:requestId')
  @RequirePermissions('issuance.read')
  @ApiOperation({ summary: 'Find credential by request id' })
  async getByRequest(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('requestId') requestId: string,
  ) {
    const cred = await this.credentialService.getByRequest(actor, requestId);
    return cred
      ? CredentialPresenter.toResponse(CredentialMapper.toRecord(cred))
      : null;
  }

  @Get(':id')
  @RequirePermissions('issuance.read')
  @ApiOperation({ summary: 'Get a credential by id' })
  async getById(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const cred = await this.credentialService.getById(actor, id);
    return CredentialPresenter.toResponse(CredentialMapper.toRecord(cred));
  }

  @Get(':id/events')
  @RequirePermissions('issuance.read')
  @ApiOperation({ summary: 'List credential lifecycle events' })
  async listEvents(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<CredentialEventResponse[]> {
    const events = await this.credentialService.listEvents(actor, id);
    return events.map((e) => CredentialPresenter.toEvent(e));
  }

  @Get(':id/delivery')
  @RequirePermissions('issuance.read')
  @ApiOperation({ summary: 'Get delivery record for a credential' })
  async getDelivery(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<DeliveryResponse | null> {
    const delivery = await this.credentialService.getDelivery(actor, id);
    return delivery ? CredentialPresenter.toDelivery(delivery) : null;
  }

  @Get(':id/photo-reuse-candidate')
  @RequirePermissions('issuance.read')
  @ApiOperation({
    summary:
      'Find a reusable previous photo for the credential subject (only present when reuse is allowed)',
  })
  async findReusablePhoto(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const candidate = await this.credentialService.findReusablePhoto(actor, id);
    return candidate ?? null;
  }

  @Get(':id/print')
  @RequirePermissions('issuance.read')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @ApiOperation({
    summary:
      'Render a print-ready HTML view of the credential for browser printing',
  })
  async print(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<string> {
    const cred = await this.credentialService.getById(actor, id);
    const props = cred.toProps();
    return renderCredentialCard({
      credentialNumber: cred.credentialNumber,
      cardCode: cred.cardCode,
      holderName: cred.holderName,
      credentialType: cred.credentialType,
      issuedAt: cred.issuedAt,
      expiresAt: cred.expiresAt,
      authorizedZones: cred.authorizedZones,
      observations: cred.observations ?? null,
      requestId: cred.requestId,
      producedAt: props.producedAt,
      readyAt: props.readyAt,
    });
  }

  @Post(':id/transition')
  @RequirePermissions('issuance.manage')
  @Throttle({ medium: { ttl: 60_000, limit: 30 } })
  @HttpCode(200)
  @ApiOperation({ summary: 'Apply a lifecycle transition to a credential' })
  async transition(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: TransitionCredentialDto,
  ) {
    const cred = await this.credentialService.transition(
      actor,
      id,
      dto.transition as Parameters<CredentialService['transition']>[2],
      dto.comment ?? null,
    );
    return CredentialPresenter.toResponse(CredentialMapper.toRecord(cred));
  }

  @Post(':id/replace')
  @RequirePermissions('issuance.manage')
  @Throttle({ medium: { ttl: 60_000, limit: 10 } })
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Replace a credential because of loss or damage; revokes the original and creates a new one',
  })
  async replace(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReplaceCredentialDto,
  ) {
    const { original, replacement } = await this.credentialService.replace(
      actor,
      id,
      { reason: dto.reason, cardCode: dto.cardCode ?? null },
    );
    return {
      original: CredentialPresenter.toResponse(
        CredentialMapper.toRecord(original),
      ),
      replacement: CredentialPresenter.toResponse(
        CredentialMapper.toRecord(replacement),
      ),
    };
  }

  @Post(':id/photo')
  @RequirePermissions('issuance.manage')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @Throttle({ medium: { ttl: 60_000, limit: 20 } })
  @ApiOperation({
    summary:
      'Attach a captured or uploaded photograph to the credential (multipart file upload)',
  })
  async attachPhoto(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AttachPhotoDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new ValidationError('A file payload is required');
    const source = dto.source === 'CAPTURED' ? 'CAPTURED' : 'UPLOADED';
    if (file.size > DEFAULT_FILE_STORAGE_CONFIG.maxFileSize) {
      throw new ValidationError(
        `File exceeds the ${DEFAULT_FILE_STORAGE_CONFIG.maxFileSize} byte limit`,
      );
    }
    if (
      !DEFAULT_FILE_STORAGE_CONFIG.allowedMimeTypes.includes(
        file.mimetype.toLowerCase(),
      )
    ) {
      throw new BusinessRuleError(
        `MIME type ${file.mimetype} is not allowed for credential photos`,
      );
    }
    const buffer = Buffer.isBuffer(file.buffer)
      ? file.buffer
      : Buffer.from(file.buffer ?? []);
    const stored = await this.storage.store(
      {
        originalFilename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        stream: Readable.from(buffer),
      },
      'credentials',
    );
    const cred = await this.credentialService.attachPhoto(actor, id, {
      source,
      originalFilename: stored.originalFilename,
      mimeType: stored.mimeType,
      size: stored.size,
      bytes: Buffer.alloc(0), // bytes already persisted by storage adapter
      storageKey: stored.storageKey,
      sha256: stored.sha256,
      storedFilename: stored.storedFilename,
    });
    return CredentialPresenter.toResponse(CredentialMapper.toRecord(cred));
  }

  @Post(':id/photo/reuse')
  @RequirePermissions('issuance.manage')
  @HttpCode(200)
  @Throttle({ medium: { ttl: 60_000, limit: 20 } })
  @ApiOperation({
    summary:
      'Reuse the photograph from a previous credential of the same subject. Issuers must explicitly confirm.',
  })
  async reusePhoto(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReusePhotoDto,
  ) {
    const cred = await this.credentialService.reusePreviousPhoto(
      actor,
      id,
      dto.confirm === 'CONFIRM',
    );
    return CredentialPresenter.toResponse(CredentialMapper.toRecord(cred));
  }

  @Get(':id/photo-file')
  @RequirePermissions('issuance.read')
  @Header('Content-Type', 'application/octet-stream')
  @ApiOperation({ summary: 'Download the photograph attached to a credential' })
  async downloadPhoto(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const cred = await this.credentialService.getById(actor, id);
    const fileId = cred.toProps().photoFileId;
    if (!fileId) {
      res.status(404);
      throw new ValidationError('Credential has no attached photograph');
    }
    const meta = await this.credentialService.getFileMetadata(actor, fileId);
    if (!meta) {
      res.status(404);
      throw new ValidationError('Photograph file record was not found');
    }
    const location = this.storage.resolveReadLocation(meta.storageKey);
    if (!location) {
      res.status(404);
      throw new ValidationError('Photograph file is missing on disk');
    }
    const stats = await stat(location.path);
    const stream = createReadStream(location.path);
    const fileName = basename(meta.storedFilename);
    res.set({
      'Content-Length': String(stats.size),
      'Content-Disposition': `attachment; filename="${fileName}"`,
    });
    return new StreamableFile(stream);
  }

  @Post(':id/deliver')
  @RequirePermissions('issuance.manage')
  @HttpCode(200)
  @Throttle({ medium: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Record credential delivery' })
  async deliver(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: DeliverCredentialDto,
  ) {
    const cred = await this.credentialService.deliver(actor, id, {
      receivedByName: dto.receivedByName,
      receivedByIdentification: dto.receivedByIdentification,
      observations: dto.observations ?? null,
    });
    return CredentialPresenter.toResponse(CredentialMapper.toRecord(cred));
  }

  @Post(':id/correct-delivery')
  @RequirePermissions('issuance.manage')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark delivery as corrected' })
  async correctDelivery(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CorrectDeliveryDto,
  ) {
    const cred = await this.credentialService.correctDelivery(
      actor,
      id,
      dto.reason,
    );
    return CredentialPresenter.toResponse(CredentialMapper.toRecord(cred));
  }
}

/**
 * Render a minimal print-ready HTML view of the credential. Uses actual stored
 * fields; missing fields are clearly marked as pending for completion by
 * authorised personnel. Replaces any physical printer integration.
 */
function renderCredentialCard(input: {
  credentialNumber: string;
  cardCode: string | null;
  holderName: string | null;
  credentialType: string;
  issuedAt: Date | null;
  expiresAt: Date | null;
  authorizedZones: readonly string[];
  observations: string | null;
  requestId: string;
  producedAt: Date | null;
  readyAt: Date | null;
}): string {
  const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '—');
  const holderName = input.holderName?.trim() || 'Pendiente';
  const zones = input.authorizedZones.length
    ? input.authorizedZones.map((z) => `<li>${escapeHtml(z)}</li>`).join('')
    : '<li><em>Pendiente — aeropuerto confirma la correspondencia de zonas</em></li>';
  const observations =
    input.observations?.trim() || 'Sin observaciones registradas';
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Credencial ${escapeHtml(input.credentialNumber)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 0; padding: 22px; }
    header { display: flex; justify-content: space-between; border-bottom: 2px solid #1d4ed8; padding-bottom: 8px; }
    header h1 { font-size: 18px; margin: 0; letter-spacing: .3px; }
    header .meta { font-size: 12px; color: #475569; text-align: right; }
    .card { margin-top: 18px; border: 1px solid #cbd5f5; border-radius: 10px; padding: 18px; }
    .row { display: flex; gap: 16px; margin-top: 8px; font-size: 13px; }
    .row .label { color: #475569; min-width: 160px; }
    .photo { width: 96px; height: 120px; background: #f1f5f9; border: 1px dashed #94a3b8; display: inline-flex; align-items: center; justify-content: center; color: #64748b; font-size: 11px; float: right; margin-left: 12px; }
    .zones { margin: 6px 0 0; padding-left: 18px; font-size: 12px; }
    .footer { margin-top: 16px; font-size: 11px; color: #64748b; border-top: 1px dashed #cbd5f5; padding-top: 6px; }
    .stamp { display: inline-block; margin-top: 12px; border: 1px solid #1d4ed8; color: #1d4ed8; padding: 4px 10px; border-radius: 4px; font-size: 11px; text-transform: uppercase; letter-spacing: .4px; }
    .pending { color: #b45309; font-style: italic; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <header>
    <h1>SGA — Credencial de Acceso</h1>
    <div class="meta">
      <div><strong>N°:</strong> ${escapeHtml(input.credentialNumber)}</div>
      <div><strong>Solicitud:</strong> ${escapeHtml(input.requestId)}</div>
    </div>
  </header>
  <section class="card">
    <div class="photo">Foto pendiente</div>
    <div class="row"><span class="label">Tipo de credencial</span><span>${escapeHtml(input.credentialType)}</span></div>
    <div class="row"><span class="label">Titular</span><span>${escapeHtml(holderName)}</span></div>
    <div class="row"><span class="label">Código de tarjeta</span><span>${input.cardCode ? escapeHtml(input.cardCode) : '<span class="pending">Pendiente de codificación</span>'}</span></div>
    <div class="row"><span class="label">Fecha de emisión</span><span>${iso(input.issuedAt)}</span></div>
    <div class="row"><span class="label">Vencimiento</span><span>${iso(input.expiresAt)}</span></div>
    <div class="row" style="align-items: flex-start;"><span class="label">Zonas autorizadas</span><ul class="zones">${zones}</ul></div>
    <div class="row" style="align-items: flex-start;"><span class="label">Observaciones</span><span>${escapeHtml(observations)}</span></div>
    <div class="stamp">Válido únicamente con identificación oficial</div>
  </section>
  <p class="footer">
    Documento generado por SGA el ${new Date().toISOString()} ·
    Campos en <span class="pending">Pendiente</span> deben ser completados por personal autorizado.
    Este documento no sustituye la validación física del carné.
  </p>
  <p class="no-print"><button onclick="window.print()">Imprimir</button></p>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
