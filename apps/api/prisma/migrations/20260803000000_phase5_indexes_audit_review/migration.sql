-- Prisma migration to add benchmarked query indexes for Phase 5.
-- These compound indexes accelerate:
--   * audit_events by company-scoped timeline (dashboard/audit filter)
--   * review_tasks by status + due date (overdue SLA scans)

CREATE INDEX `audit_events_actor_company_id_occurred_at_idx` ON `audit_events`(`actor_company_id`, `occurred_at`);

CREATE INDEX `review_tasks_status_due_at_idx` ON `review_tasks`(`status`, `due_at`);
