import { randomUUID } from 'crypto';
import { ValidationError } from '../../../../common/domain/errors/domain-error';

export type PersonStatus = 'ACTIVE' | 'INACTIVE';

export interface PersonProps {
  id: string;
  companyId: string;
  firstName: string;
  middleName: string | null;
  firstSurname: string;
  secondSurname: string | null;
  marriedSurname: string | null;
  identificationTypeId: string;
  identificationNumber: string;
  socialSecurityNumber: string | null;
  birthDate: Date | null;
  gender: string | null;
  maritalStatus: string | null;
  nationality: string | null;
  bloodType: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  residentialAddress: string | null;
  physicalCondition: string | null;
  department: string | null;
  position: string | null;
  yearsOfService: number | null;
  previouslyWorkedAtAirport: boolean;
  previousCompanyName: string | null;
  previouslyHadCredential: boolean;
  reusePreviousPhoto: boolean;
  photoUrl: string | null;
  status: PersonStatus;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PersonMutationInput {
  firstName?: string;
  middleName?: string | null;
  firstSurname?: string;
  secondSurname?: string | null;
  marriedSurname?: string | null;
  identificationTypeId?: string;
  identificationNumber?: string;
  socialSecurityNumber?: string | null;
  birthDate?: Date | null;
  gender?: string | null;
  maritalStatus?: string | null;
  nationality?: string | null;
  bloodType?: string | null;
  phone?: string | null;
  mobile?: string | null;
  email?: string | null;
  residentialAddress?: string | null;
  physicalCondition?: string | null;
  department?: string | null;
  position?: string | null;
  yearsOfService?: number | null;
  previouslyWorkedAtAirport?: boolean;
  previousCompanyName?: string | null;
  previouslyHadCredential?: boolean;
  reusePreviousPhoto?: boolean;
}

/** Normalizes identification numbers by trimming + collapsing internal whitespace + upper-casing. */
export function normalizeIdentificationNumber(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toUpperCase();
}

export class Person {
  private readonly _id: string;
  private _companyId: string;
  private _firstName: string;
  private _middleName: string | null;
  private _firstSurname: string;
  private _secondSurname: string | null;
  private _marriedSurname: string | null;
  private _identificationTypeId: string;
  private _identificationNumber: string;
  private _socialSecurityNumber: string | null;
  private _birthDate: Date | null;
  private _gender: string | null;
  private _maritalStatus: string | null;
  private _nationality: string | null;
  private _bloodType: string | null;
  private _phone: string | null;
  private _mobile: string | null;
  private _email: string | null;
  private _residentialAddress: string | null;
  private _physicalCondition: string | null;
  private _department: string | null;
  private _position: string | null;
  private _yearsOfService: number | null;
  private _previouslyWorkedAtAirport: boolean;
  private _previousCompanyName: string | null;
  private _previouslyHadCredential: boolean;
  private _reusePreviousPhoto: boolean;
  private _photoUrl: string | null;
  private _status: PersonStatus;
  private readonly _createdBy: string | null;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: PersonProps) {
    this._id = props.id;
    this._companyId = props.companyId;
    this._firstName = props.firstName;
    this._middleName = props.middleName;
    this._firstSurname = props.firstSurname;
    this._secondSurname = props.secondSurname;
    this._marriedSurname = props.marriedSurname;
    this._identificationTypeId = props.identificationTypeId;
    this._identificationNumber = props.identificationNumber;
    this._socialSecurityNumber = props.socialSecurityNumber;
    this._birthDate = props.birthDate;
    this._gender = props.gender;
    this._maritalStatus = props.maritalStatus;
    this._nationality = props.nationality;
    this._bloodType = props.bloodType;
    this._phone = props.phone;
    this._mobile = props.mobile;
    this._email = props.email;
    this._residentialAddress = props.residentialAddress;
    this._physicalCondition = props.physicalCondition;
    this._department = props.department;
    this._position = props.position;
    this._yearsOfService = props.yearsOfService;
    this._previouslyWorkedAtAirport = props.previouslyWorkedAtAirport;
    this._previousCompanyName = props.previousCompanyName;
    this._previouslyHadCredential = props.previouslyHadCredential;
    this._reusePreviousPhoto = props.reusePreviousPhoto;
    this._photoUrl = props.photoUrl;
    this._status = props.status;
    this._createdBy = props.createdBy;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  static create(input: {
    companyId: string;
    firstName: string;
    middleName?: string | null;
    firstSurname: string;
    secondSurname?: string | null;
    marriedSurname?: string | null;
    identificationTypeId: string;
    identificationNumber: string;
    socialSecurityNumber?: string | null;
    birthDate?: Date | null;
    gender?: string | null;
    maritalStatus?: string | null;
    nationality?: string | null;
    bloodType?: string | null;
    phone?: string | null;
    mobile?: string | null;
    email?: string | null;
    residentialAddress?: string | null;
    physicalCondition?: string | null;
    department?: string | null;
    position?: string | null;
    yearsOfService?: number | null;
    previouslyWorkedAtAirport?: boolean;
    previousCompanyName?: string | null;
    previouslyHadCredential?: boolean;
    reusePreviousPhoto?: boolean;
    photoUrl?: string | null;
    createdBy?: string | null;
  }): Person {
    if (!input.firstName?.trim())
      throw new ValidationError('firstName is required');
    if (!input.firstSurname?.trim())
      throw new ValidationError('firstSurname is required');
    if (!input.identificationNumber?.trim()) {
      throw new ValidationError('identificationNumber is required');
    }
    if (
      input.yearsOfService !== undefined &&
      input.yearsOfService !== null &&
      input.yearsOfService < 0
    ) {
      throw new ValidationError('yearsOfService must be >= 0');
    }
    if (
      input.email !== undefined &&
      input.email !== null &&
      input.email.trim()
    ) {
      Person.assertValidEmail(input.email);
    }
    return new Person({
      id: randomUUID(),
      companyId: input.companyId,
      firstName: input.firstName.trim(),
      middleName: input.middleName?.trim() || null,
      firstSurname: input.firstSurname.trim(),
      secondSurname: input.secondSurname?.trim() || null,
      marriedSurname: input.marriedSurname?.trim() || null,
      identificationTypeId: input.identificationTypeId,
      identificationNumber: normalizeIdentificationNumber(
        input.identificationNumber,
      ),
      socialSecurityNumber: input.socialSecurityNumber?.trim() || null,
      birthDate: input.birthDate ?? null,
      gender: input.gender ?? null,
      maritalStatus: input.maritalStatus ?? null,
      nationality: input.nationality ?? null,
      bloodType: input.bloodType ?? null,
      phone: input.phone ?? null,
      mobile: input.mobile ?? null,
      email: input.email?.toLowerCase().trim() || null,
      residentialAddress: input.residentialAddress ?? null,
      physicalCondition: input.physicalCondition ?? null,
      department: input.department ?? null,
      position: input.position ?? null,
      yearsOfService: input.yearsOfService ?? null,
      previouslyWorkedAtAirport: input.previouslyWorkedAtAirport ?? false,
      previousCompanyName: input.previousCompanyName ?? null,
      previouslyHadCredential: input.previouslyHadCredential ?? false,
      reusePreviousPhoto: input.reusePreviousPhoto ?? false,
      photoUrl: input.photoUrl ?? null,
      status: 'ACTIVE',
      createdBy: input.createdBy ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static reconstitute(props: PersonProps): Person {
    return new Person(props);
  }

  private static assertValidEmail(email: string): void {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      throw new ValidationError('email is not a valid format');
    }
  }

  get id(): string {
    return this._id;
  }
  get companyId(): string {
    return this._companyId;
  }
  get firstName(): string {
    return this._firstName;
  }
  get middleName(): string | null {
    return this._middleName;
  }
  get firstSurname(): string {
    return this._firstSurname;
  }
  get secondSurname(): string | null {
    return this._secondSurname;
  }
  get marriedSurname(): string | null {
    return this._marriedSurname;
  }
  get identificationTypeId(): string {
    return this._identificationTypeId;
  }
  get identificationNumber(): string {
    return this._identificationNumber;
  }
  get socialSecurityNumber(): string | null {
    return this._socialSecurityNumber;
  }
  get birthDate(): Date | null {
    return this._birthDate;
  }
  get gender(): string | null {
    return this._gender;
  }
  get maritalStatus(): string | null {
    return this._maritalStatus;
  }
  get nationality(): string | null {
    return this._nationality;
  }
  get bloodType(): string | null {
    return this._bloodType;
  }
  get phone(): string | null {
    return this._phone;
  }
  get mobile(): string | null {
    return this._mobile;
  }
  get email(): string | null {
    return this._email;
  }
  get residentialAddress(): string | null {
    return this._residentialAddress;
  }
  get physicalCondition(): string | null {
    return this._physicalCondition;
  }
  get department(): string | null {
    return this._department;
  }
  get position(): string | null {
    return this._position;
  }
  get yearsOfService(): number | null {
    return this._yearsOfService;
  }
  get previouslyWorkedAtAirport(): boolean {
    return this._previouslyWorkedAtAirport;
  }
  get previousCompanyName(): string | null {
    return this._previousCompanyName;
  }
  get previouslyHadCredential(): boolean {
    return this._previouslyHadCredential;
  }
  get reusePreviousPhoto(): boolean {
    return this._reusePreviousPhoto;
  }
  get status(): PersonStatus {
    return this._status;
  }
  get createdBy(): string | null {
    return this._createdBy;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }

  get fullName(): string {
    return [
      this._firstName,
      this._middleName,
      this._firstSurname,
      this._secondSurname,
      this._marriedSurname,
    ]
      .filter(Boolean)
      .join(' ');
  }

  /** Derived (not stored) — age in whole years from birthDate. */
  get age(): number | null {
    if (!this._birthDate) return null;
    const now = new Date();
    let age = now.getFullYear() - this._birthDate.getFullYear();
    const m = now.getMonth() - this._birthDate.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < this._birthDate.getDate())) age--;
    return Number.isFinite(age) ? age : null;
  }

  update(input: PersonMutationInput): void {
    if (input.firstName !== undefined) {
      if (!input.firstName.trim())
        throw new ValidationError('firstName cannot be empty');
      this._firstName = input.firstName.trim();
    }
    if (input.middleName !== undefined)
      this._middleName = input.middleName?.trim() || null;
    if (input.firstSurname !== undefined) {
      if (!input.firstSurname.trim())
        throw new ValidationError('firstSurname cannot be empty');
      this._firstSurname = input.firstSurname.trim();
    }
    if (input.secondSurname !== undefined)
      this._secondSurname = input.secondSurname?.trim() || null;
    if (input.marriedSurname !== undefined)
      this._marriedSurname = input.marriedSurname?.trim() || null;
    if (input.identificationTypeId !== undefined)
      this._identificationTypeId = input.identificationTypeId;
    if (input.identificationNumber !== undefined) {
      if (!input.identificationNumber.trim()) {
        throw new ValidationError('identificationNumber cannot be empty');
      }
      this._identificationNumber = normalizeIdentificationNumber(
        input.identificationNumber,
      );
    }
    if (input.socialSecurityNumber !== undefined)
      this._socialSecurityNumber = input.socialSecurityNumber?.trim() || null;
    if (input.birthDate !== undefined) this._birthDate = input.birthDate;
    if (input.gender !== undefined) this._gender = input.gender;
    if (input.maritalStatus !== undefined)
      this._maritalStatus = input.maritalStatus;
    if (input.nationality !== undefined) this._nationality = input.nationality;
    if (input.bloodType !== undefined) this._bloodType = input.bloodType;
    if (input.phone !== undefined) this._phone = input.phone;
    if (input.mobile !== undefined) this._mobile = input.mobile;
    if (input.email !== undefined) {
      const trimmed = input.email?.trim() ?? '';
      if (trimmed) Person.assertValidEmail(trimmed);
      this._email = trimmed ? trimmed.toLowerCase() : null;
    }
    if (input.residentialAddress !== undefined)
      this._residentialAddress = input.residentialAddress;
    if (input.physicalCondition !== undefined)
      this._physicalCondition = input.physicalCondition;
    if (input.department !== undefined) this._department = input.department;
    if (input.position !== undefined) this._position = input.position;
    if (input.yearsOfService !== undefined) {
      if (input.yearsOfService !== null && input.yearsOfService < 0) {
        throw new ValidationError('yearsOfService must be >= 0');
      }
      this._yearsOfService = input.yearsOfService;
    }
    if (input.previouslyWorkedAtAirport !== undefined)
      this._previouslyWorkedAtAirport = input.previouslyWorkedAtAirport;
    if (input.previousCompanyName !== undefined)
      this._previousCompanyName = input.previousCompanyName;
    if (input.previouslyHadCredential !== undefined)
      this._previouslyHadCredential = input.previouslyHadCredential;
    if (input.reusePreviousPhoto !== undefined)
      this._reusePreviousPhoto = input.reusePreviousPhoto;
    this._updatedAt = new Date();
  }

  activate(): void {
    if (this._status === 'ACTIVE') return;
    this._status = 'ACTIVE';
    this._updatedAt = new Date();
  }

  deactivate(): void {
    if (this._status === 'INACTIVE') return;
    this._status = 'INACTIVE';
    this._updatedAt = new Date();
  }

  toProps(): PersonProps {
    return {
      id: this._id,
      companyId: this._companyId,
      firstName: this._firstName,
      middleName: this._middleName,
      firstSurname: this._firstSurname,
      secondSurname: this._secondSurname,
      marriedSurname: this._marriedSurname,
      identificationTypeId: this._identificationTypeId,
      identificationNumber: this._identificationNumber,
      socialSecurityNumber: this._socialSecurityNumber,
      birthDate: this._birthDate,
      gender: this._gender,
      maritalStatus: this._maritalStatus,
      nationality: this._nationality,
      bloodType: this._bloodType,
      phone: this._phone,
      mobile: this._mobile,
      email: this._email,
      residentialAddress: this._residentialAddress,
      physicalCondition: this._physicalCondition,
      department: this._department,
      position: this._position,
      yearsOfService: this._yearsOfService,
      previouslyWorkedAtAirport: this._previouslyWorkedAtAirport,
      previousCompanyName: this._previousCompanyName,
      previouslyHadCredential: this._previouslyHadCredential,
      reusePreviousPhoto: this._reusePreviousPhoto,
      photoUrl: this._photoUrl,
      status: this._status,
      createdBy: this._createdBy,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }
}
