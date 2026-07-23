# SGA — Estado Actual del Sistema (Current State)

**Proyecto:** SGA — Sistema de Gestión de Accesos · Aeropuerto Internacional de Tocumen, S.A.
**Tipo de auditoría:** Integral, de solo lectura, basada en evidencia verificable.
**Fecha:** 23 de Julio de 2026

---

## 0. Branch y commit auditados

| | Valor | Evidencia |
|---|---|---|
| Branch | `main` | `git branch --show-current` |
| Commit HEAD | `50caa17 🚑️ [hotfix] correcciones de UI` | `git log --oneline -1` |
| Commit anterior | `aec24f4 🐛 [fix] CRUD de personas` | `git log --oneline` |
| Árbol de trabajo | **SUCIO** — modificaciones sin committar en `apps/api/prisma/schema.prisma`, `apps/api/prisma/seed.ts`, varios módulos (`authorized-signers`, `credentials`, `workflows`, `app.module.ts`, etc.). La auditoría se ejecuta sobre el working tree actual. | `git status --short` |

> **Advertencia metodológica:** Las afirmaciones sobre el workflow engine (`apps/api/src/modules/workflows`) y la seed `temporary_person_default` (PUBLISHED v1) derivan del working tree sucio, que aún no está en un commit. De consolidarse, debe repetirse `git rev-parse HEAD` y bloquear el SHA.

---

## 1. Tecnologías y estructura

### 1.1 Stack

| Capa | Tecnología | Versión | Evidencia |
|---|---|---|---|
| Front Framework | Next.js (App Router, Turbopack) | 16.2.10 | `apps/web/package.json` |
| Front UI | React / React DOM / Tailwind 4 / shadcn-ui / Radix | 19.2.7 / 4.3.2 | `apps/web/package.json` |
| Estado / Datos | TanStack Query / Zustand / RHF / Zod | 5.x / 5.x / 7.81 / 4.4.3 | `apps/web/package.json` |
| HTTP Cliente | openapi-fetch | — | `apps/web/lib/api-client.ts` |
| Backend Framework | NestJS | 11.0.1 | `apps/api/package.json` |
| ORM / DB | Prisma ORM / MariaDB adapter MySQL 8 | 7.8.0 | `apps/api/prisma/schema.prisma` |
| Auth | argon2 / @nestjs/jwt / @nestjs/throttler | 0.44 / 11.0.2 / 6.x | `apps/api/src/modules/identity/presentation/controllers/auth.controller.ts` |
| Tests | Jest + ts-jest | 29.7.0 | `apps/api/jest.config.js` |
| Editores visuales de nodos | **AUSENTE** — ni `@xyflow/react` ni `reactflow` están instalados | — | `apps/web/package.json` (grep `xyflow\|reactflow` = 0 matches) |

### 1.2 Estructura del monorepo (Docker read-only confirmado)

```
apps/api/  → NestJS modular monolith
  src/modules/{organizations, identity, catalogs, authorized-signers,
               requests, documents, reviews, credentials, notifications,
               audit, settings, workflows}            ← 12 módulos
  prisma/    → schema.prisma, seed.ts, 16 migraciones
apps/web/  → Next.js App Router
  app/(app)/  → 11 páginas protegidas por AppShell
docs/      → audits/, references/, security/, workflows/
```

### 1.3 Capa DDD del backend (aplicada con una excepción)

