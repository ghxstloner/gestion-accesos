# SGA — Matriz de Flujos (Flow Matrix)

**Proyecto:** SGA — Aeropuerto Internacional de Tocumen, S.A.
**Fecha:** 23 de Julio de 2026 · **Auditoría de solo lectura**

---

## 0. Advertencia metodológica

Las fuentes funcionales declaradas son los diagramas `docs/references/carnet1.png .. carnet4.png` + los PDFs de formularios en `docs/references/`.

> **Limitación de la auditoría actual:** el modelo que ejecuta la auditoría **no dispone de capacidad visual** para interpretar PNG/JPG. Por tanto, las swimlanes y pasos detallados de cada diagrama fueron **reconstruidos** a partir de:
> 1. La matriz de trazabilidad preexistente `docs/audits/SGA_REQUIREMENTS_TRACEABILITY.md` (líneas 10–35).
> 2. El GAP matrix (`docs/audits/SGA_GAP_MATRIX.md`) — citan explícitamente "Formulario Permiso Temporal" y "Examen AIT".
> 3. La especificación técnica referenciada (`docs/references/Especificacion_Tecnica_Sistema_SGA.docx`).
> 4. La estructura del schema Prisma (entidades/discriminadores).
> 5. La nomenclatura observada de tipos de solicitud en la seed: `PERMANENT_CARD`, `TEMPORARY_PERSON`, `TEMPORARY_VEHICLE`.
>
> **Todo lo marcado como DERIVADO-FROM-DOC debe revalidarse contra la imagen real.** Donde se encontró evidencia directa de código se marca **CODE-EVIDENCE** y se cita ruta + línea.

Clasificación binaria por paso:
**COMPLETE** · **PARTIAL** · **MISSING** · **BROKEN** · **UNVERIFIED**.

---

## 1. Matriz unificada de actores (swimlanes identificados)

| Actor / Swimlane | Origen | Modelo Prisma que lo respalda |
|---|---|---|
| Solicitante / Empresa | Todo diagrama | `User` (companyId) + `User` rol `APPLICANT` |
| Firmante Autorizado | Inicio de cada solicitud | `CompanyAuthorizedSigner` (signerUserId, state ACTIVE/REVOKED) |
| Receptor de Documentos | Diagrama A | `User` rol `DOCUMENT_RECEIVER` |
| Gestor de Documentos de Acceso | Diagrama A | `User` rol `ACCESS_DOCUMENTS_MANAGER` |
| Aprobador Final / Autoridad | Diagrama A — aprobación jerárquica | `User` rol `COMPANY_ADMIN` (placeholder de jerarquía) |
| Examinador médico / Seguridad AIT | Diagrama A | **SIN ROL** (`RoleCode` enum no tiene `EXAMINER`) — CODE-EVIDENCE `schema.prisma:role RoleCode` |
| Operador de Carnetización | Diagramas A,B,D | `User` rol `CARD_ISSUER` |
| Custodio de Documento (ID) | Diagrama B | `User` implícito (no hay rol) |
| Escolta | Diagrama B | `RequestParticipantRole` (valor implícito, **no existe rol dedicado**) |
| Mesa de Servicios | Diagrama C (externo) | **SIN ENDPOINT** (`grep "integ" en controllers` = 0) |

---

## 2. Flujo **CARNET 1** — Carné Permanente con Foto y Examen
*(DERIVADO-FROM-DOC: "Solicitud Amazonia/Proactiva" según SGA_REQUIREMENTS_TRACEABILITY:10)*

### 2.1 Pasos — trazabilidad de evidencia

