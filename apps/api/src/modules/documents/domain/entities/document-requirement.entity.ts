/**
 * Document requirement record — defines which document types are required for
 * each request type and subject type. Loaded at validation time during
 * submission.
 *
 * Spec ref: section 15.
 */

export interface DocumentRequirementProps {
  id: string;
  requestTypeId: string;
  documentTypeId: string;
  subjectType: 'REQUEST' | 'PERSON';
  isRequired: boolean;
  minFiles: number;
  maxFiles: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class DocumentRequirement {
  private constructor(private readonly props: DocumentRequirementProps) {}

  static reconstitute(props: DocumentRequirementProps): DocumentRequirement {
    return new DocumentRequirement(props);
  }

  get id(): string { return this.props.id; }
  get requestTypeId(): string { return this.props.requestTypeId; }
  get documentTypeId(): string { return this.props.documentTypeId; }
  get subjectType(): 'REQUEST' | 'PERSON' { return this.props.subjectType; }
  get isRequired(): boolean { return this.props.isRequired; }
  get minFiles(): number { return this.props.minFiles; }
  get maxFiles(): number { return this.props.maxFiles; }
  get isActive(): boolean { return this.props.isActive; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  toProps(): DocumentRequirementProps {
    return { ...this.props };
  }
}
