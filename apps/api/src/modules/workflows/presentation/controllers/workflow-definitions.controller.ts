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
import type {
  RequestType,
  WorkflowStatus,
} from '../../../../generated/prisma/client';
import { WorkflowDefinitionService } from '../../application/workflow-definition.service';
import { WorkflowPresenter } from '../presenters/workflow.presenter';
import {
  CreateWorkflowDefinitionDto,
  UpdateWorkflowDefinitionDto,
  WorkflowDefinitionResponseDto,
} from '../dto/workflow.dto';

@ApiTags('workflows')
@Controller('workflows/definitions')
export class WorkflowDefinitionsController {
  constructor(private readonly svc: WorkflowDefinitionService) {}

  @Post()
  @RequirePermissions('workflows.manage')
  async create(
    @Body() dto: CreateWorkflowDefinitionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<WorkflowDefinitionResponseDto> {
    return WorkflowPresenter.toDefinitionResponse(
      await this.svc.create(
        {
          key: dto.key,
          name: dto.name,
          description: dto.description ?? null,
          requestType: dto.requestType
            ? (dto.requestType as RequestType)
            : null,
        },
        actor,
      ),
    );
  }

  @Get()
  @RequirePermissions('workflows.read')
  async list(
    @Query('status') status?: string,
    @Query('requestType') requestType?: string,
    @Query('key') key?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<{
    items: WorkflowDefinitionResponseDto[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const result = await this.svc.list({
      status: status as WorkflowStatus | undefined,
      requestType: requestType as RequestType | undefined,
      key,
      search,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
    return {
      items: result.items.map((d) => WorkflowPresenter.toDefinitionResponse(d)),
      ...result,
    };
  }

  @Get(':id')
  @RequirePermissions('workflows.read')
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WorkflowDefinitionResponseDto> {
    return WorkflowPresenter.toDefinitionResponse(await this.svc.findById(id));
  }

  @Patch(':id')
  @RequirePermissions('workflows.manage')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkflowDefinitionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<WorkflowDefinitionResponseDto> {
    return WorkflowPresenter.toDefinitionResponse(
      await this.svc.update(id, dto, actor),
    );
  }

  @Post(':id/retire')
  @RequirePermissions('workflows.publish')
  @HttpCode(200)
  async retire(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<WorkflowDefinitionResponseDto> {
    return WorkflowPresenter.toDefinitionResponse(
      await this.svc.retire(id, actor),
    );
  }

  @Delete(':id')
  @RequirePermissions('workflows.manage')
  @HttpCode(204)
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    await this.svc.delete(id, actor);
  }
}