| # | Paso del flujo | Pantalla/Componente | Endpoint | Servicio | Entidad/Persistencia | Permiso | Notificación | Auditoría | Pruebas | Estado |
|---|---|---|---|---|---|---|---|---|---|---|
| 1.1 | Captura de datos del solicitante + empresa | `apps/web/app/(app)/requests/new/page.tsx` (wizard paso 1-3) | `POST /requests` | `RequestService.create` (`request.service.ts:135`) | `Request`+`RequestParticipant` rows (snapshot employment) | `requests.create` | — | `RequestEvent` CREATED | 0 | ✅ COMPLETE |
| 1.2 | Selección del firmante autorizado | `apps/web/components/shared/PersonForm` integrado en wizard | `GET /authorized-signers` → asignado en payload | `AuthorizedSignerService.getActiveSignerForRequest` (`authorized-signer.service.ts:189`) | `Request.authorizedSignerId` (FK restrict) | `signers.read` | — | `RequestEvent` CREATED | 0 | ✅ COMPLETE |
| 1.3 | Adjuntar documentos requeridos por tipo | wizard paso 7, `apps/web/hooks/api-workflow-hooks.ts#useUploadDocumentMutation` | `POST /documents` (multipart) | `DocumentService.upload` (`document.service.ts:81`) | `RequestDocument`+`DocumentVersion` queues + sha256 | `requests.create` | — | (no AuditEvent) | 0 | ✅ COMPLETE |
| 1.4 | Subir captura fotográfica del solicitante | wizard paso 3 → `useUploadUserPhotoMutation` (`<input type=file>`) | `POST /users/:id/photo` | `UserService.uploadPhoto` | `User.photoUrl` (rm storage) | `users.manage` | — | — | 0 | ⚠️ **PARTIAL** — file upload, **no hay captura WebRTC/cámara**. No hay `PHOTO_CAPTURE` workflow node |
| 1.5 | Validación examen de seguridad AIT | **AUSENTE** (no wizard step) | **AUSENTE** | **AUSENTE** | **AUSENTE** | — | — | — | 0 | ❌ **MISSING** — `RoleCode` no tiene EXAMINER; sin endpoint de examen |
| 1.6 | Revisión documental (DOCUMENT_REVIEW) | `apps/web/app/(app)/reviews/page.tsx` (inbox) + `/requests/[id]` (acción) | `POST /reviews/:id/approve-documents`, `POST /reviews/:id/reject-documents` | `ReviewService.transition` (`review.service.ts:81-105`) + side-effect RequestService | `ReviewTask` (DOCUMENT_REVIEW) + `DocumentReview` + `RequestEvent` (DOCUMENT_APPROVED) | `requests.review` | best-effort `request.returned` | RequestEvent | 0 | ⚠️ **PARTIAL** — pipeline completa, sin prueba |
| 1.7 | Devolución para corrección | `apps/web/app/(app)/requests/[id]/page.tsx` (ConfirmDialog) | `POST /requests/:id/transition {transition:'return'}` | `RequestService.transition` (`:537`) | `RequestEvent` RETURNED + `RequestSubmission` snapshot sha256 | `requests.create` | best-effort | RequestEvent | 0 | ✅ COMPLETE |
| 1.8 | Resubmit tras corrección | wizard permite editar en estado `RETURNED_FOR_CORRECTION` | `POST /requests/:id/transition {transition:'resubmit'}` | `RequestService.transition` | `RequestEvent` RESUBMITTED + nuevo `RequestSubmission` | `requests.create` | — | RequestEvent | 0 | ✅ COMPLETE |
| 1.9 | Aprobación final (FINAL_APPROVAL) | `apps/web/app/(app)/requests/[id]` | `POST /reviews/:id/approve-final` | `ReviewService.transition(approve_final)` → RequestService.transition(`approve_final`) | `ReviewTask` (FINAL_APPROVAL COMPLETED) + `RequestEvent` APPROVED | `requests.approve` | best-effort `request.approved` | RequestEvent | 0 | ⚠️ **PARTIAL** — pipeline completa, **sin jerarquía por cargo+unidad** (R4 de SGA-CURRENT-STATE §7) |
| 1.10 | Rechazo terminal | inbox + request detail | `POST /requests/:id/transition{'reject'}` | `RequestService.transition` (val reasonCode OR comment) | `RequestEvent` REJECTED (terminal) | `requests.reject` | best-effort `request.rejected` | RequestEvent | 0 | ✅ COMPLETE |
| 1.11 | Inicio de producción de carné | `apps/web/app/(app)/issuance/page.tsx` (tab "production") | `POST /credentials/:id/transition {start_production}` | `CredentialService.transition` (`credential.service.ts` lines enum-8) | `Credential` IN_PRODUCTION + `CredentialEvent` STARTED_PRODUCTION | `issuance.manage` | — | CredentialEvent | 0 | ⚠️ **PARTIAL** — pipeline, sin prueba |
| 1.12 | Marca "listo para entrega" | issuance tab "ready" | `POST /credentials/:id/transition {mark_ready}` | `CredentialService.transition` | `Credential` READY_FOR_DELIVERY + `CredentialEvent` MARKED_READY | `issuance.manage` | — | CredentialEvent | 0 | ⚠️ **PARTIAL** |
| 1.13 | Entrega | issuance tab "delivered" + dialog (`receivedByName`, `receivedByIdentification`) | `POST /credentials/:id/deliver` | `CredentialService.deliver` | `Credential` DELIVERED + `DeliveryRecord` + `CredentialEvent` DELIVERED | `issuance.manage` | — | CredentialEvent | 0 | ✅ COMPLETE |

