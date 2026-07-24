# SGA — Eliminación del módulo Personas + Arquitectura de Snapshots

**Fecha:** 2026-07-22
**Estado:** ✅ COMPLETO (backend typecheck OK, frontend typecheck OK, 97/97 tests)
**Alcance:** Eliminar por completo el dominio `Person` del frontend y consolidar los datos biométricos/demográficos de beneficiarios en snapshots inmutables dentro de `RequestParticipant`.

---

## 1. Decisión de arquitectura

**Problema:** El módulo `Person` era redundante con `User`. El usuario exigió:
- No extender `User` con campos demográficos.
- Los datos personales de titulares/participantes/visitantes deben pertenecer al dominio de Solicitudes.
- Capturar data directamente en `RequestParticipant` (snapshots).
- Mantener compatibilidad con autocompletado opcional desde `User`.
- Los beneficiarios NO requieren cuenta `User` (entrada manual válida).
- Migrar solo después de proponer cambios de schema.
- Tests requeridos.
- Snapshots inmutables post-submit.

**Solución:** Modelo **híbrido snapshot-direct**:
- `RequestParticipant` contiene TODOS los campos demográficos (`fullNameSnapshot`, `identificationSnapshot`, `identificationTypeCode`, `positionSnapshot`, `departmentSnapshot`, `companyNameSnapshot`, `personalEmergency`, `usePreviousPhoto`).
- `participantUserId` es **opcional** — vinculación suave con `User` solo para autocompletar/prellenar al crear.
- Una vez capturado el snapshot, el participante vive independiente de `User` (cumple inmutabilidad post-submit; si el `User` se borra, `participantUserId` se setea a NULL pero los snapshots persisten).

---

## 2. Cambios de base de datos

### 2.1 Migración `20260722100000_request_participant_snapshot_required`

```sql
-- 1. participantUserId nullable (antes era NOT NULL)
ALTER TABLE `request_participants` MODIFY `participant_user_id` CHAR(36) NULL;
-- 2. FK a SET NULL (preserva snapshots si User se borra)
ALTER TABLE `request_participants` DROP FOREIGN KEY ...,
  ADD CONSTRAINT ... FOREIGN KEY (`participant_user_id`)
  REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
-- 3. Recrear unique key para permitir múltiples participantes manuales con mismo nombre
ALTER TABLE `request_participants` DROP INDEX ...,
  ADD UNIQUE INDEX `request_participants_request_id_participant_user_id_full__idx`
  ON `request_participants`(`request_id`,`participant_user_id`,`full_name_snapshot`);
-- 4. Nueva columna: identificationTypeCode (tipo de documento en snapshot)
ALTER TABLE `request_participants` ADD COLUMN `identification_type_code` VARCHAR(20) NULL;
```

**Aplicada a `sga_dev`.** Los 6 registros existentes (todos con `participantUserId`) se preservaron sin cambios — solo recibieron la nueva columna nullable.

### 2.2 Schema Prisma (`apps/api/prisma/schema.prisma`)

`RequestParticipant`:
- `participantUserId String?`
- `identificationTypeCode String? @map("identification_type_code") @db.VarChar(20)`
- `participantUser User? @relation(...) @map("participant_user_id")` con `onDelete: SetNull`
- `@@unique([requestId, participantUserId, fullNameSnapshot])`

---

## 3. Cambios de backend

### 3.1 Capa de dominio

`apps/api/src/modules/requests/domain/entities/request.entity.ts`:
- `RequestParticipantLink`: `participantUserId: string | null`, agregado `identificationTypeCode: string | null`.
- `addParticipant()` refactorizado con **detección híbrida de duplicados**:
  - Si `participantUserId` presente → compara por user id.
  - Si entrada manual → compara por `fullNameSnapshot` case-insensitive.
- Docblock actualizado: "associated people" → "associated participants".

### 3.2 Capa de aplicación

`apps/api/src/modules/requests/application/request.service.ts`:
- `CreateRequestInput.participants` extendido con todos los snapshots.
- Validación: permite participante manual (sin `participantUserId`) **O** vinculado a User.
- `makeParticipantLink()` ahora es **async** y recibe `actor` para resolver `participantUserId` y pre-llenar snapshots (`autocompleteFromUser=true`) desde `UserResponseDto` cuando faltan.
- `personService` renombrado a `userService` (3 sites) — `UserService` ya era el inyector real; el nombre `personService` era vestigial.

