-- CreateTable: notifications
CREATE TABLE `notifications` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `type` VARCHAR(80) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `message` TEXT NOT NULL,
    `entity_type` VARCHAR(60) NULL,
    `entity_id` VARCHAR(36) NULL,
    `read_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_user_id_read_at_idx`(`user_id`, `read_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: audit_events
CREATE TABLE `audit_events` (
    `id` VARCHAR(191) NOT NULL,
    `actor_user_id` VARCHAR(36) NULL,
    `actor_company_id` VARCHAR(36) NULL,
    `action` VARCHAR(100) NOT NULL,
    `aggregate_type` VARCHAR(60) NOT NULL,
    `aggregate_id` VARCHAR(36) NULL,
    `previous_data` JSON NULL,
    `new_data` JSON NULL,
    `metadata` JSON NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` TEXT NULL,
    `correlation_id` VARCHAR(36) NULL,
    `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_events_aggregate_type_aggregate_id_idx`(`aggregate_type`, `aggregate_id`),
    INDEX `audit_events_actor_user_id_idx`(`actor_user_id`),
    INDEX `audit_events_action_occurred_at_idx`(`action`, `occurred_at`),
    INDEX `audit_events_occurred_at_idx`(`occurred_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: idempotency_records
CREATE TABLE `idempotency_records` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(120) NOT NULL,
    `actor_user_id` VARCHAR(36) NULL,
    `request_path` VARCHAR(255) NOT NULL,
    `status_code` INT NOT NULL,
    `response_body` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expires_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `idempotency_records_key_key`(`key`),
    INDEX `idempotency_records_actor_user_id_idx`(`actor_user_id`),
    INDEX `idempotency_records_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