### 2.2 Estado del flujo CARNET 1

**Puede ejecutarse end-to-end HOY**: SÍ (con la excepción del paso 1.5 — examen AIT — que es void; el operador puede "saltárselo" porque no existe validación forzada).

Estados por paso (13): 7 COMPLETE · 5 PARTIAL · 1 MISSING · 0 BROKEN · 0 UNVERIFIED.

**Porcentaje CARNET 1**: (7×1.0 + 5×0.75 + 1×0.0) / 13 × 100 = **88.5% ≈ 88%**

---

## 3. Flujo **CARNET 2** — Pase Temporal de Persona (TEMPORARY_PERSON) con Custodia
*(DERIVADO-FROM-DOC: "Proveedor/Visita Temporal" según SGA_REQUIREMENTS_TRACEABILITY:19)*

> **CODE-EVIDENCEIMPORTANTE:** este flujo TIENE un workflow PUBLISHED (`temporary_person_default`) sembrado en `apps/api/prisma/seed.ts:491-502`. **Pero el workflow no se ejecuta automáticamente** porque `RequestService` no está cableado al engine (ver SGA-CURRENT-STATE §6 R1).

### 3.1 Pasos — trazabilidad

| # | Paso | Pantalla | Endpoint | Servicio | Entidad | Permiso | Estado |
|---|---|---|---|---|---|---|---|
| 2.1 | Solicitud de pase temporal | wizard p1-7 (`/requests/new`) | `POST /requests` (requestTypeId → REQUEST_TYPE TEMPORARY_PERSON) | `RequestService.create` | `Request` | `requests.create` | ✅ COMPLETE |
| 2.2 | Recepción documents (cedula, oficio) | wizard p7 | `POST /documents` | `DocumentService.upload` | `RequestDocument`+`DocumentVersion` | `requests.create` | ✅ COMPLETE |
| 2.3 | **Revisión + aprobación final** | `/reviews` + `/requests/[id]` | `POST /reviews/:id/approve-documents` + `/reviews/:id/approve-final` | `ReviewService.transition` | `ReviewTask` | `requests.review/approve` | ✅ COMPLETE |
| 2.4 | Producción de pase temporal | `/issuance` | `POST /credentials` (credentialType=TEMPORARY_PERSON_PASS) | `CredentialService.issue` | `Credential` | `issuance.manage` | ✅ COMPLETE |
| 2.5 | **Custodia de documento de identidad al retirar pase** | **AUSENTE** — verificación literal: `grep -ri "custody\|custodia" apps/api/src/modules/credentials/` → **0 matches de controller** | **AUSENTE** | **AUSENTE** (existe `CustodyRecord` pero sin service/controller) | `CustodyRecord` table existe vacía en `schema.prisma:821` | — | ❌ **MISSING** — contradicta por auditoría previa (SGA_REQUIREMENTS_TRACEABILITY:22) que afirmaba "IMPLEMENTADO"; evidencia actual lo desmiente |
| 2.6 | Verificación de escolta asignada (zonas ROJA/NARANJA) | wizard opcional | No endpoint específico; cabecera/dato inline | `RequestParticipantRole` no obliga escolta | `RequestParticipant` (con campo `personalEmergency`) | — | ⚠️ **PARTIAL** (regla de "escolta requerido según zona" no forzada — SGA_REQUIREMENTS_TRACEABILITY:24) |
| 2.7 | Entrega del pase temporal | `/issuance` dialog | `POST /credentials/:id/deliver` | `CredentialService.deliver` | `Credential` DELIVERED + `DeliveryRecord` | `issuance.manage` | ✅ COMPLETE |
| 2.8 | Retorno del pase / devolución de cédula | **AUSENTE** — `grep "return\|devolucion" en issuance page` = 0 | **AUSENTE** | **AUSENTE** | `CustodyRecord.returnTime` existe en schema pero sin use site | — | ❌ **MISSING** |
| 2.9 | Alerta de devolución tardía (Cron/JOB) | **AUSENTE** | **AUSENTE** | **AUSENTE** | GAP-05 PARCIAL (`docs/audits/SGA_GAP_MATRIX.md:16`) | — | ❌ **MISSING** |
| 2.10 | Workflow PUBLISHED (semilla) se ejecuta al submit | La semilla define `temporary_person_default` PUBLISHED v1 | (ninguno automático) | `RequestService.transition('submit')` **no llama** WorkflowEngineService.start | WorkflowInstance se crea sólo vía REST manual | — | ❌ **BROKEN** — semilla inerte; bridge ausente |

