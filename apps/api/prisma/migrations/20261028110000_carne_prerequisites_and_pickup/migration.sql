-- Carné prerequisites (Vicepresidencia de Seguridad) and pickup appointment.
--
-- 1. requests.applicant_category: RENEWAL / FIRST_ENTRY / SUPPLIER. Decides
--    which documents are mandatory before a PERMANENT_CARD request can be
--    submitted. NULL for legacy rows and request types without prerequisites.
-- 2. credentials.pickup_scheduled_at / pickup_location: date and window
--    (default "Ventanilla 3") assigned when the card is marked ready.
-- 3. DOCUMENT_TYPE catalog entries for the new mandatory documents, inserted
--    here as well as in the seed so environments that never re-run the seed
--    still get them. Existing rows are left untouched.

ALTER TABLE `requests`
  ADD COLUMN `applicant_category` ENUM('RENEWAL', 'FIRST_ENTRY', 'SUPPLIER') NULL;

ALTER TABLE `credentials`
  ADD COLUMN `pickup_scheduled_at` DATETIME(3) NULL,
  ADD COLUMN `pickup_location` VARCHAR(120) NULL;

INSERT IGNORE INTO `catalog_items` (`id`, `kind`, `code`, `name`, `description`, `is_active`, `display_order`, `created_at`, `updated_at`) VALUES
  (UUID(), 'DOCUMENT_TYPE', 'CERT_SMS', 'Certificado de prueba SMS', 'Sistema de Gestión de la Seguridad Operacional', true, 0, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  (UUID(), 'DOCUMENT_TYPE', 'CERT_AVSEC', 'Certificado de prueba AVSEC', 'Seguridad de la Aviación Civil', true, 0, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  (UUID(), 'DOCUMENT_TYPE', 'FOTO', 'Fotografía tipo carnet', NULL, true, 0, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  (UUID(), 'DOCUMENT_TYPE', 'ANTIDOPING', 'Resultado negativo de prueba de antidoping', NULL, true, 0, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  (UUID(), 'DOCUMENT_TYPE', 'COMPROBANTE_PAGO', 'Comprobante de pago', 'Aplica solo a proveedores; se gestiona en caja', true, 0, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));

UPDATE `catalog_items`
  SET `name` = 'Fotografía tipo carnet', `updated_at` = CURRENT_TIMESTAMP(3)
  WHERE `kind` = 'DOCUMENT_TYPE' AND `code` = 'FOTO' AND `name` = 'Fotografía';