### 3.3 Capa de infraestructura

- `request.mapper.ts::toParticipantLink` incluye `identificationTypeCode`.
- `request.repository.prisma.ts::syncChildren` inserta `identificationTypeCode` vía `createMany`.

### 3.4 Capa de presentación

- `request.dto.ts::ParticipantLinkDto`: `participantUserId` opcional, snapshots requeridos, opción `autocompleteFromUser`.
- `request.presenter.ts::ParticipantLinkResponse`: incluye `participantUserId: string | null` + `identificationTypeCode`.

### 3.5 Tests

`apps/api/src/modules/requests/domain/entities/request.entity.spec.ts` (NUEVO, 5 tests):
1. Participante manual OK sin `participantUserId`.
2. Duplicado manual mismo nombre → rechazado.
3. Duplicado via `participantUserId` → rechazado.
4. Mixed (manual + vinculado) coexisten.
5. `removeParticipant()` por id.

Suite completa: **97/97 passing** (10 test suites).

### 3.6 Permisos

`apps/api/src/modules/identity/domain/permissions.ts`:
- Removidos `people.read` y `people.manage` de `PERMISSIONS` y de los 4 roles (COMPANY_ADMIN, APPLICANT, DOCUMENT_RECEIVER, ACCESS_DOCUMENTS_MANAGER, CARD_ISSUER).
- Descripción de `COMPANY_ADMIN` actualizada.

---

## 4. Cambios de frontend

### 4.1 Tipos y mapping

- `lib/types.ts`: Eliminada `interface Person`. `RequestParticipantView` extendido con snapshots + `identificationTypeCode`.
- `hooks/api-workflow-hooks.ts::RequestResponse.participants` con todos los snapshots; alias legacy `personLinks` mantenido como respaldo.
- `lib/request-mapping.ts`: mapping de participants con null-safe trim/fallback.

### 4.2 Eliminación del módulo Person

- **DELETE** `apps/web/app/(app)/people/` (page.tsx, new/, [id]/).
- **DELETE** `apps/web/components/shared/PersonForm.tsx`.
- **DELETE** sección People en `hooks/api-hooks.ts` (~200 líneas): `PersonResponse`, `usePeopleQuery`, `usePersonQuery`, `useCreatePersonMutation`, `useUpdatePersonMutation`, `useTogglePersonStatusMutation`, `useUploadPersonPhotoMutation`, `toPerson`, `PersonWriteInput`, `toPersonWriteInput`.
- **DELETE** `import { Person }` en `hooks/api-hooks.ts`.

### 4.3 Migración de consumidores

| Archivo | Antes | Después |
|---|---|---|
| `requests/page.tsx` | `usePeopleQuery()` + `personName(primaryPersonId)` | Snapshot directo de `request.participants.find(role==='PRIMARY')?.fullName` |
| `requests/[id]/page.tsx` | `usePeopleQuery()` + `people.find(id===personId)` | `request.participants` snapshots |
| `reviews/[id]/page.tsx` | `usePeopleQuery()` + `people.find(...)` | Eliminado (no usado post-migración anterior) |
| `issuance/page.tsx` | `usePeopleQuery()` + `people.find(primaryPersonId)` + 4× `people={people}` props | ❌ Eliminado `personId` payload; listado muestra solo company |
| `components/shared/CredentialView.tsx` | `Person` prop + `personExtras` lookup | `RequestParticipantView` directo (snapshot-driven) |
| `components/shared/PermissionMatrix.tsx` | `people.read`/`people.manage` en catálogo y 5 roles | Eliminados del catálogo y roles |

### 4.4 Wizard `requests/new/page.tsx` (paso 3 — Beneficiarios)

Refactor completo:
- Eliminados: `PersonForm`, `useCreatePersonMutation`, `usePeopleQuery`, `toPersonWriteInput`.
- Nuevo: `DraftBeneficiary` interface + `BeneficiaryEditorDialog` (~200 líneas) con:
  - Selector opcional de `User` (autocomplete).
  - Todos los snapshots demográficos requeridos por formularios AIT (datos personales, emergencia, usePreviousPhoto).
  - Primary selector (radio) + edit/remove por beneficiario.
- Paso 8 (review) actualizado a lista editable con snapshots.

### 4.5 BeneficiariaarioDialog — Capturas de campos desde formularios reales

