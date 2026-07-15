import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../../../common/presentation/decorators/permissions.decorator';
import { CurrentUser } from '../../../../common/presentation/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../../common/presentation/decorators/authenticated-user';
import { PersonService } from '../../application/person.service';
import {
  CreatePersonDto,
  PersonResponseDto,
  UpdatePersonDto,
} from '../dto/person.dto';
import { Public } from '../../../../common/presentation/decorators/public.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { PrismaService } from '../../../../common/infrastructure/prisma/prisma.service';
import {
  storeProfilePhoto,
  streamProfilePhoto,
} from '../../../../common/infrastructure/storage/profile-photo.storage';

@ApiTags('people')
@Controller('people')
export class PeopleController {
  constructor(
    private readonly personService: PersonService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get('photo/:filename')
  photo(
    @Param('filename') filename: string,
    @Res({ passthrough: true }) response: Response,
  ): StreamableFile {
    return streamProfilePhoto(filename, response);
  }

  @Post(':id/photo')
  @RequirePermissions('people.manage')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 3 * 1024 * 1024 } }),
  )
  async uploadPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<PersonResponseDto> {
    await this.personService.findById(id, actor);
    const filename = await storeProfilePhoto(file);
    await this.prisma.person.update({
      where: { id },
      data: { photoUrl: `/people/photo/${filename}` },
    });
    return this.personService.findById(id, actor);
  }

  @Post()
  @RequirePermissions('people.manage')
  async create(
    @Body() dto: CreatePersonDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<PersonResponseDto> {
    return this.personService.create(dto, actor);
  }

  @Get()
  @RequirePermissions('people.read')
  async list(
    @Query('companyId') companyId: string | undefined,
    @Query('search') search: string | undefined,
    @Query('status') status: string | undefined,
    @Query('identificationTypeId') identificationTypeId: string | undefined,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @CurrentUser() actor?: AuthenticatedUser,
  ): Promise<{
    items: PersonResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.personService.findAll(
      {
        companyId,
        search,
        status,
        identificationTypeId,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      },
      actor,
    );
  }

  @Get(':id')
  @RequirePermissions('people.read')
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<PersonResponseDto> {
    return this.personService.findById(id, actor);
  }

  @Patch(':id')
  @RequirePermissions('people.manage')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePersonDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<PersonResponseDto> {
    return this.personService.update(id, dto, actor);
  }

  @Post(':id/activate')
  @RequirePermissions('people.manage')
  @HttpCode(204)
  async activate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    await this.personService.activate(id, actor);
  }

  @Post(':id/deactivate')
  @RequirePermissions('people.manage')
  @HttpCode(204)
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    await this.personService.deactivate(id, actor);
  }
}
