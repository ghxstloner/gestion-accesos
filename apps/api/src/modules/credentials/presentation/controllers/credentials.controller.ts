import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/presentation/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../../common/presentation/decorators/authenticated-user';
import { RequirePermissions } from '../../../../common/presentation/decorators/permissions.decorator';
import { CredentialService } from '../../application/credential.service';
import { CredentialMapper } from '../../infrastructure/persistence/mappers/credential.mapper';
import {
  CorrectDeliveryDto,
  DeliverCredentialDto,
  IssueCredentialDto,
  ListCredentialsDto,
  TransitionCredentialDto,
} from '../dto/credential.dto';
import { CredentialPresenter } from '../presenters/credential.presenter';

@ApiTags('credentials')
@Controller('credentials')
export class CredentialsController {
  constructor(private readonly credentialService: CredentialService) {}

  @Post()
  @RequirePermissions('issuance.manage')
  @ApiOperation({ summary: 'Issue a credential for an approved request' })
  async issue(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: IssueCredentialDto,
  ) {
    const cred = await this.credentialService.issue(actor, {
      requestId: dto.requestId,
      credentialType: dto.credentialType,
      subjectUserId: dto.subjectUserId ?? null,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      comment: dto.comment ?? null,
    });
    return CredentialPresenter.toResponse(CredentialMapper.toRecord(cred));
  }

  @Get()
  @RequirePermissions('issuance.read')
  @ApiOperation({ summary: 'List credentials' })
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

  @Get(':id/events')
  @RequirePermissions('issuance.read')
  @ApiOperation({ summary: 'List credential lifecycle events' })
  async listEvents(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const events = await this.credentialService.listEvents(actor, id);
    return events.map((e) => CredentialPresenter.toEvent(e));
  }

  @Get(':id/delivery')
  @RequirePermissions('issuance.read')
  @ApiOperation({ summary: 'Get delivery record for a credential' })
  async getDelivery(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const delivery = await this.credentialService.getDelivery(actor, id);
    return delivery ? CredentialPresenter.toDelivery(delivery) : null;
  }

  @Post(':id/transition')
  @RequirePermissions('issuance.manage')
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

  @Post(':id/deliver')
  @RequirePermissions('issuance.manage')
  @HttpCode(200)
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
