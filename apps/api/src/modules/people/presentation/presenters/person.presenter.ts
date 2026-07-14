import { Person } from '../../domain/entities/person.entity';
import { PersonResponseDto } from '../dto/person.dto';

export class PersonPresenter {
  static toResponse(
    person: Person,
    extras?: { identificationTypeCode?: string },
  ): PersonResponseDto {
    const p = person.toProps();
    return {
      id: p.id,
      companyId: p.companyId,
      firstName: p.firstName,
      middleName: p.middleName,
      firstSurname: p.firstSurname,
      secondSurname: p.secondSurname,
      marriedSurname: p.marriedSurname,
      identificationTypeId: p.identificationTypeId,
      identificationTypeCode: extras?.identificationTypeCode,
      identificationNumber: p.identificationNumber,
      socialSecurityNumber: p.socialSecurityNumber,
      birthDate: p.birthDate ? p.birthDate.toISOString() : null,
      gender: p.gender,
      maritalStatus: p.maritalStatus,
      nationality: p.nationality,
      bloodType: p.bloodType,
      phone: p.phone,
      mobile: p.mobile,
      email: p.email,
      residentialAddress: p.residentialAddress,
      physicalCondition: p.physicalCondition,
      department: p.department,
      position: p.position,
      yearsOfService: p.yearsOfService,
      previouslyWorkedAtAirport: p.previouslyWorkedAtAirport,
      previousCompanyName: p.previousCompanyName,
      previouslyHadCredential: p.previouslyHadCredential,
      reusePreviousPhoto: p.reusePreviousPhoto,
      status: p.status,
      createdBy: p.createdBy,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      age: person.age,
      fullName: person.fullName,
    };
  }
}
