import { Module } from '@nestjs/common';
import { PeopleController } from './presentation/controllers/people.controller';
import { PersonService } from './application/person.service';
import { PERSON_REPOSITORY } from './domain/repositories/person.repository.port';
import {
  PersonMapper,
  PersonPrismaRepository,
} from './infrastructure/persistence/repositories/person.repository.prisma';
import { CatalogsModule } from '../catalogs/catalogs.module';

@Module({
  imports: [CatalogsModule],
  controllers: [PeopleController],
  providers: [
    PersonService,
    PersonMapper,
    { provide: PERSON_REPOSITORY, useClass: PersonPrismaRepository },
  ],
  exports: [PersonService, PERSON_REPOSITORY],
})
export class PeopleModule {}
