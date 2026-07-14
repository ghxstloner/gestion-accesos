-- CreateTable
CREATE TABLE `people` (
    `id` VARCHAR(191) NOT NULL,
    `company_id` VARCHAR(191) NOT NULL,
    `first_name` VARCHAR(100) NOT NULL,
    `middle_name` VARCHAR(100) NULL,
    `first_surname` VARCHAR(100) NOT NULL,
    `second_surname` VARCHAR(100) NULL,
    `married_surname` VARCHAR(100) NULL,
    `identification_type_id` VARCHAR(191) NOT NULL,
    `identification_number` VARCHAR(50) NOT NULL,
    `social_security_number` VARCHAR(50) NULL,
    `birth_date` DATETIME(3) NULL,
    `gender` VARCHAR(20) NULL,
    `marital_status` VARCHAR(30) NULL,
    `nationality` VARCHAR(80) NULL,
    `blood_type` VARCHAR(5) NULL,
    `phone` VARCHAR(50) NULL,
    `mobile` VARCHAR(50) NULL,
    `email` VARCHAR(255) NULL,
    `residential_address` TEXT NULL,
    `physical_condition` VARCHAR(255) NULL,
    `department` VARCHAR(120) NULL,
    `position` VARCHAR(120) NULL,
    `years_of_service` INT NULL,
    `previously_worked_at_airport` BOOLEAN NOT NULL DEFAULT false,
    `previous_company_name` VARCHAR(255) NULL,
    `previously_had_credential` BOOLEAN NOT NULL DEFAULT false,
    `reuse_previous_photo` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `created_by` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `people_identification_type_id_identification_number_key`(`identification_type_id`, `identification_number`),
    INDEX `people_company_id_idx`(`company_id`),
    INDEX `people_first_name_first_surname_idx`(`first_name`, `first_surname`),
    INDEX `people_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `company_authorized_signers` (
    `id` VARCHAR(191) NOT NULL,
    `company_id` VARCHAR(191) NOT NULL,
    `person_id` VARCHAR(191) NOT NULL,
    `position` VARCHAR(120) NOT NULL,
    `valid_from` DATETIME(3) NOT NULL,
    `valid_until` DATETIME(3) NULL,
    `authorization_document_id` VARCHAR(36) NULL,
    `signature_file_id` VARCHAR(36) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'REVOKED') NOT NULL DEFAULT 'ACTIVE',
    `revoked_at` DATETIME(3) NULL,
    `revoked_by` VARCHAR(36) NULL,
    `revocation_reason` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `company_authorized_signers_company_id_idx`(`company_id`),
    INDEX `company_authorized_signers_person_id_idx`(`person_id`),
    INDEX `company_authorized_signers_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `people` ADD CONSTRAINT `people_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Note: FK to catalog_items is added in the catalogs migration.

-- AddForeignKey
ALTER TABLE `company_authorized_signers` ADD CONSTRAINT `company_authorized_signers_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `company_authorized_signers` ADD CONSTRAINT `company_authorized_signers_person_id_fkey` FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