### 3.2 Estado del flujo CARNET 2

**Puede ejecutarse end-to-end HOY**: **PARCIAL**. El happy path administrativo (solicitud→producción→entrega) sí; **la custodia física, el retorno y las alertas son inoperantes**.

Estados (10): 4 COMPLETE · 1 PARTIAL · 3 MISSING · 1 BROKEN · 0 UNVERIFIED (reconteo de la tabla: 5 COMPLETE 2.1-2.4,2.7 — corregido):

Reconteo: COMPLETE=5 (2.1,2.2,2.3,2.4,2.7) · PARTIAL=1 (2.6) · MISSING=3 (2.5,2.8,2.9) · BROKEN=1 (2.10) · UNVERIFIED=0.

**Porcentaje CARNET 2**: (5×1.0 + 1×0.75 + 3×0.0 + 1×0.0) / 10 × 100 = **57.5% ≈ 58%**

---

## 4. Flujo **CARNET 3** — Pase Temporal de Vehículo (TEMPORARY_VEHICLE)
*(DERIVADO-FROM-DOC: por simetría con CARNET 2; semilla ×3 sólo define temporary_person + permanent_card. CODE-EVIDENCE: RequestType enum TEMPORARY_VEHICLE confirmado en schema + `seed.ts:250`)*

### 4.1 Pasos

