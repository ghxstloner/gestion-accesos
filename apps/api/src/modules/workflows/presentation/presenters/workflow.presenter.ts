import {
  WorkflowDefinition,
  WorkflowVersion,
} from '../../domain/entities/workflow-definition.entity';
import {
  WorkflowInstance,
  WorkflowTask,
} from '../../domain/entities/workflow-instance.entity';
import {
  WorkflowDefinitionResponseDto,
  WorkflowInstanceResponseDto,
  WorkflowTaskResponseDto,
  WorkflowVersionResponseDto,
} from '../dto/workflow.dto';

export class WorkflowPresenter {
  static toDefinitionResponse(
    def: WorkflowDefinition,
  ): WorkflowDefinitionResponseDto {
    const p = def.toProps();
    return {
      id: p.id,
      key: p.key,
      name: p.name,
      description: p.description,
      requestType: p.requestType,
      status: p.status,
      createdByUserId: p.createdByUserId,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }

  static toVersionResponse(v: WorkflowVersion): WorkflowVersionResponseDto {
    const p = v.toProps();
    return {
      id: p.id,
      workflowDefinitionId: p.workflowDefinitionId,
      versionNumber: p.versionNumber,
      status: p.status,
      schemaVersion: p.schemaVersion,
      definitionJson: p.definitionJson,
      checksum: p.checksum,
      createdByUserId: p.createdByUserId,
      publishedByUserId: p.publishedByUserId,
      createdAt: p.createdAt,
      publishedAt: p.publishedAt,
    };
  }

  static toInstanceResponse(
    inst: WorkflowInstance,
  ): WorkflowInstanceResponseDto {
    const p = inst.toProps();
    return {
      id: p.id,
      requestId: p.requestId,
      workflowVersionId: p.workflowVersionId,
      status: p.status,
      contextJson: p.contextJson,
      startedAt: p.startedAt.toISOString(),
      completedAt: p.completedAt ? p.completedAt.toISOString() : null,
      cancelledAt: p.cancelledAt ? p.cancelledAt.toISOString() : null,
      lockVersion: p.lockVersion,
      currentNodeKey: p.currentNodeKey,
      autoTransitionCount: p.autoTransitionCount,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }

  static toTaskResponse(task: WorkflowTask): WorkflowTaskResponseDto {
    const p = task.toProps();
    return {
      id: p.id,
      workflowInstanceId: p.workflowInstanceId,
      nodeInstanceId: p.nodeInstanceId,
      status: p.status,
      assignmentType: p.assignmentType,
      assignedUserId: p.assignedUserId,
      assignedRoleCode: p.assignedRoleCode,
      assignedCompanyId: p.assignedCompanyId,
      claimedByUserId: p.claimedByUserId,
      outcome: p.outcome,
      comment: p.comment,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }
}
