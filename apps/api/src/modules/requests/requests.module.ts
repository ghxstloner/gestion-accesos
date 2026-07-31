import { Module, forwardRef } from '@nestjs/common';
import { CatalogsModule } from '../catalogs/catalogs.module';
import { IdentityModule } from '../identity/identity.module';
import { AuthorizedSignersModule } from '../authorized-signers/authorized-signers.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WorkflowsModule } from '../workflows/workflows.module';
import { RequestService } from './application/request.service';
import { RequestsController } from './presentation/controllers/requests.controller';
import { REQUEST_REPOSITORY_PROVIDER } from './infrastructure/persistence/repositories/request.repository.prisma';
import { REQUEST_EVENT_REPOSITORY_PROVIDER } from './infrastructure/persistence/repositories/request-event.repository.prisma';
import { REQUEST_SUBMISSION_REPOSITORY_PROVIDER } from './infrastructure/persistence/repositories/request-submission.repository.prisma';

@Module({
  imports: [
    CatalogsModule,
    IdentityModule,
    AuthorizedSignersModule,
    NotificationsModule,
    // forwardRef: WorkflowsModule (which hosts RequestWorkflowOrchestrator)
    // depends back on RequestsModule via the engine; both sides use forwardRef
    // to break the cycle.
    forwardRef(() => WorkflowsModule),
  ],
  controllers: [RequestsController],
  providers: [
    RequestService,
    REQUEST_REPOSITORY_PROVIDER,
    REQUEST_EVENT_REPOSITORY_PROVIDER,
    REQUEST_SUBMISSION_REPOSITORY_PROVIDER,
  ],
  exports: [RequestService],
})
export class RequestsModule {}