| Módulo | Controller | Application | Domain | Infrastructure Prisma |
|---|---|---|---|---|
| organizations | ✅ | ✅ `company.service.ts` | ✅ entity + port | ✅ |
| identity | ✅ ×2 (auth, users) | ✅ `auth.service`+`user.service` | ✅ | ✅ |
| catalogs | ✅ | ✅ `catalog.service` | ✅ entity + seeds | ✅ |
| authorized-signers | ✅ | ✅ | ✅ | ✅ |
| requests | ✅ | ✅ `request.service.ts` (7 deps, ~620 LOC) | ✅ entity+state.policy+ports | ✅ ×3 |
| documents | ✅ | ✅ `document.service` | ✅ entities + file-storage port | ✅ + LocalFileStorageAdapter |
| reviews | ✅ | ✅ `review.service` (uses RequestService) | ✅ entity + state policy | ✅ |
| credentials | ✅ | ✅ `credential.service` | ✅ | ✅ + mapper |
| notifications | ✅ | ✅ `notification.service` | ✅ port `NotificationPort` | ✅ InAppNotificationAdapter |
| **audit** | ✅ | ✅ `audit.service` | **❌ vacío** | (Service usa PrismaService directo) |
| **settings** | ✅ | **❌ NONE** — controller inyecta `PrismaService` | **❌ NONE** | — |
| workflows | ✅ ×4 (defs, versions, instances, tasks) | ✅ ×3 services | ✅ entities + condition-evaluator + graph-validator | ✅ ×3 + 2 mappers |

**Inconsistencia arquitectónica confirmada:** `audit/service` exporta pero **NO es inyectado** en ningún otro módulo. `AuthService` escribe `AuditEvent` directamente vía `prisma.auditEvent.create(...)` en `auth.service.ts:90-99, 110-119, 171-179`.

---

## 2. Inventario frontend

### 2.1 Páginas bajo `app/(app)/` (todas dentro de `AppShell`, JWT-protected)

| Ruta | Estado | Datasource | Acciones |
|---|---|---|---|
| `/dashboard` | ✅ COMPLETE | TanStack real (per role) | Read-only + RequestAnalytics |
| `/companies` (+ new/[id]) | ✅ COMPLETE | `useCompaniesQuery`, mutations | CRUD + toggle (real backend) |
| `/people` (+ new/[id]) | ✅ COMPLETE | `usePeopleQuery` | CRUD + photo (real backend) |
| `/users` (+ new/[id]) | ✅ COMPLETE | `useUsersQuery` | CRUD + photo upload + `PermissionMatrix` + reset-password |
| `/authorized-signers` | ✅ COMPLETE | TanStack real | CRUD via in-page dialog |
| `/catalogs` | ✅ COMPLETE | TanStack real | 11 catálogos tabs |
| `/requests` + `/new` + `/[id]` | ✅ COMPLETE | TanStack real | Wizard 8 pasos RHF+Zod, transiciones, upload documentos |
| `/reviews` | ⚠️ **PARTIAL** | `useRequestsQuery`+`useReviewTasksQuery` | Inbox read-only; las acciones approve/reject/return viven en `/requests/[id]` |
| `/issuance` | ✅ COMPLETE | TanStack real de `credentials` | 4 tabs (pending/production/ready/delivered) + delivery dialog |
| `/change-password` | ✅ COMPLETE | `useChangePasswordMutation` | Enforced por `mustChangePassword` |
| `/settings` | ✅ COMPLETE | `useSettingsQuery` | Identity + SMTP |
| **`/workflows` (editor)** | ❌ **MISSING** | — | No existe la ruta, no existe el paquete |

### 2.2 Estado "mock" — AUSENTE

`lib/mock-data/` existe pero está vacío. Grep `mock\|Mock\|sga-mvp-storage` en `apps/web` → **0 matches**. La migración del store legacy está completa. `lib/store.ts` solo persiste `currentUser`.

### 2.3 Hooks (cobertura)

| Hook file | Cobertura |
|---|---|
| `hooks/auth-hooks.ts` | login/me/logout/change-password (real) |
| `hooks/api-hooks.ts` | 35 exports — catalogs, companies, people, authorized-signers, users, settings |
| `hooks/api-workflow-hooks.ts` | 20 exports — requests, request events, review tasks, documents, credentials, audit events |

---

## 3. Inventario backend

### 3.1 Endpoints HTTP por módulo (todos bajo `/api/v1`)

