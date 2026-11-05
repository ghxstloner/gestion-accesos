import {
  missingRequiredDocuments,
  requiredDocumentCodes,
  requiresApplicantPrerequisites,
} from './access-prerequisites';

describe('access prerequisites', () => {
  it('applies only to permanent card requests', () => {
    expect(requiresApplicantPrerequisites('PERMANENT_CARD')).toBe(true);
    expect(requiresApplicantPrerequisites('TEMPORARY_VEHICLE')).toBe(false);
    expect(requiresApplicantPrerequisites(null)).toBe(false);
    expect(requiredDocumentCodes('TEMPORARY_PERSON', 'SUPPLIER')).toEqual([]);
  });

  it('requires SMS and AVSEC certificates for renewals', () => {
    expect(requiredDocumentCodes('PERMANENT_CARD', 'RENEWAL')).toEqual([
      'CERT_SMS',
      'CERT_AVSEC',
    ]);
  });

  it('adds photo and drug test for first-entry personnel', () => {
    expect(requiredDocumentCodes('PERMANENT_CARD', 'FIRST_ENTRY')).toEqual([
      'CERT_SMS',
      'CERT_AVSEC',
      'FOTO',
      'ANTIDOPING',
    ]);
  });

  it('adds the payment receipt only for suppliers', () => {
    expect(requiredDocumentCodes('PERMANENT_CARD', 'SUPPLIER')).toEqual([
      'CERT_SMS',
      'CERT_AVSEC',
      'FOTO',
      'ANTIDOPING',
      'COMPROBANTE_PAGO',
    ]);
  });

  it('reports the documents still missing', () => {
    expect(
      missingRequiredDocuments('PERMANENT_CARD', 'SUPPLIER', [
        'CERT_SMS',
        'FOTO',
        'CEDULA',
      ]),
    ).toEqual(['CERT_AVSEC', 'ANTIDOPING', 'COMPROBANTE_PAGO']);
  });
});
