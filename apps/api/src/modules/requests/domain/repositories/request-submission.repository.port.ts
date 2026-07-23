export const REQUEST_SUBMISSION_REPOSITORY = Symbol(
  'REQUEST_SUBMISSION_REPOSITORY',
);

export interface SubmissionSnapshot {
  requestId: string;
  submittedBy: string;
  snapshotJson: Record<string, unknown>;
  snapshotHash: string;
  previousSubmissionId: string | null;
}

export interface RequestSubmissionRecord {
  id: string;
  requestId: string;
  sequence: number;
  submittedBy: string;
  submittedAt: Date;
  snapshotHash: string;
}

export interface RequestSubmissionRepositoryPort {
  /** Persist a snapshot; returns the sequence number assigned. */
  create(snap: SubmissionSnapshot): Promise<RequestSubmissionRecord>;

  /** List snapshots for a request, oldest first. */
  listByRequest(requestId: string): Promise<RequestSubmissionRecord[]>;
}