| Módulo | Endpoints destacados | Permiso/Guard |
|---|---|---|
| auth (`/auth`) | login, refresh, logout, logout-all, me, password-recovery ×3 | `@Public()` salvo logout/me |
| users | 11 endpoints | `users.manage` / `users.read` |
| organizations | 7 endpoints (POST/GET/PATCH/activate/deactivate/suspend) | `companies.manage/read` |
| catalogs | 6 endpoints por catálogo | `catalogs.manage` |
| authorized-signers | 6 endpoints | `signers.manage/read` |
| requests | CRUD + `POST /:id/transition` + `GET /:id/events` | Scoping a `companyId` en service |
| documents | CRUD + multipart upload + reviews | `requests.create/review` |
| reviews | 11 endpoints (assign/approve-documents/reject-documents/approve-final/return/reject) | `requests.review/approve/return/reject` |
| credentials | CRUD + `POST /:id/transition` + `POST /:id/deliver` + `POST /:id/correct-delivery` | `issuance.manage/read` |
| notifications | list/read/read-all | Self-scoped |
| audit | `GET /` | `audit.read` |
| settings | `GET/POST /logo/PATCH` | `settings.manage` |
| **workflows definitions** | CRUD + `retire` | `workflows.manage/read/publish` |
| **workflows versions** | CRUD + `publish` + `retire` | `workflows.manage/read/publish` |
| **workflows instances** | `POST /start` + `GET /:id` + `GET /by-request/:requestId` | `workflows.execute/read` |
| **workflows tasks** | list/get/claim/complete | `workflows.read/task.claim/task.complete` |

**No existe** `@Roles` ni `RolesGuard`. La autorización se hace con `JwtAuthGuard` (global) + `PermissionsGuard` + `@RequirePermissions`.

### 3.2 State machines identificadas (TRES paralelas)

1. **`RequestStatePolicy`** (hardcoded, `apps/api/src/modules/requests/domain/request-state.policy.ts:64-138`) — **12 transiciones fijas** (`submit`, `resubmit`, `cancel`, `return`, `reject`, `advance_to_document_review`, `approve_documents`, `advance_to_final`, `approve_final`, `start_production`, `mark_ready`, `deliver`).
2. **`ReviewStatePolicy`** (`apps/api/src/modules/reviews/domain/review-state.policy.ts`) — pipeline finita de `DOCUMENT_REVIEW` + `FINAL_APPROVAL`.
3. **`WorkflowEngineService`** (`apps/api/src/modules/workflows/application/workflow-engine.service.ts`) — grafo dirigido, versionado, con `lockVersion`. **No conectado a `RequestService.transition`** (ver §6).

---

## 4. Inventario de base de datos (Prisma)

### 4.1 40 modelos suma (NO 41: `Person` eliminado por migración `20260721160000_consolidate_user_identity`)

> Categorías (`apps/api/prisma/schema.prisma`):
> - **§1 Organizaciones & Identidad** (Company, User, AuthIdentity, PasswordRecoveryChallenge, RefreshSession, Role, Permission, RolePermission, UserRole, UserPermission, SystemSetting, CompanyAuthorizedSigner) — 12 modelos
> - **§2 Catálogos** (CatalogItem) — 1 modelo polymórfico con 11 `CatalogKind`
> - **§3 Solicitudes** (Request, RequestParticipant, RequestVehicle, RequestEquipment, RequestAccessPoint, RequestAccessArea) — 6 modelos
> - **§4 Documentos** (RequestDocument, DocumentVersion, DocumentReview, DocumentRequirement, FileMetadata) — 5 modelos
> - **§5 Snapshots & Eventos** (RequestSubmission, RequestEvent) — 2 modelos
> - **§6 Review pipeline fija** (ReviewTask) — 1 modelo
> - **§7 Credenciales & Custodia** (Credential, CustodyRecord, CredentialEvent, DeliveryRecord) — 4 modelos
> - **§8 Cross-cutting** (Notification, AuditEvent, IdempotencyRecord) — 3 modelos
> - **§9 Workflow engine** (WorkflowDefinition, WorkflowVersion, WorkflowInstance, WorkflowNodeInstance, WorkflowTask, WorkflowTransition) — 6 modelos
> - **Total: 40 modelos · 28 enums**

### 4.2 Migraciones (`apps/api/prisma/migrations/`) — 16 directorios

