# SGA - Resultados de Pruebas y Certificación de Calidad

**Fecha de Actualización:** 21 de Julio de 2026  
**Proyecto:** SGA - Aeropuerto Internacional de Tocumen, S.A.  

---

## 1. Resumen de Ejecución de Suites de Prueba (Backend & Frontend)

| Suite / Comando | Componente / Ubicación | Código de Salida | Pruebas Totales | Aprobadas | Fallidas | Tiempo | Estado |
|---|---|---|---|---|---|---|---|
| `jest --no-cache` | `apps/api` | **0** | 10 | 10 | 0 | 10.2s | **VERDE:** Suites aprobadas (`access-scope.spec.ts` y `auth-document.spec.ts`). |
| `npx prisma validate` | `apps/api` | **0** | Schema Validation | OK | 0 | 0.5s | **VERDE:** `schema.prisma` válido. |
| `npx prisma migrate status` | `apps/api` | **0** | 15 Migraciones | 15 | 0 | 1.2s | **VERDE:** 15/15 migraciones al día. |
| `npm run prisma:seed` | `apps/api` | **0** | Seed DB | 18 Users | 0 | 2.1s | **VERDE:** Administrador Yoiner Moreno y 18 usuarios de prueba creados. |
| `npm run build` | `apps/api` | **0** | NestJS App | Build OK | 0 | 12.0s | **VERDE:** Compilación limpia de NestJS CLI. |
| `npm run typecheck` | `apps/web` | **0** | Next.js Frontend | 0 errores | 0 | 11.5s | **VERDE:** TypeScript sin errores. |

---

## 2. Detalle de Pruebas de Dominio e Integración Ejecutadas

### Suite 1: `src/common/domain/access-scope.spec.ts`
- `√ allows the cross-company role SYSTEM_ADMIN`
- `√ allows the cross-company role DOCUMENT_RECEIVER`
- `√ allows the cross-company role ACCESS_DOCUMENTS_MANAGER`
- `√ allows the cross-company role CARD_ISSUER`
- `√ keeps COMPANY_ADMIN company-scoped`
- `√ keeps APPLICANT company-scoped`

### Suite 2: `src/modules/identity/domain/auth-document.spec.ts`
- `√ normalizes document numbers by removing leading/trailing spaces and converting to uppercase`
- `√ ensures minimal JWT payload structure without sensitive document or password hash data`
- `√ calculates lockout threshold correctly after 5 failed attempts`
- `√ resets attempt counter to 0 on successful login`
