import { Module } from '@nestjs/common';
import { RequestsModule } from '../requests/requests.module';
import { ReviewService } from './application/review.service';
import { ReviewsController } from './presentation/controllers/reviews.controller';
import { REVIEW_REPOSITORY_PROVIDER } from './infrastructure/persistence/repositories/review.repository.prisma';

@Module({
  imports: [RequestsModule],
  controllers: [ReviewsController],
  providers: [ReviewService, REVIEW_REPOSITORY_PROVIDER],
  exports: [ReviewService],
})
export class ReviewsModule {}
