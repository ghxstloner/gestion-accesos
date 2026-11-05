import { CompanyResponseDto } from '../dto/company.dto';
import { Company } from '../../domain/entities/company.entity';

export class CompanyPresenter {
  static toResponse(company: Company): CompanyResponseDto {
    const props = company.toProps();
    return {
      id: props.id,
      legalName: props.legalName,
      tradeName: props.tradeName,
      taxIdentifier: props.taxIdentifier,
      email: props.email,
      phone: props.phone,
      address: props.address,
      logoUrl: props.logoUrl,
      mainContactName: props.mainContactName,
      dv: props.dv,
      externalClientId: props.externalClientId,
      externalSource: props.externalSource,
      externalSyncedAt: props.externalSyncedAt,
      status: props.status,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    };
  }
}
