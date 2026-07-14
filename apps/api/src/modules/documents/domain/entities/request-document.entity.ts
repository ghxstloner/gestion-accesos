/**
 * Aggregate root for a single document type slot within a Request (e.g.
 * "Police record for primary applicant"). Owns its immutable version history.
 *
 * Spec ref: section 15.
 */

import {
  BusinessRuleError,
  NotFoundError,
} from '../../../../common/domain/errors/domain-error';
import type { DocumentVersion } from './document-version.entity';

export type DocumentStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REPLACED';

export type DocumentSubjectType = 'REQUEST' | 'PERSON';

export interface RequestDocumentProps {
  id: string;
  requestId: string;
  documentTypeId: string;
  subjectType: DocumentSubjectType;
  subjectId: string | null;
  currentVersionId: string | null;
  status: DocumentStatus;
  versions: DocumentVersion[];
  createdAt: Date;
  updatedAt: Date;
}

export class RequestDocument {
  private readonly _id: string;
  private readonly _requestId: string;
  private readonly _documentTypeId: string;
  private readonly _subjectType: DocumentSubjectType;
  private _subjectId: string | null;
  private _currentVersionId: string | null;
  private _status: DocumentStatus;
  private readonly _versions: DocumentVersion[];
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: RequestDocumentProps) {
    this._id = props.id;
    this._requestId = props.requestId;
    this._documentTypeId = props.documentTypeId;
    this._subjectType = props.subjectType;
    this._subjectId = props.subjectId;
    this._currentVersionId = props.currentVersionId;
    this._status = props.status;
    this._versions = [...props.versions];
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  static create(input: {
    requestId: string;
    documentTypeId: string;
    subjectType: DocumentSubjectType;
    subjectId: string | null;
  }, id: string): RequestDocument {
    const now = new Date();
    return new RequestDocument({
      id,
      requestId: input.requestId,
      documentTypeId: input.documentTypeId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      currentVersionId: null,
      status: 'PENDING',
      versions: [],
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: RequestDocumentProps): RequestDocument {
    return new RequestDocument(props);
  }

  get id(): string { return this._id; }
  get requestId(): string { return this._requestId; }
  get documentTypeId(): string { return this._documentTypeId; }
  get subjectType(): DocumentSubjectType { return this._subjectType; }
  get subjectId(): string | null { return this._subjectId; }
  get currentVersionId(): string | null { return this._currentVersionId; }
  get status(): DocumentStatus { return this._status; }
  get versions(): ReadonlyArray<DocumentVersion> { return this._versions; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }

  toProps(): RequestDocumentProps {
    return {
      id: this._id,
      requestId: this._requestId,
      documentTypeId: this._documentTypeId,
      subjectType: this._subjectType,
      subjectId: this._subjectId,
      currentVersionId: this._currentVersionId,
      status: this._status,
      versions: [...this._versions],
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }

  /**
   * Add a new version to this document. The previous version retains its
   * status (the new "current" one is what reviewers see), but logically the
   * prior one is replaced.
   */
  addVersion(version: DocumentVersion): void {
    if (version.requestDocumentId !== this._id) {
      throw new BusinessRuleError('Version belongs to a different document');
    }
    this._versions.push(version);
    this._currentVersionId = version.id;
    this._status = 'PENDING';
    this.touch();
  }

  approve(): void {
    if (this._status === 'APPROVED') {
      throw new BusinessRuleError('Document is already approved');
    }
    if (this._status === 'REPLACED') {
      throw new BusinessRuleError('Cannot approve a replaced document');
    }
    this._status = 'APPROVED';
    this.touch();
  }

  reject(): void {
    if (this._status === 'REJECTED') {
      throw new BusinessRuleError('Document is already rejected');
    }
    if (this._status === 'REPLACED') {
      throw new BusinessRuleError('Cannot reject a replaced document');
    }
    this._status = 'REJECTED';
    this.touch();
  }

  replace(): void {
    this._status = 'REPLACED';
    this.touch();
  }

  getCurrentVersion(): DocumentVersion | null {
    if (!this._currentVersionId) return null;
    const v = this._versions.find((ver) => ver.id === this._currentVersionId);
    if (!v) throw new NotFoundError('DocumentVersion', this._currentVersionId);
    return v;
  }

  private touch(): void {
    this._updatedAt = new Date();
  }
}
