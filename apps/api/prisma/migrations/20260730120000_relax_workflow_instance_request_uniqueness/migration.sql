-- Phase 1 (Workflow ↔ Request lifecycle bridge):
-- To allow a single Request to accrue several WorkflowInstance rows across
-- its lifecycle (initial run, then a new run after RETURN_FOR_CORRECTION ->
-- resubmit), the strict `request_id` UNIQUE constraint introduced by
-- 20260721170000_add_dynamic_workflow_engine is dropped.
--
-- Invariant "at most ONE ACTIVE workflow instance per request" is enforced
-- at the application layer (RequestWorkflowOrchestrator + WorkflowEngineService
-- double-start guard, which queries the ACTIVE instance).
--
-- The FK `workflow_instances_request_id_fkey` depends on an index existing on
-- `request_id`, so the plain index is created FIRST, the UNIQUE dropped next,
-- and finally the composite (request_id, status) index is added.

-- 1) Create a plain index on request_id (so the FK keeps a backing index).
CREATE INDEX `workflow_instances_request_id_idx`
  ON `workflow_instances` (`request_id`);

-- 2) Drop the unique constraint (now safe — FK is backed by the new index).
ALTER TABLE `workflow_instances`
  DROP INDEX `workflow_instances_request_id_key`;

-- 3) Add the composite (request_id, status) index for the ACTIVE-instance lookup.
CREATE INDEX `workflow_instances_request_id_status_idx`
  ON `workflow_instances` (`request_id`, `status`);
