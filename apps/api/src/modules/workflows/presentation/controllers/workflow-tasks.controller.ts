import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../../../common/presentation/decorators/permissions.decorator';
import { CurrentUser } from '../../../../common/presentation/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../../common/presentation/decorators/authenticated-user';
import { WorkflowTaskService } from '../../application/workflow-task.service';
import { WorkflowEngineService } from '../../application/workflow-engine.service';
import {
  WORKFLOW_INSTANCE_REPOSITORY,
  type WorkflowInstanceRepositoryPort,
} from '../../domain/repositories/workflow-instance.repository.port';
import { WorkflowPresenter } from '../presenters/workflow.presenter';
import { CompleteTaskDto, WorkflowTaskResponseDto } from '../dto/workflow.dto';
import type { HumanTaskOutcome } from '../../domain/workflow-definition.types';

@ApiTags('workflows')
@Controller('workflows/tasks')
export class WorkflowTasksController {
  constructor(
    private readonly taskService: WorkflowTaskService,
    private readonly engine: WorkflowEngineService,
    @Inject(WORKFLOW_INSTANCE_REPOSITORY)
    private readonly instances: WorkflowInstanceRepositoryPort,
  ) {}

  @Get()
  @RequirePermissions('workflows.read')
  async list(
    @Query('workflowInstanceId') workflowInstanceId?: string,
    @Query('requestId') requestId?: string,
    @Query('status') status?: string,
    @Query('assignedUserId') assignedUserId?: string,
    @Query('assignedRoleCode') assignedRoleCode?: string,
    @Query('claimed') claimed?: string,
    @Query('open') open?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @CurrentUser() actor?: AuthenticatedUser,
  ): Promise<{
    items: WorkflowTaskResponseDto[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const result = await this.taskService.list(
      {
        workflowInstanceId,
        requestId,
        status,
        assignedUserId,
        assignedRoleCode,
        claimed:
          claimed === 'true' ? true : claimed === 'false' ? false : undefined,
        open: open === 'true' ? true : open === 'false' ? false : undefined,
      },
      {
        page: page ? Number(page) : 1,
        pageSize: pageSize ? Number(pageSize) : 20,
      },
      actor,
    );
    return {
      items: result.items.map((t) => WorkflowPresenter.toTaskResponse(t)),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }

  @Get(':id')
  @RequirePermissions('workflows.read')
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WorkflowTaskResponseDto> {
    const { task } = await this.taskService.findById(id);
    return WorkflowPresenter.toTaskResponse(task);
  }

  @Post(':id/claim')
  @RequirePermissions('workflows.task.claim')
  @HttpCode(200)
  async claim(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<WorkflowTaskResponseDto> {
    const task = await this.taskService.claim(id, actor);
    return WorkflowPresenter.toTaskResponse(task);
  }

  @Post(':id/complete')
  @RequirePermissions('workflows.task.complete')
  @HttpCode(200)
  async complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteTaskDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<WorkflowTaskResponseDto> {
    const { task, instanceId } = await this.taskService.complete(id, {
      outcome: dto.outcome as HumanTaskOutcome,
      comment: dto.comment ?? null,
      actor,
    });
    // Advance the engine after task completion.
    await this.engine.advanceAfterTask({
      instanceId,
      task,
      outcome: dto.outcome as HumanTaskOutcome,
      actor,
      idempotencyKey: dto.idempotencyKey ?? null,
    });
    return WorkflowPresenter.toTaskResponse(task);
  }
}
