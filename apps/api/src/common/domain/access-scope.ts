export const CROSS_COMPANY_OPERATION_ROLES = new Set([
  'DOCUMENT_RECEIVER',
  'ACCESS_DOCUMENTS_MANAGER',
  'CARD_ISSUER',
]);

export function canReadAcrossCompanies(roles: readonly string[]): boolean {
  return (
    roles.includes('SYSTEM_ADMIN') ||
    roles.some((role) => CROSS_COMPANY_OPERATION_ROLES.has(role))
  );
}
