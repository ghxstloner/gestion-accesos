-- CreateTable
CREATE TABLE `catalog_items` (
    `id` VARCHAR(191) NOT NULL,
    `kind` ENUM('REQUEST_TYPE', 'IDENTIFICATION_TYPE', 'DOCUMENT_TYPE', 'ACCESS_POINT', 'SECURITY_ZONE', 'ACCESS_AREA', 'REJECTION_REASON') NOT NULL,
    `code` VARCHAR(80) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `display_order` INT NOT NULL DEFAULT 0,
    `parent_zone_code` VARCHAR(40) NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `catalog_items_kind_code_key`(`kind`, `code`),
    INDEX `catalog_items_kind_is_active_display_order_idx`(`kind`, `is_active`, `display_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey: people.identification_type_id → catalog_items
ALTER TABLE `people` ADD CONSTRAINT `people_identification_type_id_fkey` FOREIGN KEY (`identification_type_id`) REFERENCES `catalog_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
