-- CreateTable: request_documents
CREATE TABLE `request_documents` (
    `id` VARCHAR(191) NOT NULL,
    `request_id` VARCHAR(191) NOT NULL,
    `document_type_id` VARCHAR(191) NOT NULL,
    `subject_type` ENUM('REQUEST', 'PERSON') NOT NULL,
    `subject_id` VARCHAR(36) NULL,
    `current_version_id` VARCHAR(36) NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'REPLACED') NOT NULL DEFAULT 'PENDING',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `request_documents_request_id_idx`(`request_id`),
    INDEX `request_documents_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: document_versions
CREATE TABLE `document_versions` (
    `id` VARCHAR(191) NOT NULL,
    `request_document_id` VARCHAR(191) NOT NULL,
    `version_number` INT NOT NULL,
    `original_filename` VARCHAR(255) NOT NULL,
    `stored_filename` VARCHAR(255) NOT NULL,
    `storage_key` VARCHAR(512) NOT NULL,
    `mime_type` VARCHAR(100) NOT NULL,
    `size` BIGINT NOT NULL,
    `sha256` VARCHAR(64) NOT NULL,
    `uploaded_by` VARCHAR(36) NOT NULL,
    `uploaded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `document_versions_request_document_id_version_number_key`(`request_document_id`, `version_number`),
    INDEX `document_versions_request_document_id_idx`(`request_document_id`),
    INDEX `document_versions_sha256_idx`(`sha256`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: document_reviews
CREATE TABLE `document_reviews` (
    `id` VARCHAR(191) NOT NULL,
    `request_document_id` VARCHAR(191) NOT NULL,
    `document_version_id` VARCHAR(191) NOT NULL,
    `decision` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL,
    `comment` TEXT NULL,
    `reviewed_by` VARCHAR(36) NOT NULL,
    `reviewed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `document_reviews_request_document_id_idx`(`request_document_id`),
    INDEX `document_reviews_document_version_id_idx`(`document_version_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: document_requirements
CREATE TABLE `document_requirements` (
    `id` VARCHAR(191) NOT NULL,
    `request_type_id` VARCHAR(191) NOT NULL,
    `document_type_id` VARCHAR(191) NOT NULL,
    `subject_type` ENUM('REQUEST', 'PERSON') NOT NULL,
    `is_required` BOOLEAN NOT NULL DEFAULT true,
    `min_files` INT NOT NULL DEFAULT 1,
    `max_files` INT NOT NULL DEFAULT 10,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `document_requirements_request_type_id_document_type_id_subject_t_key`(`request_type_id`, `document_type_id`, `subject_type`),
    INDEX `document_requirements_request_type_id_idx`(`request_type_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: file_metadata
CREATE TABLE `file_metadata` (
    `id` VARCHAR(191) NOT NULL,
    `storage_key` VARCHAR(512) NOT NULL,
    `original_filename` VARCHAR(255) NOT NULL,
    `stored_filename` VARCHAR(255) NOT NULL,
    `mime_type` VARCHAR(100) NOT NULL,
    `size` BIGINT NOT NULL,
    `sha256` VARCHAR(64) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `file_metadata_storage_key_key`(`storage_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: request_submissions
CREATE TABLE `request_submissions` (
    `id` VARCHAR(191) NOT NULL,
    `request_id` VARCHAR(191) NOT NULL,
    `sequence` INT NOT NULL,
    `submitted_by` VARCHAR(36) NOT NULL,
    `submitted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `snapshot_json` JSON NOT NULL,
    `snapshot_hash` VARCHAR(64) NOT NULL,
    `previous_submission_id` VARCHAR(36) NULL,

    UNIQUE INDEX `request_submissions_request_id_sequence_key`(`request_id`, `sequence`),
    INDEX `request_submissions_request_id_idx`(`request_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKeys
ALTER TABLE `request_documents` ADD CONSTRAINT `request_documents_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `request_documents` ADD CONSTRAINT `request_documents_document_type_id_fkey` FOREIGN KEY (`document_type_id`) REFERENCES `catalog_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `document_versions` ADD CONSTRAINT `document_versions_request_document_id_fkey` FOREIGN KEY (`request_document_id`) REFERENCES `request_documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `document_reviews` ADD CONSTRAINT `document_reviews_request_document_id_fkey` FOREIGN KEY (`request_document_id`) REFERENCES `request_documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `document_reviews` ADD CONSTRAINT `document_reviews_document_version_id_fkey` FOREIGN KEY (`document_version_id`) REFERENCES `document_versions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `document_requirements` ADD CONSTRAINT `document_requirements_request_type_id_fkey` FOREIGN KEY (`request_type_id`) REFERENCES `catalog_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `document_requirements` ADD CONSTRAINT `document_requirements_document_type_id_fkey` FOREIGN KEY (`document_type_id`) REFERENCES `catalog_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `request_submissions` ADD CONSTRAINT `request_submissions_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
