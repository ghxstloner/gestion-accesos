export const PERMISSIONS = [
  'companies.read',
  'companies.manage',
  'users.read',
  'users.manage',
  'people.read',
  'people.manage',
  'signers.read',
  'signers.manage',
  'catalogs.read',
  'catalogs.manage',
  'requests.create',
  'requests.read.own',
  'requests.read.company',
  'requests.read.all',
  'requests.submit',
  'requests.review',
  'requests.approve',
  'requests.reject',
  'requests.return',
  'issuance.read',
  'issuance.manage',
  'audit.read',
  'settings.manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  SYSTEM_ADMIN: [...PERMISSIONS],
  COMPANY_ADMIN: [
    'companies.read',
    'users.read',
    'users.manage',
    'people.read',
    'people.manage',
    'signers.read',
    'signers.manage',
    'catalogs.read',
    'requests.create',
    'requests.read.company',
    'requests.submit',
    'requests.review',
    'requests.return',
    'issuance.read',
  ],
  APPLICANT: [
    'companies.read',
    'people.read',
    'signers.read',
    'catalogs.read',
    'requests.create',
    'requests.read.own',
    'requests.submit',
  ],
  DOCUMENT_RECEIVER: [
    'companies.read',
    'users.read',
    'people.read',
    'signers.read',
    'catalogs.read',
    'requests.read.all',
    'requests.review',
    'requests.return',
  ],
  ACCESS_DOCUMENTS_MANAGER: [
    'companies.read',
    'users.read',
    'people.read',
    'signers.read',
    'catalogs.read',
    'requests.read.all',
    'requests.review',
    'requests.approve',
    'requests.reject',
    'requests.return',
    'issuance.read',
  ],
  CARD_ISSUER: [
    'companies.read',
    'people.read',
    'catalogs.read',
    'issuance.read',
    'issuance.manage',
    'requests.read.all',
  ],
};

export const ROLE_LABELS: Record<
  string,
  { name: string; description: string }
> = {
  SYSTEM_ADMIN: { name: 'System Admin', description: 'Full system access' },
  COMPANY_ADMIN: {
    name: 'Company Admin',
    description: 'Manages company users, people and requests',
  },
  APPLICANT: {
    name: 'Applicant',
    description: 'Creates and submits access requests',
  },
  DOCUMENT_RECEIVER: {
    name: 'Document Receiver',
    description: 'Reviews submitted documents',
  },
  ACCESS_DOCUMENTS_MANAGER: {
    name: 'Access Documents Manager',
    description: 'Approves or rejects requests',
  },
  CARD_ISSUER: {
    name: 'Card Issuer',
    description: 'Produces and delivers credentials',
  },
};

export const SYSTEM_ROLES = Object.keys(ROLE_PERMISSIONS);
