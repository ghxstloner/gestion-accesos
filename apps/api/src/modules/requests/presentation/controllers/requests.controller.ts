import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  HttpStatus,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../../../common/presentation/decorators/permissions.decorator';
import { CurrentUser } from '../../../../common/presentation/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../../common/presentation/decorators/authenticated-user';
import { RequestService } from '../../application/request.service';
import {
  CreateRequestDto,
  TransitionRequestDto,
  UpdateRequestDto,
} from '../dto/request.dto';
import { RequestPresenter } from '../presenters/request.presenter';

@ApiTags('requests')
@Controller('requests')
export class RequestsController {
  constructor(private readonly requestService: RequestService) {}

  @Post()
  @RequirePermissions('requests.create')
  @ApiOperation({ summary: 'Create a draft request' })
  async create(
    @Body() dto: CreateRequestDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    const req = await this.requestService.create(actor, dto);
    return RequestPresenter.toResponse(req);
  }

  @Get()
  @ApiOperation({ summary: 'List requests (scoped by role)' })
  async list(
    @Query('companyId') companyId: string | undefined,
    @Query('createdByUserId') createdByUserId: string | undefined,
    @Query('status') status: string | undefined,
    @Query('requestTypeId') requestTypeId: string | undefined,
    @Query('search') search: string | undefined,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @CurrentUser() actor?: AuthenticatedUser,
  ) {
    const result = await this.requestService.list(actor, {
      companyId,
      createdByUserId,
      status,
      requestTypeId,
      search,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
    return {
      items: result.items.map((r) => RequestPresenter.toListItem(r)),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a request by id' })
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    const req = await this.requestService.getById(actor, id);
    return RequestPresenter.toResponse(req);
  }

  @Patch(':id')
  @RequirePermissions('requests.create')
  @ApiOperation({ summary: 'Update an editable (DRAFT or RETURNED) request' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRequestDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    const req = await this.requestService.update(actor, id, dto);
    return RequestPresenter.toResponse(req);
  }

  @Delete(':id')
  @RequirePermissions('requests.create')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a draft request' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    await this.requestService.delete(actor, id);
  }

  @Post(':id/transition')
  @RequirePermissions('requests.submit')
  @ApiOperation({
    summary:
      'Apply a state-machine transition (submit/resubmit/cancel/return/reject/approve/issue)',
  })
  async transition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransitionRequestDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    const req = await this.requestService.transition(actor, {
      requestId: id,
      transition: dto.transition,
      reasonCode: dto.reasonCode,
      comment: dto.comment,
    });
    return RequestPresenter.toResponse(req);
  }

  @Get(':id/events')
  @ApiOperation({ summary: 'List lifecycle events for a request' })
  async listEvents(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    const events = await this.requestService.listEvents(actor, id);
    return events.map((e) => RequestPresenter.toEvent(e));
  }
}