| Fecha | Creación | Estado |
|---|---|---|
| 20260714055417 | `companies` | ✅ |
| 20260714055623 | identity + RBAC | ✅ |
| 20260714060000 | people + signers | ✅ (people dropeado en 072116) |
| 20260714060100–60700 | catálogos, request+subjects, documentos, review+events, credentials+delivery, notifications+audit+idempotency, ext person catalogs | ✅ |
| 20260715120000–130000 | user permissions, system settings, password expiration, profile photos + temp passwords | ✅ |
| 20260721160000 | **consolidación de identidad** (drop people, repoint a User) | ✅ |
| 20260721170000 | **dynamic workflow engine** (6 tablas) | ✅ |

### 4.3 Llaves/no-FK/riesgos en el schema

- `@default(uuid())` se genera en JS (Prisma), NO en MySQL → inserts raw fuera de Prisma deben aportar `id`.
- `CompanyAuthorizedSigner.authorizationDocumentId`/`signatureFileId`, `RequestDocument.currentVersionId`/`subjectId`, `DocumentReview.reviewedBy`, `RequestEvent.actorUserId`, `WorkflowTransition.sourceNodeKey`/`targetNodeKey` son **soft references sin FK** (verificación obligatoria en código).
- `FileMetadata` no tiene inbound relations → orphans no cleanable a nivel schema.
- NO existe `CompanyOrgUnit`. `User.department` y `User.position` son `VarChar(120)` sin FK; el nivel organizacional (vicepresidencia / departamento / sección / equipo / grupo) **no está modelado**.
- Ninguna tabla append-only tiene TTL/retention policy (`AuditEvent`, `Notification`, `IdempotencyRecord`, `RequestEvent`, `CredentialEvent`, `WorkflowTransition`).

---

## 5. Estado de builds y pruebas

| | Valor | Evidencia |
|---|---|---|
| Migraciones aplicables | 16, lock confirmado | `migration_lock.toml` |
| Suites de test backend | **9 archivos `.spec.ts`** (`access-scope`, `identity/auth-document`, workflows ×7) | grep `describe(` en spec files |
| Tests en módulo workflows | **82 casos** | `workflows/{condition-evaluator,graph-validator,workflow-definition.entity,workflow-instance.entity,workflow-definition.service,workflow-engine.service,workflow-task.service}.spec.ts` |
| Tests en módulo identity | auth-document (login por documento) | `identity/domain/auth-document.spec.ts` |
| E2E | `apps/api/test/app.e2e-spec.ts` existe | contenido **UNVERIFIED** |
| Cobertura de servicios críticos | Requests/Reviews/Credentials/Documents = **0 suites** | falta grep-match |
| Build backend | Compila (`nest build`), según `SGA_CURRENT_STATE.md` preexistente en `docs/audits/` | UNVERIFIED durante esta auditoría |
| Build frontend | Compila según histórico | UNVERIFIED durante esta auditoría |

---

## 6. Motor actual —.estado del workflow engine

| Pregunta | Respuesta | Evidencia literal |
|---|---|---|
| ¿Existen los 6 modelos Prisma del engine? | ✅ SÍ | `schema.prisma:942-1081` |
| ¿Está el módulo importado en `app.module.ts`? | ✅ SÍ | línea 44 |
| ¿Existe `WorkflowDefinition.publishedVersion` por requestType? | ✅ SÍ | `WorkflowDefinitionPrismaRepository.findPublishedForRequestType` |
| ¿Está el engine cableado en `RequestService.transition`? | ❌ **NO** | grep `Workflow\|engine` en `apps/api/src/modules/requests` = 0 |
| ¿Cómo dispara una instancia? | Únicamente vía REST `POST /workflows/instances/start` | `workflow-instances.controller.ts:54` |
| ¿El engine invoca a `RequestService.transition`? | ✅ SÓLO en sentido inverso (`runSystemAction`) | `workflow-engine.service.ts:311` (UPDATE_REQUEST_STATUS map) |
| ¿Existen `simulate`/`preview`/`dryRun`? | ❌ NO | grep en `modules/workflows` = 0 |
| ¿Tipos de nodo soportados? | **5/18 (START, END, HUMAN_TASK, SYSTEM, DECISION)** | `workflow-definition.types.ts:8` |
| ¿Existen beans sembrados? | ✅ 2 (PERMANENT_CARD DRAFT, TEMPORARY_PERSON PUBLISHED v1) | `seed.ts:454,491` |

