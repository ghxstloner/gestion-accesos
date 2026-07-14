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
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../../../common/presentation/decorators/permissions.decorator';
import { CurrentUser } from '../../../../common/presentation/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../../common/presentation/decorators/authenticated-user';
import { AuthorizedSignerService } from '../../application/authorized-signer.service';
import {
  AuthorizedSignerResponseDto,
  CreateAuthorizedSignerDto,
  RevokeSignerDto,
  UpdateAuthorizedSignerDto,
} from '../dto/authorized-signer.dto';

@ApiTags('authorized-signers')
@Controller('authorized-signers')
export class AuthorizedSignersController {
  constructor(private readonly signerService: AuthorizedSignerService) {}

  @Post()
  @RequirePermissions('signers.manage')
  async create(
    @Body() dto: CreateAuthorizedSignerDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<AuthorizedSignerResponseDto> {
    return this.signerService.create(dto, actor);
  }

  @Get()
  @RequirePermissions('signers.read')
  async list(
    @Query('companyId') companyId: string | undefined,
    @Query('personId') personId: string | undefined,
    @Query('status') status: string | undefined,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @CurrentUser() actor?: AuthenticatedUser,
  ): Promise<{
    items: AuthorizedSignerResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.signerService.findAll(
      {
        companyId,
        personId,
        status,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      },
      actor,
    );
  }

  @Get(':id')
  @RequirePermissions('signers.read')
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<AuthorizedSignerResponseDto> {
    return this.signerService.findById(id, actor);
  }

  @Patch(':id')
  @RequirePermissions('signers.manage')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAuthorizedSignerDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<AuthorizedSignerResponseDto> {
    return this.signerService.update(id, dto, actor);
  }

  @Post(':id/activate')
  @RequirePermissions('signers.manage')
  @HttpCode(204)
  async activate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    await this.signerService.activate(id, actor);
  }

  @Post(':id/revoke')
  @RequirePermissions('signers.manage')
  @HttpCode(204)
  async revoke(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RevokeSignerDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    await this.signerService.revoke(id, dto, actor);
  }
}
