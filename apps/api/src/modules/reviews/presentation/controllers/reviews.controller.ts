import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/presentation/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../../common/presentation/decorators/authenticated-user';
import { RequirePermissions } from '../../../../common/presentation/decorators/permissions.decorator';
import { ReviewService } from '../../application/review.service';
import type { ReviewTaskType } from '../../domain/review-state.policy';
import {
  AssignReviewTaskDto,
  CreateReviewTaskDto,
  ListReviewTasksDto,
  TransitionReviewTaskDto,
} from '../dto/review.dto';
import { ReviewPresenter } from '../presenters/review.presenter';
import { ReviewMapper } from '../../infrastructure/persistence/mappers/review.mapper';

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post()
  @RequirePermissions('requests.review')
  @ApiOperation({ summary: 'Create a review task for a request' })
  async create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateReviewTaskDto) {
    const task = await this.reviewService.create(actor, {
      requestId: dto.requestId,
      taskType: dto.taskType as ReviewTaskType,
      dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
      assignedRoleCode: dto.assignedRoleCode ?? null,
    });
    return ReviewPresenter.toResponse(ReviewMapper.toRecord(task));
  }

  @Get()
  @RequirePermissions('requests.review')
  @ApiOperation({ summary: 'List review tasks' })
  async list(@CurrentUser() actor: AuthenticatedUser, @Query() query: ListReviewTasksDto) {
    const page = await this.reviewService.list(
      actor,
      {
        requestId: query.requestId,
        status: query.status,
        assignedToUserId: query.assignedToUserId,
        assignedRoleCode: query.assignedRoleCode,
        taskType: query.taskType,
      },
      query.page ?? 1,
      query.pageSize ?? 20,
    );
    return {
      items: ReviewPresenter.toList(page.items),
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
    };
  }

  @Get('by-request/:requestId')
  @RequirePermissions('requests.review')
  @ApiOperation({ summary: 'List review tasks for a specific request' })
  async listByRequest(@CurrentUser() actor: AuthenticatedUser, @Param('requestId') requestId: string) {
    const tasks = await this.reviewService.listByRequest(actor, requestId);
    return ReviewPresenter.toList(tasks.map((t) => ReviewMapper.toRecord(t)));
  }

  @Get(':id')
  @RequirePermissions('requests.review')
  @ApiOperation({ summary: 'Get a review task by id' })
  async getById(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    const task = await this.reviewService.getById(actor, id);
    return ReviewPresenter.toResponse(ReviewMapper.toRecord(task));
  }

  @Post(':id/assign')
  @RequirePermissions('requests.review')
  @ApiOperation({ summary: 'Assign a review task (to caller or another user)' })
  async assign(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AssignReviewTaskDto,
  ) {
    const task = await this.reviewService.transition(actor, id, 'assign', {
      assignedToUserId: dto.assignedToUserId ?? null,
    });
    return ReviewPresenter.toResponse(ReviewMapper.toRecord(task));
  }

  @Post(':id/unassign')
  @RequirePermissions('requests.review')
  @ApiOperation({ summary: 'Unassign a review task' })
  async unassign(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    const task = await this.reviewService.transition(actor, id, 'unassign', {});
    return ReviewPresenter.toResponse(ReviewMapper.toRecord(task));
  }

  @Post(':id/approve-documents')
  @RequirePermissions('requests.review')
  @HttpCode(200)
  @ApiOperation({ summary: 'Approve documents stage (DOCUMENT_REVIEW task)' })
  async approveDocuments(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: TransitionReviewTaskDto,
  ) {
    const task = await this.reviewService.transition(actor, id, 'approve_documents', {
      comment: dto.comment ?? null,
      reasonCode: dto.reasonCode ?? null,
    });
    return ReviewPresenter.toResponse(ReviewMapper.toRecord(task));
  }

  @Post(':id/reject-documents')
  @RequirePermissions('requests.review')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reject documents stage (DOCUMENT_REVIEW task)' })
  async rejectDocuments(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: TransitionReviewTaskDto,
  ) {
    const task = await this.reviewService.transition(actor, id, 'reject_documents', {
      comment: dto.comment ?? null,
      reasonCode: dto.reasonCode ?? null,
    });
    return ReviewPresenter.toResponse(ReviewMapper.toRecord(task));
  }

  @Post(':id/approve-final')
  @RequirePermissions('requests.approve')
  @HttpCode(200)
  @ApiOperation({ summary: 'Final approval (FINAL_APPROVAL task)' })
  async approveFinal(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: TransitionReviewTaskDto,
  ) {
    const task = await this.reviewService.transition(actor, id, 'approve_final', {
      comment: dto.comment ?? null,
      reasonCode: dto.reasonCode ?? null,
    });
    return ReviewPresenter.toResponse(ReviewMapper.toRecord(task));
  }

  @Post(':id/return')
  @RequirePermissions('requests.return')
  @HttpCode(200)
  @ApiOperation({ summary: 'Return request to applicant for correction' })
  async returnForCorrection(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: TransitionReviewTaskDto,
  ) {
    const task = await this.reviewService.transition(actor, id, 'return', {
      comment: dto.comment ?? null,
      reasonCode: dto.reasonCode ?? null,
    });
    return ReviewPresenter.toResponse(ReviewMapper.toRecord(task));
  }

  @Post(':id/reject')
  @RequirePermissions('requests.reject')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reject a request' })
  async reject(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: TransitionReviewTaskDto,
  ) {
    const task = await this.reviewService.transition(actor, id, 'reject', {
      comment: dto.comment ?? null,
      reasonCode: dto.reasonCode ?? null,
    });
    return ReviewPresenter.toResponse(ReviewMapper.toRecord(task));
  }
}


