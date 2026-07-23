import { Inject, Injectable } from '@nestjs/common';
import {
  BusinessRuleError,
  NotFoundError,
} from '../../../common/domain/errors/domain-error';
import type { AuthenticatedUser } from '../../../common/presentation/decorators/authenticated-user';
import type { HumanTaskOutcome } from '../domain/workflow-definition.types';
import {
  WORKFLOW_INSTANCE_REPOSITORY,
  type WorkflowInstanceRepositoryPort,
  type WorkflowTaskListFilters,
} from '../domain/repositories/workflow-instance.repository.port';
import type { WorkflowTask } from '../domain/entities/workflow-instance.entity';

const ANY = Symbol('any');

@Injectable()
export class WorkflowTaskService {
  constructor(
    @Inject(WORKFLOW_INSTANCE_REPOSITORY)
    private readonly instances: WorkflowInstanceRepositoryPort,
  ) {}

  /**
   * Claim a task: locks it for the requesting user.
   * Permitted when:
   *  - task is PENDING
   *  - actor matches assignment (ROLE/USER/COMPANY)
   *  - actor does not already have too many (no limit here for now)
   * A USER-assigned task auto-claims on creation — caller should not call claim again.
   */
  async claim(taskId: string, actor: AuthenticatedUser): Promise<WorkflowTask> {
    const found = await this.instances.findTaskById(taskId);
    if (!found) throw new NotFoundError('WorkflowTask', taskId);
    const { task, instance } = found;
    if (instance.status !== 'ACTIVE') {
      throw new BusinessRuleError(
        `Cannot claim task on a ${instance.status} instance`,
      );
    }
    task.claim({
      userId: actor.userId,
      roles: actor.roles,
      companyId: actor.companyId ?? null,
    });
    await this.instances.saveTask(task);
    return task;
  }

  /**
   * Complete a human task with an outcome. The engine is then notified to
   * advance the instance (caller should call WorkflowEngineService.advance
   * after this returns, or rely on the controller to chain).
   */
  async complete(
    taskId: string,
    input: {
      outcome: HumanTaskOutcome;
      comment?: string | null;
      actor: AuthenticatedUser;
    },
  ): Promise<{ task: WorkflowTask; instanceId: string }> {
    const found = await this.instances.findTaskById(taskId);
    if (!found) throw new NotFoundError('WorkflowTask', taskId);
    const { task, instance } = found;
    if (instance.status !== 'ACTIVE') {
      throw new BusinessRuleError(
        `Cannot complete task on a ${instance.status} instance`,
      );
    }
    task.complete({
      actor: {
        userId: input.actor.userId,
        roles: input.actor.roles,
        companyId: input.actor.companyId ?? null,
      },
      outcome: input.outcome,
      comment: input.comment ?? null,
    });
    await this.instances.saveTask(task);
    return { task, instanceId: instance.id };
  }

  async findById(
    taskId: string,
  ): Promise<{ task: WorkflowTask; instanceId: string }> {
    const found = await this.instances.findTaskById(taskId);
    if (!found) throw new NotFoundError('WorkflowTask', taskId);
    return { task: found.task, instanceId: found.instance.id };
  }

  async list(
    filters: WorkflowTaskListFilters,
    page: { page: number; pageSize: number },
    actor: AuthenticatedUser,
  ) {
    return this.instances.listTasks(filters, page, actor.companyId ?? null);
  }

  /** used internally by tests, accessible via Symbol */
  static readonly ACTOR_ANY = ANY;
}