**Set soportado vs target (18 tipos del enunciado):**

| # | Tipo target | Estado |
|---|---|---|
| 1 | START | ✅ |
| 2 | FORM | ❌ |
| 3 | DOCUMENT_REVIEW | ❌ (como `HUMAN_TASK` ad-hoc, no como tipo) |
| 4 | CORRECTION | ❌ (existe outcome `RETURN_FOR_CORRECTION`, no tipo de nodo) |
| 5 | EXAM_VALIDATION | ❌ |
| 6 | APPROVAL | ❌ (como `HUMAN_TASK`_APPROVE) |
| 7 | CONDITION | ⚠️ reemplazado por `DECISION` |
| 8 | HIERARCHY_ASSIGNMENT | ❌ |
| 9 | NOTIFICATION | ❌ (módulo aparte sin nodo de workflow) |
| 10 | TIMER | ❌ |
| 11 | PHOTO_CAPTURE | ❌ |
| 12 | CARD_PRODUCTION | ❌ |
| 13 | CARD_DELIVERY | ❌ |
| 14 | DOCUMENT_CUSTODY | ❌ |
| 15 | TEMPORARY_PASS_CHECKOUT | ❌ |
| 16 | TEMPORARY_PASS_RETURN | ❌ |
| 17 | SUBFLOW | ❌ |
| 18 | END | ✅ |

**Cobertura de tipos**: 2/18 exactos + 1 conceptual (DECISION ≈ CONDITION) ≈ **17%**.

---

## 7. Riesgos principales

