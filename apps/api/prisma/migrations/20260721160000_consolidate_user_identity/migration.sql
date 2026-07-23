-- Migration: Consolidate User Identity and Security Auth (Person + User consolidation)

-- DropForeignKey
ALTER TABLE `company_authorized_signers` DROP FOREIGN KEY `company_authorized_signers_person_id_fkey`;

-- DropForeignKey
ALTER TABLE `people` DROP FOREIGN KEY `people_company_id_fkey`;

-- DropForeignKey
ALTER TABLE `people` DROP FOREIGN KEY `people_identification_type_id_fkey`;

-- DropForeignKey
ALTER TABLE `request_persons` DROP FOREIGN KEY `request_persons_person_id_fkey`;

-- DropForeignKey
ALTER TABLE `request_persons` DROP FOREIGN KEY `request_persons_request_id_fkey`;

-- DropIndex
DROP INDEX `company_authorized_signers_person_id_idx` ON `company_authorized_signers`;

-- DropIndex
DROP INDEX `users_email_key` ON `users`;

-- AlterTable
ALTER TABLE `company_authorized_signers` DROP COLUMN `person_id`,
    ADD COLUMN `signer_user_id` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `credentials` DROP COLUMN `person_id`,
    ADD COLUMN `subject_user_id` VARCHAR(36) NULL;

-- AlterTable
ALTER TABLE `document_requirements` MODIFY `subject_type` ENUM('REQUEST', 'USER') NOT NULL;

-- AlterTable
ALTER TABLE `request_documents` MODIFY `subject_type` ENUM('REQUEST', 'USER') NOT NULL;

-- AlterTable
ALTER TABLE `users` DROP COLUMN `last_access_at`,
    DROP COLUMN `must_change_password`,
    DROP COLUMN `password_changed_at`,
    DROP COLUMN `password_hash`,
    ADD COLUMN `birth_date` DATETIME(3) NULL,
    ADD COLUMN `blood_type` VARCHAR(5) NULL,
    ADD COLUMN `department` VARCHAR(120) NULL,
    ADD COLUMN `document_number` VARCHAR(50) NOT NULL,
    ADD COLUMN `document_type` ENUM('NATIONAL_ID', 'PASSPORT', 'RESIDENCE_ID', 'OTHER') NOT NULL DEFAULT 'NATIONAL_ID',
    ADD COLUMN `email_verified_at` DATETIME(3) NULL,
    ADD COLUMN `employee_number` VARCHAR(50) NULL,
    ADD COLUMN `gender` VARCHAR(20) NULL,
    ADD COLUMN `marital_status` VARCHAR(30) NULL,
    ADD COLUMN `married_last_name` VARCHAR(100) NULL,
    ADD COLUMN `middle_name` VARCHAR(100) NULL,
    ADD COLUMN `mobile` VARCHAR(50) NULL,
    ADD COLUMN `nationality` VARCHAR(80) NULL,
    ADD COLUMN `normalized_document_number` VARCHAR(50) NOT NULL,
    ADD COLUMN `phone` VARCHAR(50) NULL,
    ADD COLUMN `physical_condition` VARCHAR(255) NULL,
    ADD COLUMN `position` VARCHAR(120) NULL,
    ADD COLUMN `residential_address` TEXT NULL,
    ADD COLUMN `second_last_name` VARCHAR(100) NULL,
    ADD COLUMN `social_security_number` VARCHAR(50) NULL,
    MODIFY `email` VARCHAR(255) NULL,
    MODIFY `status` ENUM('ACTIVE', 'INACTIVE', 'BLOCKED', 'PENDING_ACTIVATION') NOT NULL DEFAULT 'ACTIVE';

-- DropTable
DROP TABLE `people`;

-- DropTable
DROP TABLE `request_persons`;

-- CreateTable
CREATE TABLE `auth_identities` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `password_changed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_login_at` DATETIME(3) NULL,
    `failed_login_attempts` INTEGER NOT NULL DEFAULT 0,
    `locked_until` DATETIME(3) NULL,
    `must_change_password` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `auth_identities_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `password_recovery_challenges` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `code_hash` VARCHAR(255) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `max_attempts` INTEGER NOT NULL DEFAULT 3,
    `consumed_at` DATETIME(3) NULL,
    `invalidated_at` DATETIME(3) NULL,
    `requested_ip_hash` VARCHAR(64) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `password_recovery_challenges_user_id_expires_at_idx`(`user_id`, `expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `request_participants` (
    `id` VARCHAR(191) NOT NULL,
    `request_id` VARCHAR(191) NOT NULL,
    `participant_user_id` VARCHAR(191) NOT NULL,
    `role` ENUM('PRIMARY', 'BENEFICIARY') NOT NULL DEFAULT 'PRIMARY',
    `personal_emergency` BOOLEAN NOT NULL DEFAULT false,
    `use_previous_photo` BOOLEAN NOT NULL DEFAULT false,
    `department_snapshot` VARCHAR(120) NULL,
    `position_snapshot` VARCHAR(120) NULL,
    `company_name_snapshot` VARCHAR(255) NULL,
    `identification_snapshot` VARCHAR(120) NULL,
    `full_name_snapshot` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `request_participants_request_id_idx`(`request_id`),
    UNIQUE INDEX `request_participants_request_id_participant_user_id_key`(`request_id`, `participant_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `custody_records` (
    `id` VARCHAR(191) NOT NULL,
    `credential_id` VARCHAR(191) NOT NULL,
    `subject_user_id` VARCHAR(36) NOT NULL,
    `document_type` VARCHAR(50) NOT NULL,
    `document_number` VARCHAR(50) NOT NULL,
    `deposit_time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `return_time` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `custody_records_credential_id_key`(`credential_id`),
    INDEX `custody_records_subject_user_id_idx`(`subject_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `company_authorized_signers_signer_user_id_idx` ON `company_authorized_signers`(`signer_user_id`);

-- CreateIndex
CREATE INDEX `credentials_subject_user_id_idx` ON `credentials`(`subject_user_id`);

-- CreateIndex
CREATE INDEX `users_email_idx` ON `users`(`email`);

-- CreateIndex
CREATE INDEX `users_first_name_last_name_idx` ON `users`(`first_name`, `last_name`);

-- CreateIndex
CREATE INDEX `users_status_idx` ON `users`(`status`);

-- CreateIndex
CREATE UNIQUE INDEX `users_document_type_normalized_document_number_key` ON `users`(`document_type`, `normalized_document_number`);

-- AddForeignKey
ALTER TABLE `auth_identities` ADD CONSTRAINT `auth_identities_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `password_recovery_challenges` ADD CONSTRAINT `password_recovery_challenges_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `company_authorized_signers` ADD CONSTRAINT `company_authorized_signers_signer_user_id_fkey` FOREIGN KEY (`signer_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `request_participants` ADD CONSTRAINT `request_participants_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `request_participants` ADD CONSTRAINT `request_participants_participant_user_id_fkey` FOREIGN KEY (`participant_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `credentials` ADD CONSTRAINT `credentials_subject_user_id_fkey` FOREIGN KEY (`subject_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `custody_records` ADD CONSTRAINT `custody_records_credential_id_fkey` FOREIGN KEY (`credential_id`) REFERENCES `credentials`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `custody_records` ADD CONSTRAINT `custody_records_subject_user_id_fkey` FOREIGN KEY (`subject_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `document_requirements` RENAME INDEX `document_requirements_type_doc_subject_key` TO `document_requirements_request_type_id_document_type_id_subje_key`;
