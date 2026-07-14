export const REVIEW_REPOSITORY = Symbol('REVIEW_REPOSITORY');

export interface ReviewListFilters {
  requestId?: string;
  status?: string;
  assignedToUserId?: string;
  assignedRoleCode?: string;
  taskType?: string;
}

export interface ReviewListPage {
  items: ReviewTaskRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ReviewTaskRecord {
  id: string;
  requestId: string;
  taskType: string;
  status: string;
  assignedToUserId: string | null;
  assignedRoleCode: string | null;
  assignedAt: Date | null;
  completedAt: Date | null;
  dueAt: Date | null;
  createdAt: Date;
}

export interface ReviewRepositoryPort {
  findById(id: string): Promise<ReviewTaskRecord | null>;
  list(inputs: { filters: ReviewListFilters; page: number; pageSize: number }): Promise<ReviewListPage>;
  save(task: ReviewTaskRecord): Promise<void>;
  findByRequest(requestId: string): Promise<ReviewTaskRecord[]>;
}
