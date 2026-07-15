import { canReadAcrossCompanies } from './access-scope';

describe('canReadAcrossCompanies', () => {
  it.each([
    'SYSTEM_ADMIN',
    'DOCUMENT_RECEIVER',
    'ACCESS_DOCUMENTS_MANAGER',
    'CARD_ISSUER',
  ])('allows the cross-company role %s', (role) => {
    expect(canReadAcrossCompanies([role])).toBe(true);
  });

  it.each(['COMPANY_ADMIN', 'APPLICANT'])('keeps %s company-scoped', (role) => {
    expect(canReadAcrossCompanies([role])).toBe(false);
  });
});
