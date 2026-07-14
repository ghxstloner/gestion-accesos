export type CredentialType =
  | 'PERMANENT_CARD'
  | 'TEMPORARY_PERSON_PASS'
  | 'TEMPORARY_VEHICLE_PASS'
  | 'TEMPORARY_EQUIPMENT_PASS';

export type CredentialStatus =
  | 'PENDING_PRODUCTION'
  | 'IN_PRODUCTION'
  | 'READY_FOR_DELIVERY'
  | 'DELIVERED'
  | 'SUSPENDED'
  | 'REVOKED'
  | 'EXPIRED'
  | 'CANCELLED';

export type CredentialEventType =
  | 'CREATED'
  | 'STARTED_PRODUCTION'
  | 'MARKED_READY'
  | 'DELIVERED'
  | 'REVERTED_PRODUCTION'
  | 'RETURNED_TO_PRODUCTION'
  | 'SUSPENDED'
  | 'REVOKED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'CORRECTED_DELIVERY';

export const CREDENTIAL_PREFIX: Record<CredentialType, string> = {
  PERMANENT_CARD: 'CAR',
  TEMPORARY_PERSON_PASS: 'PER',
  TEMPORARY_VEHICLE_PASS: 'VEH',
  TEMPORARY_EQUIPMENT_PASS: 'EQP',
};

export function formatCredentialNumber(
  type: CredentialType,
  year: number,
  sequence: number,
): string {
  return `${CREDENTIAL_PREFIX[type]}-${year}-${String(sequence).padStart(6, '0')}`;
}
