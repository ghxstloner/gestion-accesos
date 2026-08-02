-- CredentialEvents of type PHOTO_CAPTURED / PHOTO_UPLOADED / PHOTO_REUSED /
-- CUSTODY_DEPOSITED / CUSTODY_RETURNED / REPLACED (for the replacement child)
-- are recorded without a status transition. `to_status` must be nullable so
-- the repository can persist those events via CredentialEvent.create().
ALTER TABLE `credential_events`
  MODIFY COLUMN `to_status` ENUM(
    'PENDING_PRODUCTION','IN_PRODUCTION','READY_FOR_DELIVERY','DELIVERED',
    'SUSPENDED','REVOKED','EXPIRED','CANCELLED'
  ) NULL;
