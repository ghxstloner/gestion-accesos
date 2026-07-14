export interface AuthenticatedUser {
  userId: string;
  companyId: string | null;
  email: string;
  roles: string[];
  permissions: string[];
  correlationId?: string;
}
