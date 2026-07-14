import { Module } from '@nestjs/common';
import { AuthorizedSignersController } from './presentation/controllers/authorized-signers.controller';
import { AuthorizedSignerService } from './application/authorized-signer.service';
import { AUTHORIZED_SIGNER_REPOSITORY } from './domain/repositories/authorized-signer.repository.port';
import {
  AuthorizedSignerMapper,
  AuthorizedSignerPrismaRepository,
} from './infrastructure/persistence/repositories/authorized-signer.repository.prisma';
import { PeopleModule } from '../people/people.module';

@Module({
  imports: [PeopleModule],
  controllers: [AuthorizedSignersController],
  providers: [
    AuthorizedSignerService,
    AuthorizedSignerMapper,
    {
      provide: AUTHORIZED_SIGNER_REPOSITORY,
      useClass: AuthorizedSignerPrismaRepository,
    },
  ],
  exports: [AuthorizedSignerService, AUTHORIZED_SIGNER_REPOSITORY],
})
export class AuthorizedSignersModule {}
