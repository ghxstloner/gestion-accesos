import { Inject, Injectable, forwardRef } from '@nestjs/common';
import {
  BusinessRuleError,
  ConflictError,
  NotFoundError,
} from '../../../common/domain/errors/domain-error';
import type { AuthenticatedUser } from '../../../common/presentation/decorators/authenticated-user';
import type { RequestType } from '../../../generated/prisma/client';
import { RequestService } from '../../requests/application/request.service';
import type { Request } from '../../requests/domain/entities/request.entity';
import type { RequestTransition } from '../../requests/domain/request-state.policy';
import {
  WorkflowInstance,
  WorkflowNodeInstance,
  WorkflowTask,
  WorkflowTransition,
  selectOutgoingEdge,
} from '../domain/entities/workflow-instance.entity';
import type { WorkflowVersion } from '../domain/entities/workflow-definition.entity';
import {
  WORKFLOW_DEFINITION_REPOSITORY,
  WORKFLOW_VERSION_REPOSITORY,
  type WorkflowDefinitionRepositoryPort,
  type WorkflowVersionRepositoryPort,
} from '../domain/repositories/workflow-definition.repository.port';
import {
  WORKFLOW_INSTANCE_REPOSITORY,
  type WorkflowExecutionCommit,
  type WorkflowInstanceRepositoryPort,
} from '../domain/repositories/workflow-instance.repository.port';
import { ConditionEvaluator } from '../domain/condition-evaluator';
import type {
  EvaluationContext,
  HumanTaskOutcome,
  WorkflowGraphDefinition,
  WorkflowNode,
} from '../domain/workflow-definition.types';

/**
 * Drives a Request through its assigned Workflow:
 *  - start: walks from START node, advancing through SYSTEM / DECISION auto-routes,
 *           pausing at HUMAN_TASK to create a WorkflowTask.
 *  - advanceAfterTask: after a task is completed (handled in WorkflowTaskService),
 *           picks the outgoing edge matching the outcome and continues.
 *
 * The engine commits executions as ONE atomic Prisma transaction with the
 * optimistic lock check on the instance. Auto-loops cap at MAX_AUTO_TRANSITIONS.
 */
@Injectable()
export class WorkflowEngineService {
  /** @internal exposed for controllers to look up request meta on start */
  readonly requests: RequestService;

  constructor(
    @Inject(WORKFLOW_DEFINITION_REPOSITORY)
    private readonly definitions: WorkflowDefinitionRepositoryPort,
    @Inject(WORKFLOW_VERSION_REPOSITORY)
    private readonly versions: WorkflowVersionRepositoryPort,
    @Inject(WORKFLOW_INSTANCE_REPOSITORY)
    private readonly instances: WorkflowInstanceRepositoryPort,
    @Inject(forwardRef(() => RequestService))
    requests: RequestService,
  ) {
    this.requests = requests;
  }

  /**
   * Start a workflow for a request. The startNode MUST be a START node unless
   * the graph auto-routes to a HUMAN_TASK (in which case a WorkflowTask is created).
   */
  async start(input: {
    requestId: string;
    requestType: RequestType;
    actor: AuthenticatedUser;
    /** extra context to seed the EvaluationContext beyond request defaults */
    contextPatch?: EvaluationContext;
    idempotencyKey?: string | null;
  }): Promise<WorkflowInstance> {
    const existing = await this.instances.findByRequestId(input.requestId);
    if (existing) {
      throw new ConflictError(
        `Request ${input.requestId} already has an active workflow ${existing.id}`,
      );
    }
    const found = await this.definitions.findPublishedForRequestType(
      input.requestType,
    );
    if (!found || !found.publishedVersion) {
      throw new BusinessRuleError(
        `No PUBLISHED workflow for requestType ${input.requestType}`,
      );
    }
    const { publishedVersion } = found;

    // Build initial context: company + request basic facts.
    const req = await this.requests.getById(input.actor, input.requestId);
    const ctx = this.buildInitialContext(req);
    if (input.contextPatch) {
      Object.assign(ctx, input.contextPatch);
    }

    // Locate START node
    const startNode = this.mustFindNode(
      publishedVersion,
      (n) => n.type === 'START',
      'START',
    );
    const instance = WorkflowInstance.start({
      requestId: input.requestId,
      workflowVersionId: publishedVersion.id,
      context: ctx,
      startNodeKey: startNode.key,
    });
    await this.instances.save(instance);

    // Walk forward — visit START, then advance.
    return this.runFromNode(instance, publishedVersion, startNode, ctx, {
      actor: input.actor,
      idempotencyKey: input.idempotencyKey ?? null,
    });
  }

