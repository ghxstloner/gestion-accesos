-- Migration: Dynamic Workflow Engine (FASE 3)
-- Creates versioned workflow definitions, instances, human tasks, and transition history.
-- Non-destructive: only adds new tables and FKs.

-- CreateTable
CREATE TABLE `workflow_definitions` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(100) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `request_type` ENUM('PERMANENT_CARD', 'TEMPORARY_PERSON', 'TEMPORARY_VEHICLE', 'TEMPORARY_EQUIPMENT') NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'RETIRED') NOT NULL DEFAULT 'DRAFT',
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `workflow_definitions_key_key`(`key`),
    INDEX `workflow_definitions_key_idx`(`key`),
    INDEX `workflow_definitions_request_type_idx`(`request_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `workflow_versions` (
    `id` VARCHAR(191) NOT NULL,
    `workflow_definition_id` VARCHAR(191) NOT NULL,
    `version_number` INTEGER NOT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'RETIRED') NOT NULL DEFAULT 'DRAFT',
    `schema_version` INTEGER NOT NULL DEFAULT 1,
    `definition_json` JSON NOT NULL,
    `checksum` VARCHAR(64) NOT NULL,
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `published_by_user_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `published_at` DATETIME(3) NULL,

    INDEX `workflow_versions_status_idx`(`status`),
    UNIQUE INDEX `workflow_versions_workflow_definition_id_version_number_key`(`workflow_definition_id`, `version_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `workflow_instances` (
    `id` VARCHAR(191) NOT NULL,
    `request_id` VARCHAR(191) NOT NULL,
    `workflow_version_id` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'COMPLETED', 'CANCELLED', 'FAILED') NOT NULL DEFAULT 'ACTIVE',
    `context_json` JSON NOT NULL,
    `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completed_at` DATETIME(3) NULL,
    `cancelled_at` DATETIME(3) NULL,
    `lock_version` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `workflow_instances_request_id_key`(`request_id`),
    INDEX `workflow_instances_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `workflow_node_instances` (
    `id` VARCHAR(191) NOT NULL,
    `workflow_instance_id` VARCHAR(191) NOT NULL,
    `node_key` VARCHAR(100) NOT NULL,
    `node_type` VARCHAR(50) NOT NULL,
    `status` ENUM('PENDING', 'RUNNING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `input_json` JSON NULL,
    `output_json` JSON NULL,
    `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completed_at` DATETIME(3) NULL,
    `failed_at` DATETIME(3) NULL,
    `error_code` VARCHAR(80) NULL,
    `error_message` TEXT NULL,
    `attempt_number` INTEGER NOT NULL DEFAULT 1,

    INDEX `workflow_node_instances_workflow_instance_id_node_key_idx`(`workflow_instance_id`, `node_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `workflow_tasks` (
    `id` VARCHAR(191) NOT NULL,
    `workflow_instance_id` VARCHAR(191) NOT NULL,
    `node_instance_id` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'CLAIMED', 'COMPLETED', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
    `assignment_type` ENUM('ROLE', 'USER') NOT NULL DEFAULT 'ROLE',
    `assigned_user_id` VARCHAR(36) NULL,
    `assigned_role_code` VARCHAR(60) NULL,
    `assigned_company_id` VARCHAR(36) NULL,
    `claimed_by_user_id` VARCHAR(36) NULL,
    `due_at` DATETIME(3) NULL,
    `completed_by_user_id` VARCHAR(36) NULL,
    `completed_at` DATETIME(3) NULL,
    `outcome` VARCHAR(80) NULL,
    `comment` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `workflow_tasks_workflow_instance_id_idx`(`workflow_instance_id`),
    INDEX `workflow_tasks_status_idx`(`status`),
    INDEX `workflow_tasks_assigned_role_code_idx`(`assigned_role_code`),
    INDEX `workflow_tasks_assigned_user_id_idx`(`assigned_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `workflow_transitions` (
    `id` VARCHAR(191) NOT NULL,
    `workflow_instance_id` VARCHAR(191) NOT NULL,
    `source_node_key` VARCHAR(100) NOT NULL,
    `target_node_key` VARCHAR(100) NOT NULL,
    `action` VARCHAR(80) NOT NULL,
    `actor_user_id` VARCHAR(36) NULL,
    `task_id` VARCHAR(36) NULL,
    `idempotency_key` VARCHAR(120) NULL,
    `metadata_json` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `workflow_transitions_workflow_instance_id_idx`(`workflow_instance_id`),
    UNIQUE INDEX `workflow_transitions_workflow_instance_id_idempotency_key_key`(`workflow_instance_id`, `idempotency_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `workflow_definitions` ADD CONSTRAINT `workflow_definitions_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workflow_versions` ADD CONSTRAINT `workflow_versions_workflow_definition_id_fkey` FOREIGN KEY (`workflow_definition_id`) REFERENCES `workflow_definitions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workflow_versions` ADD CONSTRAINT `workflow_versions_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workflow_versions` ADD CONSTRAINT `workflow_versions_published_by_user_id_fkey` FOREIGN KEY (`published_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workflow_instances` ADD CONSTRAINT `workflow_instances_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workflow_instances` ADD CONSTRAINT `workflow_instances_workflow_version_id_fkey` FOREIGN KEY (`workflow_version_id`) REFERENCES `workflow_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workflow_node_instances` ADD CONSTRAINT `workflow_node_instances_workflow_instance_id_fkey` FOREIGN KEY (`workflow_instance_id`) REFERENCES `workflow_instances`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workflow_tasks` ADD CONSTRAINT `workflow_tasks_workflow_instance_id_fkey` FOREIGN KEY (`workflow_instance_id`) REFERENCES `workflow_instances`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workflow_tasks` ADD CONSTRAINT `workflow_tasks_node_instance_id_fkey` FOREIGN KEY (`node_instance_id`) REFERENCES `workflow_node_instances`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workflow_transitions` ADD CONSTRAINT `workflow_transitions_workflow_instance_id_fkey` FOREIGN KEY (`workflow_instance_id`) REFERENCES `workflow_instances`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
