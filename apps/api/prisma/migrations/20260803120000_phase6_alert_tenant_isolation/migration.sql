-- Phase 6 — Alert tenant isolation.
--
-- OperationalAlerts must be company-scoped when generated for company-owned
-- entities (credentials, custody, workflow tasks, review tasks). System/job
-- alerts remain GLOBAL with a NULL company_id so SYSTEM_ADMIN can still see
-- them, while COMPANY_ADMIN queries are filtered to their own company only.
--
-- company_id is nullable+FK with ON DELETE SET NULL: if a company is ever
-- removed while it still had alerts, those rows do not disappear; they fall
-- back to the global scope (still observable by SYSTEM_ADMIN for governance).

ALTER TABLE `operational_alerts` ADD COLUMN `company_id` VARCHAR(36) NULL;

CREATE INDEX `operational_alerts_company_id_idx` ON `operational_alerts`(`company_id`);

ALTER TABLE `operational_alerts`
  ADD CONSTRAINT `operational_alerts_company_id_fkey`
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE SET NULL;
