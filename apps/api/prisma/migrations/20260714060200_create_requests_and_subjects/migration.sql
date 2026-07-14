-- CreateTable: requests (root aggregate)
CREATE TABLE `requests` (
    `id` VARCHAR(191) NOT NULL,
    `request_number` VARCHAR(30) NULL,
    `company_id` VARCHAR(191) NOT NULL,
    `request_type_id` VARCHAR(191) NOT NULL,
    `created_by_user_id` VARCHAR(191) NOT NULL,
    `created_by_company_id` VARCHAR(191) NULL,
    `authorized_signer_id` VARCHAR(191) NULL,
    `rejection_reason_id` VARCHAR(191) NULL,
    `reason` TEXT NOT NULL,
    `service_company_name` VARCHAR(255) NULL,
    `valid_from` DATETIME(3) NULL,
    `valid_until` DATETIME(3) NULL,
    `schedule_from` VARCHAR(10) NULL,
    `schedule_until` VARCHAR(10) NULL,
    `observations` TEXT NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'UNDER_DOCUMENT_REVIEW', 'RETURNED_FOR_CORRECTION', 'DOCUMENTS_APPROVED', 'PENDING_FINAL_APPROVAL', 'APPROVED', 'REJECTED', 'IN_PRODUCTION', 'READY_FOR_DELIVERY', 'DELIVERED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `version` INT NOT NULL DEFAULT 1,
    `submitted_at` DATETIME(3) NULL,
    `cancelled_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `requests_request_number_key`(`request_number`),
    INDEX `requests_company_id_idx`(`company_id`),
    INDEX `requests_status_idx`(`status`),
    INDEX `requests_request_type_id_idx`(`request_type_id`),
    INDEX `requests_created_by_user_id_idx`(`created_by_user_id`),
    INDEX `requests_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `requests` ADD CONSTRAINT `requests_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `requests` ADD CONSTRAINT `requests_request_type_id_fkey` FOREIGN KEY (`request_type_id`) REFERENCES `catalog_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `requests` ADD CONSTRAINT `requests_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `requests` ADD CONSTRAINT `requests_authorized_signer_id_fkey` FOREIGN KEY (`authorized_signer_id`) REFERENCES `company_authorized_signers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `requests` ADD CONSTRAINT `requests_rejection_reason_id_fkey` FOREIGN KEY (`rejection_reason_id`) REFERENCES `catalog_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE `request_persons` (
    `id` VARCHAR(191) NOT NULL,
    `request_id` VARCHAR(191) NOT NULL,
    `person_id` VARCHAR(191) NOT NULL,
    `role` ENUM('PRIMARY', 'BENEFICIARY') NOT NULL,
    `personal_emergency` BOOLEAN NOT NULL DEFAULT false,
    `use_previous_photo` BOOLEAN NOT NULL DEFAULT false,
    `department_snapshot` VARCHAR(120) NULL,
    `position_snapshot` VARCHAR(120) NULL,
    `company_name_snapshot` VARCHAR(255) NULL,
    `identification_snapshot` VARCHAR(120) NULL,
    `full_name_snapshot` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `request_persons_request_id_person_id_key`(`request_id`, `person_id`),
    INDEX `request_persons_request_id_idx`(`request_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `request_vehicles` (
    `id` VARCHAR(191) NOT NULL,
    `request_id` VARCHAR(191) NOT NULL,
    `brand` VARCHAR(120) NOT NULL,
    `model` VARCHAR(120) NOT NULL,
    `plate_number` VARCHAR(50) NOT NULL,
    `color` VARCHAR(50) NULL,
    `year` INT NULL,
    `description` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `request_vehicles_request_id_plate_number_key`(`request_id`, `plate_number`),
    INDEX `request_vehicles_request_id_idx`(`request_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `request_equipment` (
    `id` VARCHAR(191) NOT NULL,
    `request_id` VARCHAR(191) NOT NULL,
    `brand` VARCHAR(120) NULL,
    `equipment_type` VARCHAR(120) NOT NULL,
    `serial_number` VARCHAR(100) NULL,
    `description` TEXT NULL,
    `quantity` INT NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `request_equipment_request_id_serial_number_key`(`request_id`, `serial_number`),
    INDEX `request_equipment_request_id_idx`(`request_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `request_access_points` (
    `id` VARCHAR(191) NOT NULL,
    `request_id` VARCHAR(191) NOT NULL,
    `access_point_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `request_access_points_request_id_access_point_id_key`(`request_id`, `access_point_id`),
    INDEX `request_access_points_request_id_idx`(`request_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `request_access_areas` (
    `id` VARCHAR(191) NOT NULL,
    `request_id` VARCHAR(191) NOT NULL,
    `access_area_id` VARCHAR(191) NOT NULL,
    `justification` TEXT NULL,
    `review_status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `reviewed_by` VARCHAR(36) NULL,
    `reviewed_at` DATETIME(3) NULL,
    `review_comment` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `request_access_areas_request_id_access_area_id_key`(`request_id`, `access_area_id`),
    INDEX `request_access_areas_request_id_idx`(`request_id`),
    INDEX `request_access_areas_review_status_idx`(`review_status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey children
ALTER TABLE `request_persons` ADD CONSTRAINT `request_persons_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `request_persons` ADD CONSTRAINT `request_persons_person_id_fkey` FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `request_vehicles` ADD CONSTRAINT `request_vehicles_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `request_equipment` ADD CONSTRAINT `request_equipment_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `request_access_points` ADD CONSTRAINT `request_access_points_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `request_access_points` ADD CONSTRAINT `request_access_points_access_point_id_fkey` FOREIGN KEY (`access_point_id`) REFERENCES `catalog_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `request_access_areas` ADD CONSTRAINT `request_access_areas_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `request_access_areas` ADD CONSTRAINT `request_access_areas_access_area_id_fkey` FOREIGN KEY (`access_area_id`) REFERENCES `catalog_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
