/**
 * Immutable record of a single uploaded file version for a RequestDocument.
 *
 * Version numbers are monotonically increasing per parent document.
 *
 * Spec ref: section 15.
 */

export interface DocumentVersionProps {
  id: string;
  requestDocumentId: string;
  versionNumber: number;
  originalFilename: string;
  storedFilename: string;
  storageKey: string;
  mimeType: string;
  size: number;
  sha256: string;
  uploadedBy: string;
  uploadedAt: Date;
}

export class DocumentVersion {
  private constructor(private readonly props: DocumentVersionProps) {}

  static create(input: Omit<DocumentVersionProps, 'id' | 'uploadedAt'>, id: string): DocumentVersion {
    if (input.versionNumber < 1) {
      throw new RangeError('versionNumber must be >= 1');
    }
    if (input.size <= 0) {
      throw new RangeError('size must be positive');
    }
    if (!input.sha256 || input.sha256.length !== 64) {
      throw new RangeError('sha256 must be a 64-char hex string');
    }
    return new DocumentVersion({
      ...input,
      id,
      uploadedAt: new Date(),
    });
  }

  static reconstitute(props: DocumentVersionProps): DocumentVersion {
    return new DocumentVersion(props);
  }

  get id(): string { return this.props.id; }
  get requestDocumentId(): string { return this.props.requestDocumentId; }
  get versionNumber(): number { return this.props.versionNumber; }
  get originalFilename(): string { return this.props.originalFilename; }
  get storedFilename(): string { return this.props.storedFilename; }
  get storageKey(): string { return this.props.storageKey; }
  get mimeType(): string { return this.props.mimeType; }
  get size(): number { return this.props.size; }
  get sha256(): string { return this.props.sha256; }
  get uploadedBy(): string { return this.props.uploadedBy; }
  get uploadedAt(): Date { return this.props.uploadedAt; }

  toProps(): DocumentVersionProps {
    return { ...this.props };
  }
}
