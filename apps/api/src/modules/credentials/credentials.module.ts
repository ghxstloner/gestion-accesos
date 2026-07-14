import { Module } from '@nestjs/common';
import { RequestsModule } from '../requests/requests.module';
import { CredentialService } from './application/credential.service';
import { CredentialsController } from './presentation/controllers/credentials.controller';
import { CREDENTIAL_REPOSITORY_PROVIDER } from './infrastructure/persistence/repositories/credential.repository.prisma';

@Module({
  imports: [RequestsModule],
  controllers: [CredentialsController],
  providers: [CredentialService, CREDENTIAL_REPOSITORY_PROVIDER],
  exports: [CredentialService],
})
export class CredentialsModule {}