  /**
   * After a HUMAN_TASK is completed, advance the instance forward.
   * Caller passes the outcome that the actor chose.
   */
  async advanceAfterTask(input: {
    instanceId: string;
    task: WorkflowTask;
    outcome: HumanTaskOutcome;
    actor: AuthenticatedUser;
    idempotencyKey?: string | null;
  }): Promise<WorkflowInstance> {
    const instance = await this.requireInstance(input.instanceId);
    const version = await this.requireVersion(instance.workflowVersionId);
    const nodeInstance = await this.findNodeInstanceForTask(
      instance.id,
      input.task,
    );
    const currentNode = this.mustFindNode(
      version,
      (n) => n.key === nodeInstance.nodeKey,
      nodeInstance.nodeKey,
    );
    return this.runFromNode(
      instance,
      version,
      currentNode,
      instance.contextJson,
      {
        actor: input.actor,
        triggerOutcome: input.outcome,
        triggerTask: input.task,
        idempotencyKey: input.idempotencyKey ?? null,
      },
    );
  }

  /* ── Internals ── */

  private async runFromNode(
    instance: WorkflowInstance,
    version: WorkflowVersion,
    node: WorkflowNode,
    ctx: EvaluationContext,
    options: {
      actor: AuthenticatedUser;
      triggerOutcome?: HumanTaskOutcome;
      triggerTask?: WorkflowTask;
      idempotencyKey?: string | null;
    },
  ): Promise<WorkflowInstance> {
    const graph = version.definitionJson;
    const createdNodes: WorkflowNodeInstance[] = [];
    const createdTasks: WorkflowTask[] = [];
    const transitions: WorkflowTransition[] = [];

    let currentNode: WorkflowNode = node;
    const currentInstance = instance;
    let lockVersion = currentInstance.lockVersion;

    // Process current node
    let iter = 0;
    // We allow up to MAX_AUTO_TRANSITIONS iterations of automatic advancement.
    while (iter < 25) {
      iter++;
      const nodeInst = WorkflowNodeInstance.create({
        workflowInstanceId: currentInstance.id,
        nodeKey: currentNode.key,
        nodeType: currentNode.type,
        inputJson: { ...ctx },
      });
      nodeInst.start();

      if (currentNode.type === 'END') {
        nodeInst.complete({ status: 'COMPLETED' });
        createdNodes.push(nodeInst);
        currentInstance.complete();
        lockVersion = currentInstance.lockVersion;
        break;
      }

      if (currentNode.type === 'HUMAN_TASK') {
        // Re-entry distinction: if this run is advancing past an already-completed
        // task (driven by triggerOutcome), we should NOT create a new node
        // instance or pause — we just consume the outgoing edge whose action
        // equals the outcome and continue the loop.
        if (options.triggerTask && options.triggerOutcome) {
          const next = selectOutgoingEdge({
            graph,
            from: currentNode.key,
            action: options.triggerOutcome,
            ctx,
          });
          transitions.push(
            WorkflowTransition.record({
              workflowInstanceId: currentInstance.id,
              sourceNodeKey: currentNode.key,
              targetNodeKey: next.to,
              action: options.triggerOutcome,
              actorUserId: options.actor.userId,
              taskId: options.triggerTask.id,
              idempotencyKey: options.idempotencyKey ?? null,
              metadata: { condition: next.condition ?? null, automatic: true },
            }),
          );
          currentInstance.advanceTo(next.to, lockVersion, {
            automatic: true,
          });
          lockVersion = currentInstance.lockVersion;
          currentNode = this.mustFindNode(
            version,
            (n) => n.key === next.to,
            next.to,
          );
          continue;
        }
        // Cold path: HUMAN_TASK reached from a fresh start — record node, then
        // pause and emit a task to be claimed/completed later.
        nodeInst.complete();
        createdNodes.push(nodeInst);
        const task = WorkflowTask.create({
          workflowInstanceId: currentInstance.id,
          nodeInstanceId: nodeInst.id,
          assignment: currentNode.assignment ?? {
            type: 'ROLE',
            roleCode: 'COMPANY_ADMIN',
          },
          companyId: (ctx.company?.id as string | undefined) ?? null,
        });
        createdTasks.push(task);
        break;
      }

      if (currentNode.type === 'SYSTEM') {
        nodeInst.complete();
        createdNodes.push(nodeInst);
        await this.runSystemAction(currentNode, currentInstance, options.actor);
        // Continue to next node via the implicit 'COMPLETE' action.
        const next = selectOutgoingEdge({
          graph,
          from: currentNode.key,
          action: 'COMPLETE',
          ctx,
        });
        transitions.push(
          WorkflowTransition.record({
            workflowInstanceId: currentInstance.id,
            sourceNodeKey: currentNode.key,
            targetNodeKey: next.to,
            action: 'COMPLETE',
            actorUserId: null,
            idempotencyKey: null,
            metadata: { condition: next.condition ?? null, automatic: true },
          }),
        );
        currentInstance.advanceTo(next.to, lockVersion, {
          automatic: true,
        });
        lockVersion = currentInstance.lockVersion;
        currentNode = this.mustFindNode(
          version,
          (n) => n.key === next.to,
          next.to,
        );
        continue;
      }

      if (currentNode.type === 'DECISION') {
        nodeInst.complete();
        createdNodes.push(nodeInst);
        // DECISION uses the 'EVALUATE' action — outgoing edge whose condition matches.
        const next = selectOutgoingEdge({
          graph,
          from: currentNode.key,
          action: 'EVALUATE',
          ctx,
        });
        transitions.push(
          WorkflowTransition.record({
            workflowInstanceId: currentInstance.id,
            sourceNodeKey: currentNode.key,
            targetNodeKey: next.to,
            action: 'EVALUATE',
            actorUserId: null,
            idempotencyKey: null,
            metadata: { condition: next.condition ?? null, automatic: true },
          }),
        );
        currentInstance.advanceTo(next.to, lockVersion, {
          automatic: true,
        });
        lockVersion = currentInstance.lockVersion;
        currentNode = this.mustFindNode(
          version,
          (n) => n.key === next.to,
          next.to,
        );
        continue;
      }

      if (currentNode.type === 'START') {
        nodeInst.complete();
        createdNodes.push(nodeInst);
        // START uses the implicit 'BEGIN' action to leave the node.
        const next = selectOutgoingEdge({
          graph,
          from: currentNode.key,
          action: 'BEGIN',
          ctx,
        });
        transitions.push(
          WorkflowTransition.record({
            workflowInstanceId: currentInstance.id,
            sourceNodeKey: currentNode.key,
            targetNodeKey: next.to,
            action: 'BEGIN',
            actorUserId: options.actor.userId,
            idempotencyKey: options.idempotencyKey ?? null,
            metadata: { automatic: true },
          }),
        );
        currentInstance.advanceTo(next.to, lockVersion, {
          automatic: true,
        });
        lockVersion = currentInstance.lockVersion;
        currentNode = this.mustFindNode(
          version,
          (n) => n.key === next.to,
          next.to,
        );
        continue;
      }

      // Unknown node type — fail-safe.
      nodeInst.fail('UNSUPPORTED_NODE_TYPE', currentNode.type);
      createdNodes.push(nodeInst);
      currentInstance.fail();
      lockVersion = currentInstance.lockVersion;
      break;
    }

    // Atomic commit with optimistic lock + idempotency.
    const commit: WorkflowExecutionCommit = {
      instance: currentInstance,
      expectedLockVersion: instance.lockVersion,
      nodeInstances: createdNodes,
      tasks: createdTasks,
      transitions,
      idempotencyKey: options.idempotencyKey ?? null,
    };
    return this.instances.commitExecution(commit);
  }

