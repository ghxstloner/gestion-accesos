import { Module, forwardRef } from '@nestjs/common';
import { RequestsModule } from '../requests/requests.module';
import { WorkflowsModule } from '../workflows/workflows.module';
import { ReviewService } from './application/review.service';
import { ReviewsController } from './presentation/controllers/reviews.controller';
import { REVIEW_REPOSITORY_PROVIDER } from './infrastructure/persistence/repositories/review.repository.prisma';

@Module({
  imports: [
    RequestsModule,
    // forwardRef: ReviewService now depends on RequestWorkflowOrchestrator
    // (provided by WorkflowsModule), which in turn depends back on
    // RequestService / RequestWorkflowOrchestrator wiring that uses
    // forwardRef on both sides — same bidirectional pattern already in place
    // between RequestsModule and WorkflowsModule. NO additional cycle is
    // introduced: ReviewsModule simply joins the existing forwardRef graph
    // exactly like RequestsModule already does.
    forwardRef(() => WorkflowsModule),
  ],
  controllers: [ReviewsController],
  providers: [ReviewService, REVIEW_REPOSITORY_PROVIDER],
  exports: [ReviewService],
})
export class ReviewsModule {}
