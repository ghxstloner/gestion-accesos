import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  HttpStatus,
  forwardRef,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../../../common/presentation/decorators/permissions.decorator';
import { CurrentUser } from '../../../../common/presentation/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../../common/presentation/decorators/authenticated-user';
import { RequestService } from '../../application/request.service';
import type { RequestTransition } from '../../domain/request-state.policy';
import { RequestWorkflowOrchestrator } from '../../../workflows/application/request-workflow-orchestrator.service';
import type { HumanTaskOutcome } from '../../../workflows/domain/workflow-definition.types';
import {
  CreateRequestDto,
  TransitionRequestDto,
  UpdateRequestDto,
} from '../dto/request.dto';
import { RequestPresenter } from '../presenters/request.presenter';

/**
 * Mapping of reviewer-driven Request transitions to the corresponding
 * workflow human-task outcome. Only transitions that correspond to a reviewer
 * decision are routed through the orchestrator (so the active workflow task is
 * completed + the engine advances). Transitions not present here are applied
 * via the plain {@link RequestService.transition} legacy path.
 */
const REVIEW_TRANSITION_TO_OUTCOME: Partial<
  Record<RequestTransition, HumanTaskOutcome>
> = {
  advance_to_document_review: 'APPROVE',
  approve_documents: 'APPROVE',
  advance_to_final: 'APPROVE',
  approve_final: 'APPROVE',
  return: 'RETURN_FOR_CORRECTION',
  reject: 'REJECT',
};

@ApiTags('requests')
@Controller('requests')
export class RequestsController {
  constructor(
    private readonly requestService: RequestService,
    @Inject(forwardRef(() => RequestWorkflowOrchestrator))
    private readonly orchestrator: RequestWorkflowOrchestrator,
  ) {}

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
    const transition = dto.transition as RequestTransition;
    const req = await this.applyTransition(actor, {
      requestId: id,
      transition,
      reasonCode: dto.reasonCode,
      comment: dto.comment,
    });
    return RequestPresenter.toResponse(req);
  }

  /**
   * Route a state-machine transition through the appropriate persistence path:
   *  - `submit` / `resubmit` → orchestrator starts a workflow run.
   *  - reviewer transitions (`return`/`reject`/`approve_*`/`advance_*`) →
   *    orchestrator completes the active workflow task and advances.
   *  - everything else (`cancel`/`start_production`/`mark_ready`/`deliver`)
   *    → plain {@link RequestService.transition} (no workflow involvement).
   *
   * The orchestrator falls back silently to the legacy path when no published
   * workflow exists or no active instance/task is found, so behaviour is
   * unchanged for requests that pre-date the workflow bridge.
   */
  private async applyTransition(
    actor: AuthenticatedUser,
    input: {
      requestId: string;
      transition: RequestTransition;
      reasonCode?: string | null;
      comment?: string | null;
    },
  ) {
    if (input.transition === 'submit') {
      await this.orchestrator.onSubmit({
        requestId: input.requestId,
        actor,
      });
      return this.requestService.getById(actor, input.requestId);
    }
    if (input.transition === 'resubmit') {
      await this.orchestrator.onResubmit({
        requestId: input.requestId,
        actor,
      });
      return this.requestService.getById(actor, input.requestId);
    }
    const outcome = REVIEW_TRANSITION_TO_OUTCOME[input.transition];
    if (outcome) {
      await this.orchestrator.onReviewOutcome({
        requestId: input.requestId,
        actor,
        requestTransition: input.transition,
        outcome,
        comment: input.comment ?? null,
        reasonCode: input.reasonCode ?? null,
      });
      return this.requestService.getById(actor, input.requestId);
    }
    // Legacy / operational transitions (cancel, production, delivery).
    return this.requestService.transition(actor, input);
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