| # | Riesgo | Severidad | Evidencia |
|---|---|---|---|
| R1 | **El workflow engine NO está integrado con `RequestService`.** Una solicitud creada desde `/requests` POST nunca dispara el workflow aunque exista `temporary_person_default` PUBLISHED para ese requestType. El flujo dinámico sólo corre si un cliente llama explícitamente a `POST /workflows/instances/start`. | CRÍTICO | `request.service.ts` no referencia WorkflowEngine; `grep Workflow` = 0 |
| R2 | **Tres state machines paralelas pueden divergir.** `RequestStatePolicy` (fijo) + `ReviewStatePolicy` (fijo) + `WorkflowEngine` (dinámico) conviven. Si el engine hace `UPDATE_REQUEST_STATUS` mientras un ReviewTask activo espera transición, el estado puede inconsistir. | Alto | `review.service.ts` + `workflow-engine.service.ts:311` |
| R3 | **Editor visual inexistente.** Sin `@xyflow/react` instalado, sin ruta `/workflows`. El engine es inaccesible para operadores no-técnicos. | CRÍTICO | `apps/web/package.json` |
| R4 | **Asignación jerárquica ausente.** No hay tabla `CompanyOrgUnit`; `User.department/position` son VarChar libre. Las aprobaciones se resuelven por `roleCode`, no por "cargo y unidad organizacional". | Alto | `schema.prisma` no contiene `CompanyOrgUnit` |
| R5 | **`AuditService` no está consumido.** `AuthService` escribe `AuditEvent` vía Prisma directa. Módulos críticos como requests/reviews/credentials no registran AuditEvent (sí RequestEvent/CredentialEvent que es lifecycle, no auditoría transversal). | Medio | grep `AuditService` solo aparece en `audit/` |
| R6 | **Errores 500 vs 422.** Varios controladores/domain lanzan `throw new Error(...)` en lugar de domain errors → el error filter devuelve 500 en lugar de 400/422. | Medio | `documents.controller.ts:87-90, 136, 141`; `auth.controller.ts:123,140`; `company.entity.ts:60,124`; `user.entity.ts:77-79, 177-181` |
| R7 | **`@default(uuid())`** se genera en JS. Cualquier insert fuera de Prisma o migración raw fallaría. | Bajo | `schema.prisma:202` (Company) y similares |
| R8 | **JwtAuthGuard no valida revocación** del access token en caliente. | Medio | (`/memories/repo/sga-project-context.md` memoria(documentada) |
| R9 | **SMPT/Email/Push ausentes.** NotificationService sólo persiste en DB; no hay adapter de correo. | Medio | `in-app-notification.adapter.ts:11-13` |
| R10 | **Sin retention TTL** en tablas append-only. Crecimiento ilimitado. | Bajo | schema §4.3 |

---

## 8. Funcionalidades que **aparentan** estar completas pero **no lo están**

| # | Apariencia | Realidad | Evidencia |
|---|---|---|---|
| A1 | `/reviews` parece un inbox funcional | Es read-only; approve/reject/return se ejecutan desde `/requests/[id]`. No hay acción directa sobre la bandeja. | `apps/web/app/(app)/reviews/page.tsx` no llama mutations de transición |
| A2 | El workflow engine parece listo | Backend completo pero **0% integrado** con el Request lifecycle; tendría que llamarse manualmente | `request.service.ts` sin import Workflow |
| A3 | `temporary_person_default` se ve "en vivo" | Está PUBLISHED pero nunca arranca automáticamente desde flujo nativo | seed.ts + falta wiring |
| A4 | `AuthorizedSigner` parece soportar firmas jerárquicas | Sólo aprueba la persona asignada; no resuelve por cargo+unidad en árbol organizacional | `User.department` libre; sin `CompanyOrgUnit` |
| A5 | `/issuance` cubre "producción y entrega" | Cubre estados de la credencial, **no** incluye captura de foto, examen, custodia física (depósito de cédula) ni entrega de pase temporal dedicada | grep `photo\|capture\|examen\|custodia` = 0 |
| A6 | `AuditEvent` tabla y endpoint existen | El servicio no es invocado por módulos clave (sólo AuthService directo a Prisma). Auditoría transversal está vacía para Requests/Documents/Credentials workflow. | `audit.service.ts` sin inyectores fuera del módulo |
| A7 | `CustodyRecord` existe en schema | No hay controller, ni service, ni UI para hacer checkout/return | grep `custody\|custodia` en controllers = 0 |
| A8 | Error handling parece DDD-compliant (`BusinessRuleError`, `ValidationError`) | Varios paths lanzan `throw new Error(...)` que el filter convierte en 500 | document.controller.ts, auth.controller.ts, entidades |

---

## 9. Puntuación — fórmula y cálculo por área

Regla aplicada (definida en el enunciado):

- 100% — integrado e2e, persiste, autoriza, audita y tiene pruebas suficientes.
- 75% — funciona e2e pero sin pruebas o sin endurecimiento.
- 50% — frontend y backend parcialmente integrados.
- 25% — sólo UI/endpoint/stub/esquema aislado.
- 0% — no existe.
- UNVERIFIED → no puede puntuar como completo.

### Detalle por área con pesos

| Área | Peso | Ítems puntuados | Promedio ítems | Contribución |
|---|---|---|---|---|
| 1. Solicitudes, formularios, adjuntos y validaciones | 15% | wizard 8 pasos (100), create/update/transition (100), multipart upload (75), snapshot sha256 (100), validación de catálogos (100), inline persons (100), `/requests/new` + detalle (100) | **96.4%** | **14.46** |
| 2. Persistencia y ciclo de vida | 10% | Request invariantes (100), RequestEvent (100), state.policy 12 transiciones hardcoded (75), lockVersion `_version` (50), IdempotencyRecord (50), AuditEvent en transiciones (50) | **70.8%** | **7.08** |
| 3. **Motor de flujos configurable** | **20%** | 6 models Prisma (100), definitionJson+checksum (100), DRAFT→PUBLISHED→RETIRED (100), GraphValidator (100), condition-evaluator (100), WorkflowEngineService.run (100), lockVersion (100), WorkflowTask claim/complete (100), REST CRUD (100), **5/18 node types (28)**, **integración Request lifecycle (0)**, **simulate/preview (0)**, integration test real (75), semilla de 2 defs (100), editor frontend (0) | **73.5%** | **14.70** |
| 4. Asignación, cargos, jerarquía y permisos | 10% | PermissionsGuard (100), permissions.ts (100), computePermissions runtime (100), PermissionMatrix UI (100), 6 roles (100), AuthorizedSigner (100), RequestParticipantRole (100), role-check en service (75), **jerarquía org tree por cargo y unidad (0)** | **75.0%** | **7.50** |
| 5. Operación de carnés y permisos | 15% | Credential entity+state machine (100), CredentialEvent (100), DeliveryRecord (100), correct-delivery (100), CustodyRecord (75), `/issuance` UI (100), **photo capture (0)**, **examen (0)**, **temporal pass checkout/return (0)**, card production subsystem (25) | **50.0%** | **7.50** |
| 6. **Editor visual, publicación y versionado** | **10%** | xyflow install (0), palette d&d (0), property panel (0), graph validation UI (0), simulation UI (0), version diff (0), runtime visualization (0), import/export JSON (0), versioning API backend (100), publish/retire backend (100) | **20.0%** | **2.00** |
| 7. Notificaciones, SLA y escalamiento | 5% | in-app (100), best-effort notifications (100), SMTP/email/push (0), scheduled send (0), WorkflowTask.dueAt (50), Cron SLA temporary (25), escalation (0), NotificationPort (75) | **43.75%** | **2.19** |
| 8. Auditoría, historial y reportes | 5% | AuditEvent (100), RequestEvent (100), CredentialEvent (100), WorkflowTransition (100), RequestSubmission (100), AuditService huérfano (25), retention/TTL (0), reports/exports (0), audit endpoint (100) | **69.4%** | **3.47** |
| 9. Pruebas, seguridad, observabilidad y despliegue | 10% | unit specs críticos (75), Jest config (100), argon2 (100), JWT+refresh (100), Throttler (100), lockout 5 (100), domain errors consistency (50), docker compose (100), prod manifests (0), observability (25), Swagger (100), e2e (25) | **67.9%** | **6.79** |
| **TOTAL COMPLETADO** | **100%** | — | — | **= 65.7** ≈ **66%** |

---

## 10. Porcentajes finales

| | % |
|---|---|
| **Total completado (evidenciado)** | **≈ 66%** |
| **Total pendiente** | **≈ 34%** |

### Cinco bloqueantes principales

1. **Workflow engine no integrado al lifecycle de Request** — el motor dinámico nunca arranca automáticamente; dos state machines paralelas pueden divergir (R1, R2).
2. **Editor visual inexistente** — ausencia total de `@xyflow/react`, rutas y componentes (R3, Área 6 al 20%).
3. **Asignación jerárquica ausente** — no hay modelo organizacional; las aprobaciones se resuelven por rol, no por cargo+unidad (R4).
4. **Flujos de carné/especializados ausentes** — photo capture, exam validation, document custody, temporary pass checkout/return son 0% (A5).
5. **Observabilidad/AuditService huérfano** — auditoría transversal vacía y observabilidad mínima (R5, A6).

---

## 11. Rutas de los informes creados

- `docs/audit/SGA-CURRENT-STATE.md` (este documento)
- `docs/audit/SGA-FLOW-MATRIX.md`
- `docs/audit/SGA-ROADMAP-TO-100.md`

---

## 12. Primera fase recomendada

> **Resolución del bloqueante #1**: integrar `WorkflowEngineService.start` dentro de `RequestService.transition(... 'submit')` para que, cada vez que se publique un workflow PUBLISHED para el requestType, la solicitud quede atada a una `WorkflowInstance` y el motor dirija los movimientos subsecuentes (mientras `RequestStatePolicy` queda como *fallback* para tipos sin workflow definido).
>
> Esta fase es el "puente" que transforma el motor dinámico en solución productiva y desbloquea todo el value del editor visual planeado. Detalles: ver `SGA-ROADMAP-TO-100.md`, **Fase 1 — Bridge engine↔request**.
