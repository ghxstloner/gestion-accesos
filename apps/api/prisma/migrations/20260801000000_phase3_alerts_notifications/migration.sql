-- Phase 3: Alert rules, operational alerts, scheduled jobs, notification extensions
-- All tables use utf8mb4_unicode_ci to match the rest of the SGA schema so that
-- foreign keys against users(utf8mb4_unicode_ci) work.

-- 1) Extend notifications table
ALTER TABLE `notifications`
  ADD COLUMN `priority` VARCHAR(20) NOT NULL DEFAULT 'NORMAL' AFTER `message`,
  ADD COLUMN `related_entity_type` VARCHAR(60) NULL AFTER `priority`,
  ADD COLUMN `related_entity_id` VARCHAR(36) NULL AFTER `related_entity_type`;

CREATE INDEX `notifications_user_id_created_at_idx` ON `notifications`(`user_id`, `created_at`);

-- 2) alert_rules
CREATE TABLE `alert_rules` (
  `id` VARCHAR(36) NOT NULL,
  `code` VARCHAR(60) NOT NULL,
  `name` VARCHAR(180) NOT NULL,
  `description` TEXT NULL,
  `scope` ENUM('CREDENTIAL','CUSTODY','WORKFLOW','REVIEW','JOB') NOT NULL,
  `threshold_days` INT NULL,
  `severity` ENUM('INFO','WARN','CRITICAL') NOT NULL DEFAULT 'WARN',
  `enabled` BOOLEAN NOT NULL DEFAULT TRUE,
  `last_run_at` DATETIME(3) NULL,
  `last_result_json` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `alert_rules_code_key`(`code`),
  INDEX `alert_rules_scope_enabled_idx`(`scope`, `enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3) operational_alerts
CREATE TABLE `operational_alerts` (
  `id` VARCHAR(36) NOT NULL,
  `rule_id` VARCHAR(36) NOT NULL,
  `rule_code` VARCHAR(60) NOT NULL,
  `severity` ENUM('INFO','WARN','CRITICAL') NOT NULL DEFAULT 'WARN',
  `entity_type` VARCHAR(60) NOT NULL,
  `entity_id` VARCHAR(36) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `observed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `status` ENUM('OPEN','ACKNOWLEDGED','RESOLVED') NOT NULL DEFAULT 'OPEN',
  `acknowledged_by_user_id` VARCHAR(191) NULL,
  `acknowledged_at` DATETIME(3) NULL,
  `resolved_at` DATETIME(3) NULL,
  `metadata` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `operational_alerts_rule_code_entity_type_entity_id_key`(`rule_code`, `entity_type`, `entity_id`),
  INDEX `operational_alerts_status_severity_idx`(`status`, `severity`),
  INDEX `operational_alerts_observed_at_idx`(`observed_at`),
  CONSTRAINT `operational_alerts_rule_id_fkey` FOREIGN KEY (`rule_id`) REFERENCES `alert_rules`(`id`) ON DELETE CASCADE,
  CONSTRAINT `operational_alerts_acknowledged_by_user_id_fkey` FOREIGN KEY (`acknowledged_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4) scheduled_jobs
CREATE TABLE `scheduled_jobs` (
  `id` VARCHAR(36) NOT NULL,
  `code` VARCHAR(60) NOT NULL,
  `last_run_at` DATETIME(3) NULL,
  `last_status` ENUM('SUCCESS','FAILED','RUNNING') NULL,
  `last_error` TEXT NULL,
  `run_count` INT NOT NULL DEFAULT 0,
  `fail_count` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `scheduled_jobs_code_key`(`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
