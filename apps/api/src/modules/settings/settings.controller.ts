import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { PrismaService } from '../../common/infrastructure/prisma/prisma.service';
import { RequirePermissions } from '../../common/presentation/decorators/permissions.decorator';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { FileInterceptor } from '@nestjs/platform-express';
import { mkdir, writeFile } from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import type { Response } from 'express';
import { Public } from '../../common/presentation/decorators/public.decorator';

class UpdateSettingsDto {
  @IsOptional() @IsString() companyName?: string;
  @IsOptional() @IsString() logoUrl?: string;
  @IsOptional() @IsString() smtpHost?: string;
  @IsOptional() @IsInt() @Min(1) @Max(65535) smtpPort?: number;
  @IsOptional() @IsIn(['NONE', 'SSL', 'TLS']) smtpSecurity?: string;
  @IsOptional() @IsString() smtpUsername?: string;
  @IsOptional() @IsString() smtpPassword?: string;
  @IsOptional() @IsEmail() fromEmail?: string;
  @IsOptional() @IsString() fromName?: string;
  @IsOptional() @IsEmail() replyToEmail?: string;
}

@ApiTags('Settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({
    summary: 'Get public system branding and mail configuration status',
  })
  async get() {
    const row = await this.prisma.systemSetting.upsert({
      where: { id: 'global' },
      create: { id: 'global' },
      update: {},
    });
    const { smtpPassword, ...safe } = row;
    return { ...safe, smtpPasswordConfigured: Boolean(smtpPassword) };
  }

  @Post('logo')
  @RequirePermissions('settings.manage')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }),
  )
  @ApiOperation({ summary: 'Upload the SGA sidebar logo' })
  async uploadLogo(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Logo file is required');
    const extensions: Record<string, string> = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/webp': '.webp',
    };
    const extension = extensions[file.mimetype];
    if (!extension)
      throw new BadRequestException(
        'Only PNG, JPG and WEBP images are allowed',
      );
    const directory = join(process.env.STORAGE_PATH ?? './storage', 'branding');
    await mkdir(directory, { recursive: true });
    const filename = `${randomUUID()}${extension}`;
    await writeFile(join(directory, filename), file.buffer);
    const logoUrl = `/settings/logo/${filename}`;
    const row = await this.prisma.systemSetting.upsert({
      where: { id: 'global' },
      create: { id: 'global', logoUrl },
      update: { logoUrl },
    });
    const { smtpPassword, ...safe } = row;
    return { ...safe, smtpPasswordConfigured: Boolean(smtpPassword) };
  }

  @Public()
  @Get('logo/:filename')
  @ApiOperation({ summary: 'Serve the configured SGA logo' })
  getLogo(
    @Param('filename') filename: string,
    @Res({ passthrough: true }) response: Response,
  ): StreamableFile {
    if (!/^[a-f0-9-]+\.(png|jpg|webp)$/.test(filename))
      throw new NotFoundException();
    const path = join(
      process.env.STORAGE_PATH ?? './storage',
      'branding',
      filename,
    );
    if (!existsSync(path)) throw new NotFoundException();
    const mime =
      extname(filename) === '.png'
        ? 'image/png'
        : extname(filename) === '.webp'
          ? 'image/webp'
          : 'image/jpeg';
    response.setHeader('Content-Type', mime);
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return new StreamableFile(createReadStream(path));
  }

  @Patch()
  @RequirePermissions('settings.manage')
  @ApiOperation({ summary: 'Update branding and mail settings' })
  async update(@Body() dto: UpdateSettingsDto) {
    const data = { ...dto };
    if (!dto.smtpPassword) delete data.smtpPassword;
    else data.smtpPassword = this.encryptSecret(dto.smtpPassword);
    const row = await this.prisma.systemSetting.upsert({
      where: { id: 'global' },
      create: { id: 'global', ...data },
      update: data,
    });
    const { smtpPassword, ...safe } = row;
    return { ...safe, smtpPasswordConfigured: Boolean(smtpPassword) };
  }

  private encryptSecret(value: string): string {
    const key = createHash('sha256')
      .update(process.env.JWT_ACCESS_SECRET ?? 'local-development-secret')
      .digest();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);
    return [
      'v1',
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      encrypted.toString('base64url'),
    ].join('.');
  }
}