| # | Paso | Pantalla | Endpoint | Servicio | Entidad | Permiso | Estado |
|---|---|---|---|---|---|---|---|
| 3.1 | Solicitud con datos del vehículo | wizard paso 5 (vehículos) | `POST /requests` (vehicles[]) | `RequestService.create` + `toVehicleLink` (`:474`) | `RequestVehicle` (placa+marca únicos por request) | `requests.create` | ✅ COMPLETE |
| 3.2 | Carga de póliza/seguro | wizard p7 | `POST /documents` | `DocumentService.upload` | `RequestDocument` (DOCUMENT_TYPE póliza) | `requests.create` | ✅ COMPLETE |
| 3.3 | Revisión + aprobación | inbox + detail | `POST /reviews/:id/*` | `ReviewService.transition` | `ReviewTask` | `requests.review/approve` | ⚠️ PARTIAL |
| 3.4 | Producción de sticker/pass temporal | `/issuance` | `POST /credentials` (credentialType=TEMPORARY_VEHICLE_PASS) | `CredentialService.issue` | `Credential` (type TEMPORARY_VEHICLE_PASS) | `issuance.manage` | ✅ COMPLETE |
| 3.5 | Entrega + recepción | `/issuance` dialog | `POST /credentials/:id/deliver` | `CredentialService.deliver` | `DeliveryRecord` | `issuance.manage` | ✅ COMPLETE |
| 3.6 | Control de vencimiento (vigencia) | **AUSENTE en UI**; `validFrom/validUntil` en Request existen pero no son alerta editable | **AUSENTE** | GAP-05 PARCIAL | `Credential.expiresAt` existe en schema (`schema.prisma:793`) | — | ❌ **MISSING** — sin scheduler que dispare vencimientos |
| 3.7 | Cobro/devolución si cancela | **AUSENTE** | **AUSENTE** | — | — | — | ❌ MISSING |

### 4.2 Estado del flujo CARNET 3

**End-to-end HOY**: PARCIAL. CRUD vehículo + approval + issuance OK; vencimiento y retorno inexistentes.

Estados (7): 4 COMPLETE · 1 PARTIAL · 2 MISSING · 0 BROKEN.

**Porcentaje CARNET 3**: (4×1.0 + 1×0.75 + 2×0.0) / 7 × 100 = **67.9% ≈ 68%**

---

## 5. Flujo **CARNET 4** — Renovación / Emisión sin Captura de Foto (Reutilización)
*(DERIVADO-FROM-DOC: "Renovación / Emisión sin Captura de Foto" según SGA_REQUIREMENTS_TRACEABILITY:34)*

### 5.1 Pasos

| # | Paso | Pantalla | Endpoint | Servicio | Entidad | Permiso | Estado |
|---|---|---|---|---|---|---|---|
| 4.1 | Identificación del usuario existente y check "reuse photo" | wizard p3 (checkbox `usePreviousPhoto`) | `POST /requests` con `participants[].usePreviousPhoto=true` | `RequestService.create` (`makeParticipantLink:528` field exists) | `RequestParticipant.usePreviousPhoto` boolean | `requests.create` | ✅ COMPLETE (campo existe y persiste) |
| 4.2 | Validación de que foto previa existe y es vigente | wizard p3 — cliente | (ninguno) | **AUSENTE** | `User.photoUrl` checked solo en UI | — | ⚠️ **PARTIAL** — no hay regla "foto mayor a X años"
| 4.3 | Aprobación simplificada | inbox + detail | `POST /reviews/:id/approve-final` | `ReviewService.transition` | `ReviewTask` | `requests.approve` | ⚠️ PARTIAL |
| 4.4 | Producción con reutilización | `/issuance` | `POST /credentials` (PERMANENT_CARD) | `CredentialService.issue` | `Credential` | `issuance.manage` | ✅ COMPLETE |
| 4.5 | Entrega | `/issuance` | `POST /credentials/:id/deliver` | `CredentialService.deliver` | `DeliveryRecord` | `issuance.manage` | ✅ COMPLETE |
| 4.6 | Traceabilidad "renovó foto previa" en auditoría | — | — | no AuditEvent	field solo en RequestParticipant.usePreviousPhoto | — | — | ❌ MISSING (no hay reporte de Foto Repetida) |

### 5.2 Estado del flujo CARNET 4

**End-to-end HOY**: SÍ (con patch menor: no hay corte administrativo por foto vencida).

Estados (6): 3 COMPLETE · 2 PARTIAL · 1 MISSING · 0 BROKEN.

**Porcentaje CARNET 4**: (3×1.0 + 2×0.75 + 1×0.0) / 6 × 100 = **75%**

---

## 6. Resumen consolidado de los cuatro flujos

