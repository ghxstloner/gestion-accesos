import type {
  RequestType,
  WorkflowStatus,
} from '@prisma/client';
import type {
  WorkflowDefinition,
  WorkflowVersion,
} from '../entities/workflow-definition.entity';

export const WORKFLOW_DEFINITION_REPOSITORY = Symbol(
  'WORKFLOW_DEFINITION_REPOSITORY',
);
export const WORKFLOW_VERSION_REPOSITORY = Symbol(
  'WORKFLOW_VERSION_REPOSITORY',
);

export interface WorkflowDefinitionListFilters {
  status?: WorkflowStatus;
  requestType?: RequestType;
  key?: string;
  search?: string;
}

export interface PageInput {
  page: number;
  pageSize: number;
}

export interface WorkflowDefinitionListPage {
  items: WorkflowDefinition[];
  total: number;
  page: number;
  pageSize: number;
}

export interface WorkflowDefinitionRepositoryPort {
  findById(id: string): Promise<WorkflowDefinition | null>;
  findByKey(key: string): Promise<WorkflowDefinition | null>;
  findLatestVersionPerDefinition(
    filters: WorkflowDefinitionListFilters,
  ): Promise<WorkflowDefinition[]>;
  findPublishedForRequestType(requestType: RequestType): Promise<{
    definition: WorkflowDefinition;
    publishedVersion: WorkflowVersion | null;
  } | null>;
  list(
    filters: WorkflowDefinitionListFilters,
    page: PageInput,
  ): Promise<WorkflowDefinitionListPage>;
  save(definition: WorkflowDefinition): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface WorkflowVersionListFilters {
  workflowDefinitionId?: string;
  status?: WorkflowStatus;
}

export interface WorkflowVersionListPage {
  items: WorkflowVersion[];
  total: number;
  page: number;
  pageSize: number;
}

export interface WorkflowVersionRepositoryPort {
  findById(id: string): Promise<WorkflowVersion | null>;
  findByChecksum(
    workflowDefinitionId: string,
    checksum: string,
  ): Promise<WorkflowVersion | null>;
  findLatestForDefinition(
    workflowDefinitionId: string,
  ): Promise<WorkflowVersion | null>;
  findPublishedForDefinition(
    workflowDefinitionId: string,
  ): Promise<WorkflowVersion | null>;
  findPublishedForRequestType(
    requestType: RequestType,
  ): Promise<WorkflowVersion | null>;
  list(
    filters: WorkflowVersionListFilters,
    page: PageInput,
  ): Promise<WorkflowVersionListPage>;
  save(version: WorkflowVersion): Promise<void>;
  /** Delete a DRAFT version. Throws if version not DRAFT. */
  deleteDraft(id: string, actorUserId: string): Promise<void>;
}
