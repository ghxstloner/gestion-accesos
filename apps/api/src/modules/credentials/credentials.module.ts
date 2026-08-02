import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { DocumentsModule } from '../documents/documents.module';
import { RequestsModule } from '../requests/requests.module';
import { CredentialService } from './application/credential.service';
import { CredentialsController } from './presentation/controllers/credentials.controller';
import { CustodyController } from './presentation/controllers/custody.controller';
import { CREDENTIAL_REPOSITORY_PROVIDER } from './infrastructure/persistence/repositories/credential.repository.prisma';

@Module({
  imports: [RequestsModule, AuditModule, DocumentsModule],
  controllers: [CredentialsController, CustodyController],
  providers: [CredentialService, CREDENTIAL_REPOSITORY_PROVIDER],
  exports: [CredentialService],
})
export class CredentialsModule {}
