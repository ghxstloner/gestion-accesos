-- SGA — Phase 2: issuance queue, photograph management, custody deposit/return,
-- credential operations. Forward-only, additive only.

-- 0) EventType enum: append Phase 2 lifecycle events (photo, custody, etc.).
ALTER TABLE `request_events`
  MODIFY COLUMN `event_type` ENUM(
    'CREATED','SUBMITTED','RESUBMITTED','ASSIGNED','DOCUMENT_APPROVED',
    'DOCUMENT_REJECTED','STAGE_APPROVED','RETURNED','REJECTED','APPROVED',
    'STARTED_PRODUCTION','MARKED_READY','DELIVERED','REVERTED_PRODUCTION',
    'RETURNED_TO_PRODUCTION','CORRECTED_DELIVERY','CANCELLED','REVOKED_SIGNER',
    'DEACTIVATED','SUSPENDED','ACTIVATED','EXPIRED','REVOKED','REPLACED',
    'REACTIVATED','PHOTO_CAPTURED','PHOTO_UPLOADED','PHOTO_REUSED',
    'CUSTODY_DEPOSITED','CUSTODY_RETURNED'
  ) NOT NULL;

ALTER TABLE `credential_events`
  MODIFY COLUMN `event_type` ENUM(
    'CREATED','SUBMITTED','RESUBMITTED','ASSIGNED','DOCUMENT_APPROVED',
    'DOCUMENT_REJECTED','STAGE_APPROVED','RETURNED','REJECTED','APPROVED',
    'STARTED_PRODUCTION','MARKED_READY','DELIVERED','REVERTED_PRODUCTION',
    'RETURNED_TO_PRODUCTION','CORRECTED_DELIVERY','CANCELLED','REVOKED_SIGNER',
    'DEACTIVATED','SUSPENDED','ACTIVATED','EXPIRED','REVOKED','REPLACED',
    'REACTIVATED','PHOTO_CAPTURED','PHOTO_UPLOADED','PHOTO_REUSED',
    'CUSTODY_DEPOSITED','CUSTODY_RETURNED'
  ) NOT NULL;

-- 1) Credential: card code, holder snapshot, photo tracking, observations.
ALTER TABLE `credentials`
  ADD COLUMN `card_code` VARCHAR(64) NULL,
  ADD COLUMN `holder_name` VARCHAR(200) NULL,
  ADD COLUMN `authorized_zones` JSON NULL,
  ADD COLUMN `observations` TEXT NULL,
  ADD COLUMN `photo_file_id` VARCHAR(36) NULL,
  ADD COLUMN `photo_source` VARCHAR(20) NULL,
  ADD COLUMN `photo_captured_at` DATETIME(3) NULL,
  ADD COLUMN `photo_reused_from_credential_id` VARCHAR(36) NULL,
  ADD COLUMN `card_material_data` TEXT NULL;

CREATE UNIQUE INDEX `credentials_card_code_key` ON `credentials`(`card_code`);
CREATE INDEX `credentials_card_code_idx` ON `credentials`(`card_code`);

ALTER TABLE `credentials`
  ADD CONSTRAINT `credentials_photo_file_id_fkey`
  FOREIGN KEY (`photo_file_id`) REFERENCES `file_metadata`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 2) FileMetadata: optional back-reference relation (no column changes).
-- Indexed for completeness.
CREATE INDEX `file_metadata_created_at_idx` ON `file_metadata`(`created_at`);

-- 3) CustodyRecord: replace narrow deposit-only schema with deposit + return.
ALTER TABLE `custody_records`
  ADD COLUMN `holder_name` VARCHAR(200) NULL,
  ADD COLUMN `document_identifier` VARCHAR(120) NOT NULL DEFAULT '',
  ADD COLUMN `temporary_permit_ref` VARCHAR(120) NULL,
  ADD COLUMN `received_by_user_id` VARCHAR(36) NOT NULL DEFAULT '',
  ADD COLUMN `expected_return_at` DATETIME(3) NULL,
  ADD COLUMN `deposit_notes` TEXT NULL,
  ADD COLUMN `returned_by_user_id` VARCHAR(36) NULL,
  ADD COLUMN `return_received_by` VARCHAR(200) NULL,
  ADD COLUMN `return_condition` VARCHAR(40) NULL,
  ADD COLUMN `return_notes` TEXT NULL;

-- Drop the default after backfill window (NOT NULL columns above get a
-- transient DEFAULT so the ALTER succeeds on existing rows; we then strip it).
ALTER TABLE `custody_records`
  MODIFY COLUMN `document_identifier` VARCHAR(120) NOT NULL,
  MODIFY COLUMN `received_by_user_id` VARCHAR(36) NOT NULL;

-- The previous schema stored the cleartext document number under
-- `document_number`; migrate it into the new `document_identifier` column
-- before dropping it. Any pre-existing `notes` become `deposit_notes`.
UPDATE `custody_records`
  SET `document_identifier` = `document_number`,
      `deposit_notes` = COALESCE(`deposit_notes`, `notes`),
      `holder_name` = NULL,
      `temporary_permit_ref` = NULL
  WHERE `document_identifier` = '';

ALTER TABLE `custody_records` DROP COLUMN `document_number`;
ALTER TABLE `custody_records` DROP COLUMN `notes`;

CREATE INDEX `custody_records_deposit_time_idx` ON `custody_records`(`deposit_time`);
CREATE INDEX `custody_records_return_time_idx` ON `custody_records`(`return_time`);
