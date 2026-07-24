-- RequestParticipant: snapshot demográfico obligatorio para participantes
-- manuales (sin cuenta User). participantUserId se vuelve nullable para
-- permitir beneficiarios no autenticados (visitantes / contratistas sin
-- cuenta SGA). Los 5 snapshot columns se mantienen nullable a nivel DB
-- (la validación de "fullNameSnapshot o participantUserId requerido" vive
-- en application layer), pero el FK pasa a ON DELETE SET NULL para preservar
-- el snapshot histórico si un User se desactiva/borra.

-- 1) participantUserId nullable
ALTER TABLE `request_participants`
  MODIFY `participant_user_id` VARCHAR(191) NULL;

-- 2) FK ON DELETE SET NULL (preserva historial al desactivar User)
ALTER TABLE `request_participants`
  DROP FOREIGN KEY `request_participants_participant_user_id_fkey`;

ALTER TABLE `request_participants`
  ADD CONSTRAINT `request_participants_participant_user_id_fkey`
    FOREIGN KEY (`participant_user_id`) REFERENCES `users`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- 3) Unique key compuesto: permite múltiples participantes manuales
--    (participantUserId NULL) en la misma request, identificándolos por
--    fullNameSnapshot. Sigue impidiendo duplicar el mismo User × request.
ALTER TABLE `request_participants`
  DROP INDEX `request_participants_request_id_participant_user_id_key`;

ALTER TABLE `request_participants`
  ADD UNIQUE KEY `request_participants_request_id_user_name_key`
    (`request_id`, `participant_user_id`, `full_name_snapshot`);

-- 4) Nuevo campo: tipo de identificación (Cedula / Pasaporte / Extranjera).
--    El form AIT distingue explícitamente estos tipos, distinto de la
--    identificaciónSnapshot que solo guarda el número.
ALTER TABLE `request_participants`
  ADD COLUMN `identification_type_code` VARCHAR(20) NULL
    AFTER `use_previous_photo`;

-- Nota: las columnas "snapshot" ya existen desde la migration
-- 20260714060200_create_requests_and_subjects. No se modifican aquí.
