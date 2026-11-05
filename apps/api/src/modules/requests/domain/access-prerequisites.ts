/**
 * Carné issuance prerequisites (Vicepresidencia de Seguridad, AITSA).
 *
 *  - Every applicant must have passed the SMS (Sistema de Gestión de la
 *    Seguridad Operacional) and AVSEC (Seguridad de la Aviación Civil) tests
 *    BEFORE the request is submitted — evidenced by uploading both
 *    certificates.
 *  - Suppliers and first-entry personnel must also attach a carné-style
 *    photograph and a negative drug test result.
 *  - Suppliers additionally attach the payment receipt (processed at the
 *    cashier's office).
 *
 * Document codes are DOCUMENT_TYPE catalog codes (see catalog-seeds.ts).
 */

export const APPLICANT_CATEGORIES = [
  'RENEWAL',
  'FIRST_ENTRY',
  'SUPPLIER',
] as const;

export type ApplicantCategory = (typeof APPLICANT_CATEGORIES)[number];

export const APPLICANT_CATEGORY_LABELS: Record<ApplicantCategory, string> = {
  RENEWAL: 'Renovación',
  FIRST_ENTRY: 'Personal de primer ingreso',
  SUPPLIER: 'Proveedor',
};

/** Request types subject to the carné prerequisites. */
export const PREREQUISITE_REQUEST_TYPE_CODES: readonly string[] = [
  'PERMANENT_CARD',
];

export const SMS_AVSEC_DOCUMENT_CODES = ['CERT_SMS', 'CERT_AVSEC'] as const;

export const PREREQUISITE_DOCUMENT_LABELS: Record<string, string> = {
  CERT_SMS: 'Certificado de prueba SMS',
  CERT_AVSEC: 'Certificado de prueba AVSEC',
  FOTO: 'Fotografía tipo carnet',
  ANTIDOPING: 'Resultado negativo de prueba de antidoping',
  COMPROBANTE_PAGO: 'Comprobante de pago',
};

export const DEFAULT_PICKUP_LOCATION = 'Ventanilla 3';

export function requiresApplicantPrerequisites(
  requestTypeCode: string | null | undefined,
): boolean {
  return (
    !!requestTypeCode &&
    PREREQUISITE_REQUEST_TYPE_CODES.includes(requestTypeCode)
  );
}

export function isApplicantCategory(
  value: unknown,
): value is ApplicantCategory {
  return (
    typeof value === 'string' &&
    (APPLICANT_CATEGORIES as readonly string[]).includes(value)
  );
}

/**
 * DOCUMENT_TYPE codes that must be uploaded before submitting a request of
 * the given type for the given applicant category. Empty when the request
 * type is not subject to the prerequisites.
 */
export function requiredDocumentCodes(
  requestTypeCode: string | null | undefined,
  category: ApplicantCategory | null | undefined,
): string[] {
  if (!requiresApplicantPrerequisites(requestTypeCode)) return [];
  const codes: string[] = [...SMS_AVSEC_DOCUMENT_CODES];
  if (category === 'FIRST_ENTRY' || category === 'SUPPLIER') {
    codes.push('FOTO', 'ANTIDOPING');
  }
  if (category === 'SUPPLIER') {
    codes.push('COMPROBANTE_PAGO');
  }
  return codes;
}

/** Codes from {@link requiredDocumentCodes} that are not in `uploadedCodes`. */
export function missingRequiredDocuments(
  requestTypeCode: string | null | undefined,
  category: ApplicantCategory | null | undefined,
  uploadedCodes: readonly string[],
): string[] {
  const uploaded = new Set(uploadedCodes);
  return requiredDocumentCodes(requestTypeCode, category).filter(
    (code) => !uploaded.has(code),
  );
}
