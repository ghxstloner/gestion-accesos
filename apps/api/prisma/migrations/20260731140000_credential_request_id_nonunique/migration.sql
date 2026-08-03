-- A request may legitimately spawn multiple credentials over its lifetime
-- (replacements for damaged/lost cards), so the unique constraint on
-- credentials.request_id must go.

-- MySQL refuses to drop the unique index while a FK uses it. Create a plain
-- index on request_id FIRST so the FK has an index to lean on, then drop the
-- unique.
CREATE INDEX `credentials_request_id_idx`
  ON `credentials`(`request_id`);

ALTER TABLE `credentials` DROP INDEX `credentials_request_id_key`;

-- Replacement traceability: the original credential this one replaces.
-- NULL for primary issuances; populated on replace().
ALTER TABLE `credentials`
  ADD COLUMN `replaces_credential_id` VARCHAR(36) NULL;

ALTER TABLE `credentials`
  ADD CONSTRAINT `credentials_replaces_credential_id_fkey`
  FOREIGN KEY (`replaces_credential_id`) REFERENCES `credentials`(`id`)
  ON DELETE SET NULL;

CREATE INDEX `credentials_replaces_credential_id_idx`
  ON `credentials`(`replaces_credential_id`);
