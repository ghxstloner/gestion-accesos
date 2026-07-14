-- CreateTable: credentials
CREATE TABLE `credentials` (
    `id` VARCHAR(191) NOT NULL,
    `credential_number` VARCHAR(30) NOT NULL,
    `request_id` VARCHAR(191) NOT NULL,
    `credential_type` ENUM('PERMANENT_CARD', 'TEMPORARY_PERSON_PASS', 'TEMPORARY_VEHICLE_PASS', 'TEMPORARY_EQUIPMENT_PASS') NOT NULL,
    `person_id` VARCHAR(36) NULL,
    `status` ENUM('PENDING_PRODUCTION', 'IN_PRODUCTION', 'READY_FOR_DELIVERY', 'DELIVERED', 'SUSPENDED', 'REVOKED', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'PENDING_PRODUCTION',
    `issued_at` DATETIME(3) NULL,
    `expires_at` DATETIME(3) NULL,
    `produced_at` DATETIME(3) NULL,
    `ready_at` DATETIME(3) NULL,
    `delivered_at` DATETIME(3) NULL,
    `created_by` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `credentials_credential_number_key`(`credential_number`),
    UNIQUE INDEX `credentials_request_id_key`(`request_id`),
    INDEX `credentials_status_idx`(`status`),
    INDEX `credentials_credential_type_idx`(`credential_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: credential_events
CREATE TABLE `credential_events` (
    `id` VARCHAR(191) NOT NULL,
    `credential_id` VARCHAR(191) NOT NULL,
    `event_type` ENUM('CREATED', 'SUBMITTED', 'RESUBMITTED', 'ASSIGNED', 'DOCUMENT_APPROVED', 'DOCUMENT_REJECTED', 'STAGE_APPROVED', 'RETURNED', 'REJECTED', 'APPROVED', 'STARTED_PRODUCTION', 'MARKED_READY', 'DELIVERED', 'REVERTED_PRODUCTION', 'RETURNED_TO_PRODUCTION', 'CORRECTED_DELIVERY', 'CANCELLED', 'REVOKED_SIGNER', 'DEACTIVATED', 'SUSPENDED', 'ACTIVATED') NOT NULL,
    `from_status` ENUM('PENDING_PRODUCTION', 'IN_PRODUCTION', 'READY_FOR_DELIVERY', 'DELIVERED', 'SUSPENDED', 'REVOKED', 'EXPIRED', 'CANCELLED') NULL,
    `to_status` ENUM('PENDING_PRODUCTION', 'IN_PRODUCTION', 'READY_FOR_DELIVERY', 'DELIVERED', 'SUSPENDED', 'REVOKED', 'EXPIRED', 'CANCELLED') NOT NULL,
    `actor_user_id` VARCHAR(36) NULL,
    `comment` TEXT NULL,
    `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `credential_events_credential_id_occurred_at_idx`(`credential_id`, `occurred_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: delivery_records
CREATE TABLE `delivery_records` (
    `id` VARCHAR(191) NOT NULL,
    `credential_id` VARCHAR(191) NOT NULL,
    `delivered_by_user_id` VARCHAR(36) NOT NULL,
    `received_by_name` VARCHAR(120) NOT NULL,
    `received_by_identification` VARCHAR(80) NOT NULL,
    `delivered_at` DATETIME(3) NOT NULL,
    `observations` TEXT NULL,
    `corrected_at` DATETIME(3) NULL,
    `correction_reason` TEXT NULL,

    UNIQUE INDEX `delivery_records_credential_id_key`(`credential_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKeys
ALTER TABLE `credentials` ADD CONSTRAINT `credentials_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `credential_events` ADD CONSTRAINT `credential_events_credential_id_fkey` FOREIGN KEY (`credential_id`) REFERENCES `credentials`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `delivery_records` ADD CONSTRAINT `delivery_records_credential_id_fkey` FOREIGN KEY (`credential_id`) REFERENCES `credentials`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