  private async runSystemAction(
    node: WorkflowNode,
    instance: WorkflowInstance,
    actor: AuthenticatedUser,
  ): Promise<void> {
    const action = node.config?.systemAction ?? 'NOOP';
    if (action === 'NOOP') return;
    if (action === 'UPDATE_REQUEST_STATUS') {
      const target = node.config?.targetRequestStatus;
      if (!target) {
        throw new BusinessRuleError(
          `SYSTEM node ${node.key} UPDATE_REQUEST_STATUS requires config.targetRequestStatus`,
        );
      }
      // Map common workflow target statuses to a RequestTransition.
      const transition = this.mapStatusToTransition(target);
      if (!transition) {
        throw new BusinessRuleError(
          `Cannot map target request status '${target}' to a transition`,
        );
      }
      await this.requests.transition(actor, {
        requestId: instance.requestId,
        transition,
        comment: `Workflow ${instance.id} advanced to ${target}`,
      });
      return;
    }
    // Future-proof: unknown actions are no-ops by default.
  }

  private mapStatusToTransition(target: string): RequestTransition | null {
    switch (target) {
      case 'SUBMITTED':
        return 'submit';
      case 'CANCELLED':
        return 'cancel';
      case 'REJECTED':
        return 'reject';
      case 'RETURNED_FOR_CORRECTION':
        return 'return';
      case 'APPROVED':
        return 'approve_final';
      case 'RESUBMITTED':
        return 'resubmit';
      default:
        return null;
    }
  }

