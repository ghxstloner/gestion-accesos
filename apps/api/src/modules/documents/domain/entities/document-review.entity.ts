/**
 * Immutable review record. Created each time a reviewer approves or rejects a
 * specific version of a RequestDocument.
 *
 * Spec ref: section 16.
 */

import type { DocumentStatus } from './request-document.entity';

export type ReviewDecision = Extract<DocumentStatus, 'APPROVED' | 'REJECTED'>;

export interface DocumentReviewProps {
  id: string;
  requestDocumentId: string;
  documentVersionId: string;
  decision: ReviewDecision;
  comment: string | null;
  reviewedBy: string;
  userId: string | null;
  reviewedAt: Date;
}

export class DocumentReview {
  private constructor(private readonly props: DocumentReviewProps) {}

  static create(
    input: Omit<DocumentReviewProps, 'id' | 'reviewedAt'>,
    id: string,
  ): DocumentReview {
    if (!input.reviewedBy) {
      throw new RangeError('reviewedBy is required');
    }
    return new DocumentReview({
      ...input,
      id,
      reviewedAt: new Date(),
    });
  }

  static reconstitute(props: DocumentReviewProps): DocumentReview {
    return new DocumentReview(props);
  }

  get id(): string { return this.props.id; }
  get requestDocumentId(): string { return this.props.requestDocumentId; }
  get documentVersionId(): string { return this.props.documentVersionId; }
  get decision(): ReviewDecision { return this.props.decision; }
  get comment(): string | null { return this.props.comment; }
  get reviewedBy(): string { return this.props.reviewedBy; }
  get userId(): string | null { return this.props.userId; }
  get reviewedAt(): Date { return this.props.reviewedAt; }

  toProps(): DocumentReviewProps {
    return { ...this.props };
  }
}
