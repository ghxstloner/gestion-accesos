-- AITSA companies API integration (get-consulta-empresas).
--
-- Companies can now be synchronised from the AITSA / Intelisis customer
-- registry. `external_client_id` stores the Intelisis `cliente_Id` and is the
-- primary match key for upserts; `dv` keeps the RUC check digit. Companies
-- created manually keep these columns NULL.

ALTER TABLE `companies`
  ADD COLUMN `dv` VARCHAR(10) NULL,
  ADD COLUMN `external_client_id` VARCHAR(40) NULL,
  ADD COLUMN `external_source` VARCHAR(20) NULL,
  ADD COLUMN `external_synced_at` DATETIME(3) NULL;

CREATE UNIQUE INDEX `companies_external_client_id_key` ON `companies`(`external_client_id`);