Basado en extracción PDF/docx (`FORMULARIO-Solicitud de carné (AIT)_2025.pdf`, `Especificacion_Tecnica_Sistema_SGA.docx`), los campos obligatorios capturados:
- `fullNameSnapshot` (DATOS PERSONALES)
- `identificationTypeCode` + `identificationSnapshot` (cédula/pasaporte)
- `positionSnapshot`, `departmentSnapshot`, `companyNameSnapshot` (DATOS INSTITUCIÓN)
- `personalEmergency` (bot SI/NO)
- `usePreviousPhoto` (especificación técnica)

---

## 5. Archivos modificados (resumen)

### Backend (8)
1. `apps/api/prisma/schema.prisma` — model RequestParticipant
2. `apps/api/prisma/migrations/20260722100000_request_participant_snapshot_required/migration.sql` — NUEVO
3. `apps/api/src/modules/requests/domain/entities/request.entity.ts` — addParticipant, identificationTypeCode, docblock
4. `apps/api/src/modules/requests/domain/entities/request.entity.spec.ts` — NUEVO (5 tests)
5. `apps/api/src/modules/requests/application/request.service.ts` — makeParticipantLink async + userService rename
6. `apps/api/src/modules/requests/infrastructure/persistence/mappers/request.mapper.ts`
7. `apps/api/src/modules/requests/infrastructure/persistence/repositories/request.repository.prisma.ts`
8. `apps/api/src/modules/requests/presentation/dto/request.dto.ts`
9. `apps/api/src/modules/requests/presentation/presenters/request.presenter.ts`
10. `apps/api/src/modules/identity/domain/permissions.ts`

### Frontend (10)
1. `apps/web/lib/types.ts` — Person eliminado, RequestParticipantView extendido
2. `apps/web/lib/request-mapping.ts` — participants con snapshots
3. `apps/web/hooks/api-hooks.ts` — sección People eliminada
4. `apps/web/hooks/api-workflow-hooks.ts` — participantes con snapshots
5. `apps/web/app/(app)/requests/new/page.tsx` — wizard refactor
6. `apps/web/app/(app)/requests/[id]/page.tsx` — participantes snapshot
7. `apps/web/app/(app)/requests/page.tsx` — primaryName desde snapshot
8. `apps/web/app/(app)/reviews/[id]/page.tsx` — cleanup imports
9. `apps/web/app/(app)/issuance/page.tsx` — people.find eliminado
10. `apps/web/components/shared/CredentialView.tsx` — RequestParticipantView
11. `apps/web/components/shared/PermissionMatrix.tsx` — permisos people eliminados

### Eliminados (DELETE)
- `apps/web/app/(app)/people/page.tsx`
- `apps/web/app/(app)/people/new/page.tsx`
- `apps/web/app/(app)/people/[id]/page.tsx`
- `apps/web/components/shared/PersonForm.tsx`

---

## 6. Validación final

| Check | Resultado |
|---|---|
| `npm run typecheck` (api) | ✅ EXIT=0 |
| `npm run typecheck` (web) | ✅ EXIT=0 |
| `npm test` (api) | ✅ 97/97 |
| `npm run lint:fix` (api) | ✅ sin errores |
| Migración aplicada a `sga_dev` | ✅ MySQL confirmado |
| Prisma client regenerado | ✅ |

---

## 7. Estado del módulo Person en runtime

- **Frontend:** no existe ruta, no existe hook, no existe tipo, no existe permiso. Búsqueda: 0 referencias en source (solo caches `.next/` stale y docs de auditoría histórica).
- **Backend:** el dominio `Person` no existía desde consolidación previa (2026-07-21). Hoy los permisos `people.*` y el field `personService` ya no existen.
- **DB:** la tabla física `people` sigue existiendo (legacy schema) pero **ningún código vivo la referencia**. Queda como historical preservation — no se ha tocado la data existente ni se han creado scripts de dropeo porque no fue solicitado.

---

## 8. Próximos pasos sugeridos (NO ejecutados — esperando aprobación)

1. Si se desea, crear dropeo físico de la tabla `people` (con FKs `request_persons`, identification_types) — requiere migración de preservación o respaldo.
2. Documentar la UI de captura de snapshots en manual de usuario.
3. Frontend: generar snapshot edit-only (NO editable después de submit) — reforzar inmutabilidad con UI.
4. Audit retroactive: revisar 6 registros migrados y confirmar consistencia de snapshots vs User vinculado.