  private buildInitialContext(req: Request): EvaluationContext {
    return {
      request: {
        id: req.id,
        requestNumber: req.requestNumber,
        status: req.status,
        companyId: req.companyId,
        requestTypeId: req.requestTypeId,
        requestTypeCode: req.requestTypeCode,
      },
      company: { id: req.companyId },
      creatorUser: { id: req.createdByUserId },
    };
  }

  private mustFindNode(
    version: WorkflowVersion,
    predicate: (n: WorkflowNode) => boolean,
    label: string,
  ): WorkflowNode {
    const node = version.definitionJson.nodes.find(predicate);
    if (!node) {
      throw new BusinessRuleError(
        `Workflow ${version.id} has no node matching '${label}'`,
      );
    }
    return node;
  }

  private async requireInstance(id: string): Promise<WorkflowInstance> {
    const inst = await this.instances.findById(id);
    if (!inst) throw new NotFoundError('WorkflowInstance', id);
    return inst;
  }

  private async requireVersion(versionId: string): Promise<WorkflowVersion> {
    const v = await this.versions.findById(versionId);
    if (!v) throw new NotFoundError('WorkflowVersion', versionId);
    return v;
  }

  private async findNodeInstanceForTask(
    instanceId: string,
    task: WorkflowTask,
  ): Promise<WorkflowNodeInstance> {
    const nodes = await this.instances.findNodeInstances(instanceId);
    const n = nodes.find((x) => x.id === task.nodeInstanceId);
    if (!n) {
      throw new NotFoundError('WorkflowNodeInstance', task.nodeInstanceId);
    }
    return n;
  }
}

/** Kept for type re-export convenience. */
export const _ConditionEvaluator = ConditionEvaluator;
export type _WorkflowGraphDefinition = WorkflowGraphDefinition;
