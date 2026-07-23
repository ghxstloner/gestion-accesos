import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../../../common/presentation/decorators/permissions.decorator';
import { CurrentUser } from '../../../../common/presentation/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../../common/presentation/decorators/authenticated-user';
import type { RequestType } from '../../../../generated/prisma/client';
import { WorkflowEngineService } from '../../application/workflow-engine.service';
import {
  WORKFLOW_INSTANCE_REPOSITORY,
  type WorkflowInstanceRepositoryPort,
} from '../../domain/repositories/workflow-instance.repository.port';
import {
  BusinessRuleError,
  NotFoundError,
} from '../../../../common/domain/errors/domain-error';
import { WorkflowPresenter } from '../presenters/workflow.presenter';
import {
  StartWorkflowInputDto,
  WorkflowInstanceResponseDto,
} from '../dto/workflow.dto';
import { Inject } from '@nestjs/common';

@ApiTags('workflows')
@Controller('workflows/instances')
export class WorkflowInstancesController {
  constructor(
    private readonly engine: WorkflowEngineService,
    @Inject(WORKFLOW_INSTANCE_REPOSITORY)
    private readonly instances: WorkflowInstanceRepositoryPort,
  ) {}

  @Post('start')
  @RequirePermissions('workflows.execute')
  @HttpCode(200)
  async start(
    @Body() dto: StartWorkflowInputDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<WorkflowInstanceResponseDto> {
    // Look up the request to discover its type
    const req = await this.engine.requests.getById(actor, dto.requestId);
    if (!req.requestTypeCode) {
      throw new BusinessRuleError(
        `Request ${dto.requestId} is not bound to a known requestType`,
      );
    }
    const instance = await this.engine.start({
      requestId: dto.requestId,
      requestType: req.requestTypeCode as RequestType,
      actor,
      contextPatch: dto.contextPatch,
      idempotencyKey: dto.idempotencyKey ?? null,
    });
    return WorkflowPresenter.toInstanceResponse(instance);
  }

  @Get(':id')
  @RequirePermissions('workflows.read')
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WorkflowInstanceResponseDto> {
    const inst = await this.instances.findById(id);
    if (!inst) throw new NotFoundError('WorkflowInstance', id);
    return WorkflowPresenter.toInstanceResponse(inst);
  }

  @Get('by-request/:requestId')
  @RequirePermissions('workflows.read')
  async getByRequest(
    @Param('requestId', ParseUUIDPipe) requestId: string,
  ): Promise<WorkflowInstanceResponseDto> {
    const inst = await this.instances.findByRequestId(requestId);
    if (!inst)
      throw new NotFoundError('WorkflowInstance', `request:${requestId}`);
    return WorkflowPresenter.toInstanceResponse(inst);
  }
}
