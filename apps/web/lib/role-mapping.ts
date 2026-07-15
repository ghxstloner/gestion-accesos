import type { AuthenticatedProfile, Role } from '@/lib/types';

/**
 * Mapea los códigos de rol del backend (`SYSTEM_ADMIN`, `COMPANY_ADMIN`, ...)
 * al `Role` del frontend, que usa nombres distintos (p. ej. `ADMIN_GENERAL`).
 *
 * El backend devuelve `roles: string[]`; el frontend opera con un único rol
 * activo. Tomamos el primero de mayor jerarquía presente en el array.
 *
 * Este es un mapping temporal mientras el frontend y el backend convergen:
 * el frontend usa etiquetas orientadas a presentación y el backend conserva
 * los códigos estables del dominio. Este adaptador mantiene esa frontera.
 */
const ROLE_PRIORITY: Role[] = [
  'ADMIN_GENERAL',
  'ADMIN_EMPRESA',
  'JEFE_DOCUMENTOS',
  'REVISOR',
  'EMISOR_CARNE',
  'SOLICITANTE',
];

const BACKEND_TO_FRONTEND: Record<string, Role> = {
  SYSTEM_ADMIN: 'ADMIN_GENERAL',
  COMPANY_ADMIN: 'ADMIN_EMPRESA',
  APPLICANT: 'SOLICITANTE',
  DOCUMENT_RECEIVER: 'REVISOR',
  ACCESS_DOCUMENTS_MANAGER: 'JEFE_DOCUMENTOS',
  CARD_ISSUER: 'EMISOR_CARNE',
};

export function mapBackendRoleToFrontend(backendRoles: string[]): Role {
  const frontendRoles = backendRoles
    .map((r) => BACKEND_TO_FRONTEND[r])
    .filter((r): r is Role => Boolean(r));

  for (const candidate of ROLE_PRIORITY) {
    if (frontendRoles.includes(candidate)) return candidate;
  }
  // Si el backend devuelve un rol desconocido, defaults a SOLICITANTE
  // (permiso mínimo) para no abrir acceso por accidente.
  return 'SOLICITANTE';
}

export function profileFromUserResponse(
  user: AuthenticatedProfile,
): AuthenticatedProfile {
  return user;
}
