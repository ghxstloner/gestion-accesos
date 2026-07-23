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
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../../../common/presentation/decorators/permissions.decorator';
import { CurrentUser } from '../../../../common/presentation/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../../common/presentation/decorators/authenticated-user';
import type { WorkflowGraphDefinition } from '../../domain/workflow-definition.types';
import { WorkflowDefinitionService } from '../../application/workflow-definition.service';
import { WorkflowPresenter } from '../presenters/workflow.presenter';
import {
  CreateWorkflowVersionDto,
  UpdateWorkflowVersionDto,
  WorkflowVersionResponseDto,
} from '../dto/workflow.dto';

@ApiTags('workflows')
@Controller('workflows/definitions/:definitionId/versions')
export class WorkflowVersionsController {
  constructor(private readonly svc: WorkflowDefinitionService) {}

  @Post()
  @RequirePermissions('workflows.manage')
  async createDraft(
    @Param('definitionId', ParseUUIDPipe) definitionId: string,
    @Body() dto: CreateWorkflowVersionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<WorkflowVersionResponseDto> {
    return WorkflowPresenter.toVersionResponse(
      await this.svc.createDraft(
        definitionId,
        {
          definitionJson:
            dto.definitionJson as unknown as WorkflowGraphDefinition,
        },
        actor,
      ),
    );
  }

  @Get()
  @RequirePermissions('workflows.read')
  async list(
    @Param('definitionId', ParseUUIDPipe) definitionId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<{
    items: WorkflowVersionResponseDto[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const result = await this.svc.listVersions(definitionId, {
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
    return {
      items: result.items.map((v) => WorkflowPresenter.toVersionResponse(v)),
      ...result,
    };
  }

  @Get(':versionId')
  @RequirePermissions('workflows.read')
  async getById(
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ): Promise<WorkflowVersionResponseDto> {
    return WorkflowPresenter.toVersionResponse(
      await this.svc.findVersionById(versionId),
    );
  }

  @Patch(':versionId')
  @RequirePermissions('workflows.manage')
  async updateDraft(
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Body() dto: UpdateWorkflowVersionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<WorkflowVersionResponseDto> {
    return WorkflowPresenter.toVersionResponse(
      await this.svc.updateDraft(
        versionId,
        {
          definitionJson:
            dto.definitionJson as unknown as WorkflowGraphDefinition,
        },
        actor,
      ),
    );
  }

  @Post(':versionId/publish')
  @RequirePermissions('workflows.publish')
  @HttpCode(200)
  async publish(
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<WorkflowVersionResponseDto> {
    return WorkflowPresenter.toVersionResponse(
      await this.svc.publish(versionId, actor),
    );
  }

  @Post(':versionId/retire')
  @RequirePermissions('workflows.publish')
  @HttpCode(200)
  async retire(
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<WorkflowVersionResponseDto> {
    return WorkflowPresenter.toVersionResponse(
      await this.svc.retireVersion(versionId, actor),
    );
  }

  @Delete(':versionId')
  @RequirePermissions('workflows.manage')
  @HttpCode(204)
  async deleteDraft(
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    await this.svc.deleteDraft(versionId, actor);
  }
}
