CREATE TABLE `system_settings` (
  `id` VARCHAR(32) NOT NULL DEFAULT 'global',
  `company_name` VARCHAR(255) NOT NULL DEFAULT 'Gestión de Accesos',
  `logo_url` VARCHAR(512) NULL,
  `smtp_host` VARCHAR(255) NULL,
  `smtp_port` INTEGER NOT NULL DEFAULT 587,
  `smtp_security` VARCHAR(16) NOT NULL DEFAULT 'TLS',
  `smtp_username` VARCHAR(255) NULL,
  `smtp_password` VARCHAR(512) NULL,
  `from_email` VARCHAR(255) NULL,
  `from_name` VARCHAR(255) NULL,
  `reply_to_email` VARCHAR(255) NULL,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
