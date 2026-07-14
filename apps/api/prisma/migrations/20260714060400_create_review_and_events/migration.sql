-- CreateTable: request_events (immutable history)
CREATE TABLE `request_events` (
    `id` VARCHAR(191) NOT NULL,
    `request_id` VARCHAR(191) NOT NULL,
    `event_type` ENUM('CREATED', 'SUBMITTED', 'RESUBMITTED', 'ASSIGNED', 'DOCUMENT_APPROVED', 'DOCUMENT_REJECTED', 'STAGE_APPROVED', 'RETURNED', 'REJECTED', 'APPROVED', 'STARTED_PRODUCTION', 'MARKED_READY', 'DELIVERED', 'REVERTED_PRODUCTION', 'RETURNED_TO_PRODUCTION', 'CORRECTED_DELIVERY', 'CANCELLED', 'REVOKED_SIGNER', 'DEACTIVATED', 'SUSPENDED', 'ACTIVATED') NOT NULL,
    `from_status` ENUM('DRAFT', 'SUBMITTED', 'UNDER_DOCUMENT_REVIEW', 'RETURNED_FOR_CORRECTION', 'DOCUMENTS_APPROVED', 'PENDING_FINAL_APPROVAL', 'APPROVED', 'REJECTED', 'IN_PRODUCTION', 'READY_FOR_DELIVERY', 'DELIVERED', 'CANCELLED') NULL,
    `to_status` ENUM('DRAFT', 'SUBMITTED', 'UNDER_DOCUMENT_REVIEW', 'RETURNED_FOR_CORRECTION', 'DOCUMENTS_APPROVED', 'PENDING_FINAL_APPROVAL', 'APPROVED', 'REJECTED', 'IN_PRODUCTION', 'READY_FOR_DELIVERY', 'DELIVERED', 'CANCELLED') NOT NULL,
    `actor_user_id` VARCHAR(36) NULL,
    `actor_role_code` VARCHAR(60) NULL,
    `actor_company_id` VARCHAR(36) NULL,
    `reason_code` VARCHAR(80) NULL,
    `comment` TEXT NULL,
    `metadata` JSON NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` TEXT NULL,
    `correlation_id` VARCHAR(36) NULL,
    `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `request_events_request_id_occurred_at_idx`(`request_id`, `occurred_at`),
    INDEX `request_events_actor_user_id_idx`(`actor_user_id`),
    INDEX `request_events_event_type_idx`(`event_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: review_tasks
CREATE TABLE `review_tasks` (
    `id` VARCHAR(191) NOT NULL,
    `request_id` VARCHAR(191) NOT NULL,
    `task_type` ENUM('DOCUMENT_REVIEW', 'FINAL_APPROVAL') NOT NULL,
    `status` ENUM('PENDING', 'ASSIGNED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `assigned_to_user_id` VARCHAR(36) NULL,
    `assigned_role_code` VARCHAR(60) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `assigned_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `due_at` DATETIME(3) NULL,

    INDEX `review_tasks_request_id_idx`(`request_id`),
    INDEX `review_tasks_status_idx`(`status`),
    INDEX `review_tasks_assigned_to_user_id_idx`(`assigned_to_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKeys
ALTER TABLE `request_events` ADD CONSTRAINT `request_events_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `review_tasks` ADD CONSTRAINT `review_tasks_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
