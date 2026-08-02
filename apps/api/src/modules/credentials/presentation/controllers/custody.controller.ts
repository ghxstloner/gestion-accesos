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
import { AuthenticatedUser } from '../../../../common/presentation/decorators/authenticated-user';
import { CurrentUser } from '../../../../common/presentation/decorators/current-user.decorator';
import { RequirePermissions } from '../../../../common/presentation/decorators/permissions.decorator';
import { CredentialService } from '../../application/credential.service';
import {
  DepositCustodyDto,
  ListCustodyDto,
  ReturnCustodyDto,
} from '../dto/credential.dto';
import { CustodyPresenter } from '../presenters/credential.presenter';

@ApiTags('custody')
@Controller('custody')
export class CustodyController {
  constructor(private readonly credentialService: CredentialService) {}

  @Get()
  @RequirePermissions('issuance.read')
  @ApiOperation({ summary: 'List custody records (operational queue)' })
  async list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListCustodyDto,
  ) {
    const page = await this.credentialService.listCustody(
      actor,
      {
        status: query.status,
        subjectUserId: query.subjectUserId,
        search: query.search,
      },
      query.page ?? 1,
      query.pageSize ?? 20,
    );
    return {
      items: page.items.map((r) =>
        CustodyPresenter.toResponse(
          r,
          this.credentialService.computeCustodyStatus(r),
        ),
      ),
      total: page.total,
    };
  }

  @Get('by-credential/:credentialId')
  @RequirePermissions('issuance.read')
  @ApiOperation({ summary: 'Find custody record by credential id' })
  async getByCredential(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('credentialId') credentialId: string,
  ) {
    const record = await this.credentialService.getCustodyByCredential(
      actor,
      credentialId,
    );
    return record
      ? CustodyPresenter.toResponse(
          record,
          this.credentialService.computeCustodyStatus(record),
        )
      : null;
  }

  @Get(':id')
  @RequirePermissions('issuance.read')
  @ApiOperation({ summary: 'Get a custody record by id' })
  async getById(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const record = await this.credentialService.getCustody(actor, id);
    return CustodyPresenter.toResponse(
      record,
      this.credentialService.computeCustodyStatus(record),
    );
  }

  @Post()
  @RequirePermissions('issuance.manage')
  @HttpCode(200)
  @ApiOperation({ summary: 'Register identity document received in custody' })
  async deposit(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: DepositCustodyDto,
  ) {
    const record = await this.credentialService.depositCustody(actor, {
      credentialId: dto.credentialId,
      holderName: dto.holderName ?? null,
      documentType: dto.documentType,
      documentIdentifier: dto.documentIdentifier,
      temporaryPermitRef: dto.temporaryPermitRef ?? null,
      expectedReturnAt: dto.expectedReturnAt
        ? new Date(dto.expectedReturnAt)
        : null,
      notes: dto.notes ?? null,
    });
    return CustodyPresenter.toResponse(
      record,
      this.credentialService.computeCustodyStatus(record),
    );
  }

  @Post(':id/return')
  @RequirePermissions('issuance.manage')
  @HttpCode(200)
  @ApiOperation({ summary: 'Register the return of a custody record' })
  async returnRecord(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReturnCustodyDto,
  ) {
    const record = await this.credentialService.returnCustody(actor, {
      custodyId: id,
      returnReceivedBy: dto.returnReceivedBy,
      returnCondition: dto.returnCondition ?? null,
      notes: dto.notes ?? null,
    });
    return CustodyPresenter.toResponse(
      record,
      this.credentialService.computeCustodyStatus(record),
    );
  }
}
