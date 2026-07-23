# SGA - Mapa de Referencias de Identidad (Identity Reference Map)

**Fecha:** 21 de Julio de 2026  
**Proyecto:** SGA - Aeropuerto Internacional de Tocumen, S.A.  

---

## 1. Mapeo Único de Entidades de Dominio a `User`

Con la eliminación del modelo `Person`, todas las relaciones humanas del sistema fueron auditadas y reasignadas a la entidad `User` utilizando nombres de columna explícitos según el rol del actor:

| Entidad / Tabla | Nombre de Columna | Definición Semántica de la Relación | Regla de Borrado (`onDelete`) |
|---|---|---|---|
| `Request` | `createdByUserId` | Usuario solicitante / creador del trámite | `Restrict` (Preserva historia) |
| `RequestParticipant` | `participantUserId` | Titular o beneficiario del pase | `Restrict` (Preserva historia) |
| `CompanyAuthorizedSigner` | `signerUserId` | Firmante autorizado de la empresa | `Restrict` (Preserva historia) |
| `Credential` | `subjectUserId` | Titular de la credencial emitida | `SetNull` (Preserva credencial) |
| `CustodyRecord` | `subjectUserId` | Usuario que deposita cédula/pasaporte | `Restrict` (Preserva custodia) |
| `DeliveryRecord` | `deliveredByUserId` | Oficial de accesos que entrega el carné | Preservado en log |
| `RequestEvent` | `actorUserId` | Usuario que ejecutó la transición de estado | Preservado en audit log |
| `ReviewTask` | `assignedToUserId` | Revisor/Aprobador asignado a la tarea | Preservado en auditoría |
| `AuditEvent` | `actorUserId` | Usuario actor de la acción registrada | `SetNull` / Inmutable |
| `AuthIdentity` | `userId` | Credenciales de seguridad del usuario (1:1) | `Cascade` |
| `PasswordRecoveryChallenge` | `userId` | Desafío temporal de restablecimiento | `Cascade` |
| `RefreshSession` | `userId` | Sesión activa de token de refresco | `Cascade` |

---

## 2. Clasificación de Coincidencias de Términos Legacy

Tras la ejecución de búsquedas globales en el repositorio (excluyendo `node_modules`, `dist` y `generated`), la clasificación de coincidencias del término `person` es la siguiente:

- **Código Activo Inadecuado:** **0 coincidencias** (No existen controladores, servicios, repositorios ni componentes activos que dependan de la entidad `Person`).
- **Migración Histórica Legítima:** Coincidencias en archivos SQL de migraciones iniciales (`20260714060000_create_people_and_signers`).
- **Enums y Vocabulario Legítimo del Dominio:**
  - `TEMPORARY_PERSON`: Nombre de variante en el enum `RequestType` y `CredentialType` para distinguir pases temporales de personas frente a vehículos o equipos.
  - `RequestParticipantRole`: Enum para clasificar a los usuarios participantes como `PRIMARY` (titular) o `BENEFICIARY` (beneficiario).
