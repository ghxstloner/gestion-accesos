import { Module, forwardRef } from '@nestjs/common';
import { WorkflowDefinitionsController } from './presentation/controllers/workflow-definitions.controller';
import { WorkflowVersionsController } from './presentation/controllers/workflow-versions.controller';
import { WorkflowInstancesController } from './presentation/controllers/workflow-instances.controller';
import { WorkflowTasksController } from './presentation/controllers/workflow-tasks.controller';
import { WorkflowDefinitionService } from './application/workflow-definition.service';
import { WorkflowTaskService } from './application/workflow-task.service';
import { WorkflowEngineService } from './application/workflow-engine.service';
import {
  WORKFLOW_DEFINITION_REPOSITORY,
  WORKFLOW_VERSION_REPOSITORY,
} from './domain/repositories/workflow-definition.repository.port';
import { WORKFLOW_INSTANCE_REPOSITORY } from './domain/repositories/workflow-instance.repository.port';
import {
  WORKFLOW_DEFINITION_REPOSITORY_PROVIDER,
  WORKFLOW_VERSION_REPOSITORY_PROVIDER,
} from './infrastructure/persistence/repositories/workflow-definition.repository.prisma';
import { WORKFLOW_INSTANCE_REPOSITORY_PROVIDER } from './infrastructure/persistence/repositories/workflow-instance.repository.prisma';
import { RequestsModule } from '../requests/requests.module';

@Module({
  imports: [forwardRef(() => RequestsModule)],
  controllers: [
    WorkflowDefinitionsController,
    WorkflowVersionsController,
    WorkflowInstancesController,
    WorkflowTasksController,
  ],
  providers: [
    WorkflowDefinitionService,
    WorkflowTaskService,
    WorkflowEngineService,
    WORKFLOW_DEFINITION_REPOSITORY_PROVIDER,
    WORKFLOW_VERSION_REPOSITORY_PROVIDER,
    WORKFLOW_INSTANCE_REPOSITORY_PROVIDER,
  ],
  exports: [
    WorkflowDefinitionService,
    WorkflowTaskService,
    WorkflowEngineService,
    WORKFLOW_DEFINITION_REPOSITORY,
    WORKFLOW_VERSION_REPOSITORY,
    WORKFLOW_INSTANCE_REPOSITORY,
  ],
})
export class WorkflowsModule {}
