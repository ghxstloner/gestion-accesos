ALTER TABLE `users`
  ADD COLUMN `must_change_password` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `photo_url` VARCHAR(512) NULL;

ALTER TABLE `people`
  ADD COLUMN `photo_url` VARCHAR(512) NULL;