| Flujo | Pasos totales | COMPLETE | PARTIAL | MISSING | BROKEN | UNVERIFIED | % | ¿End-to-end hoy? |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| CARNET 1 (Permanente + Foto + Examen) | 13 | 7 | 5 | 1 | 0 | 0 | **88%** | SÍ (examen void) |
| CARNET 2 (Temporal persona + custodia) | 10 | 5 | 1 | 3 | 1 | 0 | **58%** | PARCIAL |
| CARNET 3 (Temporal vehículo) | 7 | 4 | 1 | 2 | 0 | 0 | **68%** | PARCIAL |
| CARNET 4 (Renovación sin foto) | 6 | 3 | 2 | 1 | 0 | 0 | **75%** | SÍ (foto vigente manual) |
| **Promedio simple (4 flujos)** | 36 | 19 | 9 | 7 | 1 | 0 | **(19+9·0.75)/36 = 71.5%** | —

> **Nota:** Este promedio simple de los 4 flujos **NO** coincide con el 66% global de SGA-CURRENT-STATE §10 porque aquel aplica los 9 pesos del enunciado (motor 20%, operaciones 15%, editor 10%) y refleja también áreas no presentes en el detalle de los diagramas (notificaciones, observabilidad, pruebas, editor visual).

---

## 7. Hallazgos críticos transversales a los 4 flujos

| Hallazgo | Afecta a | Evidencia |
|---|---|---|
| **Workflow engine inerte para el Request lifecycle** | CARNET 2 (semilla PUBLISHED), todos los flujos futuros | `apps/api/src/modules/requests/application/request.service.ts` no referencia `WorkflowEngineService` (grep = 0); sólo accesible vía `POST /workflows/instances/start` |
| **Custodia física no implementada como flujo de operación** | CARNET 2, CARNET 3 | `CustodyRecord` table existe con `depositTime`/`returnTime` pero no hay service/controller/UI (`grep custody en credentials module` = 0) |
| **Examen AIT sin motor** | CARNET 1, CARNET 4 (renovación requiere examen vigente) | No `RoleCode.EXAMINER`, no endpoint, no `EXAM_VALIDATION` workflow node |
| **Aprobación por cargo+unidad organizacional ausente** | Todos | Sin tabla `CompanyOrgUnit`; `User.department/position` son VarChar libre (SGA-CURRENT-STATE §7 R4) |
| **Vencimientos/SLA/alertas ausentes** | CARNET 2, 3 | GAP-05 PARCIAL — sin scheduler activo confirmado |
| **Reportes inexistentes** | Auditoría/regulatorio | No hay endpoint `/audit/reports` ni exporters |
| **`return` inicialmente listado como PARTIAL en SGA_REQUIREMENTS_TRACEABILITY:27** | — | HOY ya está COMPLETE (CARNET 1.7, 1.8); el schema define `RETURNED_FOR_CORRECTION` y la transición existe con snapshot sha256 |

---

## 8. Funcionalidades ocultas/incompletas que el mapeo revela

| # | Hallazgo | Evidencia |
|---|---|---|
| H1 | Auditoría anterior declara `POST /issuance/custody` "IMPLEMENTADO" — **desmentido**: no existe módulo `issuance` (es `credentials`) ni endpoint de custodia. Probablemente redacción obsoleta. | Línea citada no mapea a código |
| H2 | Auditoría anterior usa rutas `POST /people/:id/photo` — **obsoleto**: el módulo `people` fue dropeado (`apps/api/src/modules/people` no existe); hoy se usa `POST /users/:id/photo`. | Confirma auditoría previa data del 21-07, pre-consolidación |
| H3 | El campo `RequestParticipant.usePreviousPhoto` está persistido pero NO es consultado por `CredentialService.issue` — es decir la bandera es decorativa. | `CredentialService.issue` no lee este campo |
| H4 | `ReviewService.transition` invoca RequestService.transition — pero el workflow engine (cuando arranque) también — riesgo de **doble transición**. | Review+Engine paralelos |
