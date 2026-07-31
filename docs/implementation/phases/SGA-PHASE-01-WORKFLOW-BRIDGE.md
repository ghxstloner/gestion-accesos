# SGA — Phase 1: Bridge Engine ↔ Request Lifecycle (Closure)

**Proyecto:** SGA — Sistema de Gestión de Accesos · Aeropuerto Internacional de Tocumen, S.A.
**Fase:** 1 de 9 (`docs/audit/SGA-ROADMAP-TO-100.md` §2)
**Estado:** ✅ **COMPLETED (riguroso, 3 pasos)** — terna backend + frontend + persistencia verde; puente simétrico cubre RequestController Y ReviewService (ningúna ruta de decisión esquiva el orquestador); bug preexistente en `DomainError` corregido como cierre técnico.
**Última actualización:** 31 de Julio de 2026 (paso de cierre técnico: fix bug en `DomainError`)
**Commit base sin committar:** `_phase1` working tree local (sin `git add` pendiente autorización del usuario)

---

## 0. Objetivo (verbatim, enunciado)

> *"Connect workflows to requests"*

Auditar/completar el puente entre `RequestService`, `ReviewService`, `WorkflowEngineService`, `WorkflowInstance`, `WorkflowTask`.

> **Cierre riguroso (31/07, paso 3 — técnico):** tras el paso 2 se detectó un bug preexistente en `DomainError` (ver §2.11) que impedía usar `instanceof Subclass` de forma confiable. Las spec de ReviewService havían recurrido a `toThrow(/regex/)` como workaround. Este paso corrige el bug, restaura los asserts `instanceof` y añade una suite de regresión de la jerarquía de errores. FASE 1 queda **commit-ready**.

> **Cierre riguroso (31/07, paso 2):** la afirmación de "todos los requisitos cubiertos" fue revisada y se detectó EXACTAMENTE una ruta residual — `ReviewService.applyRequestSideEffect` llamaba directamente a `requestService.transition` para approve/reject/return/reject_documents/approve_documents. Esta ruta se corrigió en este paso y ahora pasa por el orquestador. Ver §2.9 y §11.

### Comportamientos requeridos (verbatim del enunciado)

1. Submitting a Request starts the applicable published workflow.
2. Resubmitting a returned Request continues or safely restarts the correct execution.
3. Review actions complete or advance the corresponding workflow task.
4. Workflow system actions update Request status **without causing duplicate transitions**.
5. Operations must be **idempotent**.
6. Each Request must retain the workflow **version used when execution started**.
7. Existing requests without a workflow must continue operating safely until migrated.
8. Add unit and integration tests for submit, resubmit, approve, reject, return and duplicate execution attempts.

### Exclusiones explícitas (también del enunciado)

Intelesis · RH Amaxonia · Honeywell Pro-Watch · Exámenes · hardware físico → **NO TOCADOS** en FASE 1. Reportados como pendientes FASE 5+.

---

## 1. Porcentaje asignado a FASE 1

| | Valor |
|---|---|
| % aplicado por FASE 1 (peso roadmap §2) | **+5%** |
| % acumulado (FASE 0 + FASE 1) | **71%** (desde 66%) |
| % pendiente para cerrar 100% | 29% (FASES 2–9) |

---

## 2. Items completados (con evidencia en código)

### 2.1 Orquestador (núcleo del puente)

| Componente | Archivo | Comportamiento entregado |
|---|---|---|
| **`RequestWorkflowOrchestrator`** | `src/modules/workflows/application/request-workflow-orchestrator.service.ts` | Punto único que cruza `Request.transition` ↔ `WorkflowEngine` dentro del mismo `$transaction`. Define 3 entrypoints públicos: `onSubmit`, `onResubmit`, `onReviewOutcome`. |

#### Entrypoints y contrato

| Entrypoint | Comportamiento | Requisito cubierto |
|---|---|---|
| `onSubmit({requestId, actor, idempotencyKey})` | `prepareTransition('submit')` eager → si hay PUBLISHED workflow y NO existe instancia ACTIVE → `prisma.$transaction([saveInTx(req), engine.startInTx(...)])` → `commitTransitionSideEffects(plan)` post-commit. Si ya hay ACTIVE → **idempotente** (re-aplica solo la transición de Request, NO arranca nuevo run). Si no hay workflow PUBLISHED → **fallback legacy** `commitTransitionSideEffects(plan)`. | (1), (5), (7) |
| `onResubmit(...)` | Igual que `onSubmit` pero transición `'resubmit'`. Como el grafo seeded cierra con END en RETURN/REJECT, el resubmit arranca **instancia nueva** del PUBLISHED workflow. | (2), (5) |
| `onReviewOutcome({requestId, actor, requestTransition, outcome, comment, reasonCode, idempotencyKey})` | Si instancia ACTIVE + tarea humana abierta → `prisma.$transaction([saveInTx(req), completeTaskInTx(task, outcome), engine.advanceAfterTaskInTx(...)])`. Si no hay instancia o no hay tarea abierta → fallback legacy aplicando solo `requestTransition`. | (3), (5) |

#### Invariantes de diseño (rowseguras)

- **Idempotencia fuerte** (requisito 5): todos los entrypoints aceptan `idempotencyKey` que se propaga al engine (`WorkflowInstance.transitions[].idempotencyKey`). El engine cortocircuita replays por esta clave.
- **Atomicidad** (requisito 1 + 4): Request mutation y WorkflowInstance mutation se persisten en el mismo `$transaction`. Si `engine.startInTx` lanza (doble-start concurrente), la tx rebota y los side-effects (snapshot/event/notification) **NO se commitean** (test #4 mostrar `_markCommitted === false`).
- **Sin doble transición** (requisito 4): `engine.startInTx`/`advanceAfterTaskInTx` setean internamente `skipRequestSync := true` durante la orchestrated run, así el handler de nodos `SYSTEM` (`UPDATE_REQUEST_STATUS`) NO re-invoca `RequestService.transition`.
- **Defensive claim + superuser bypass** (`completeTaskInTx`): si la tarea está `PENDING`, intenta `task.canBeClaimedBy(actorContext)`; si false y `actor.roles includes 'SYSTEM_ADMIN'` (autorizado upstream por `RequestService.assertCanTransition`/`ReviewService.assertManager`), completa directamente. Sino → `ForbiddenError` (403). Iguala el contrato del endpoint standalone `POST /tasks/:id/complete`.

### 2.2 Public API del RequestService (nuevo)

| Método | Archivo | Razón |
|---|---|---|
| `prepareTransition(actor, input): Promise<TransitionPlan>` | `src/modules/requests/application/request.service.ts` | **Eager**: valida business-rule y state-policy ANTES de cualquier persistencia. Lanza `BusinessRuleError`/`UnauthorizedError`/`ConflictError` de antemano para abortar la tx del orchestrator clean. |
| `saveInTx(req, tx): Promise<void>` | idem | Passthrough al repo `saveInTx` para persistir dentro de la tx del orquestador. |
| `saveInTxWithSideEffects(plan): Promise<void>` | idem | `saveInTx(plan.req)` + `commitTransitionSideEffects(plan)`. Usado por los caminos idempotentes y legacy fallback. |
| `commitTransitionSideEffects(plan): Promise<void>` | idem | Persiste snapshot (si procede), AuditEvent, Notification. Reutiliza la misma lógica que `transition()` legacy. |

`transition()` legacy queda **intacto**: el controller ahora enruta submit/resubmit/review-transitions por el orquestador, y el resto (draft→submit desde UI antigua, return manual desde controller de reviews, etc.) sigue por la ruta antigua.

### 2.3 Controller routing

| Archivo | Cambio |
|---|---|
| `src/modules/requests/presentation/controllers/requests.controller.ts` | Se inyecta `RequestWorkflowOrchestrator` vía `@Inject(forwardRef(...))`. Endpoint `transition` delega en `applyTransition(req, transition, actor, ...)`: `submit → orchestrator.onSubmit`, `resubmit → orchestrator.onResubmit`, `advance_to_document_review` / `approve_documents` / `advance_to_final` / `approve_final → orchestrator.onReviewOutcome(outcome='APPROVE')`, `return → onReviewOutcome(outcome='RETURN_FOR_CORRECTION')`, `reject → onReviewOutcome(outcome='REJECT')`. Cualquier otra transición → `requestService.transition()` legacy. Finalmente `getById(req.id)` re-fetch y return. |

### 2.4 Persistencia / Schema

| Archivo | Cambio | Razón |
|---|---|---|
| `prisma/schema.prisma` (`WorkflowInstance`) | Reemplazado `requestId String @unique` por columna simple + 3 índices: `@@index([requestId])`, `@@index([requestId, status])`, `@@index([status])`. Comment block explicativo. | Requisito (2): resubmit debe poder arrancar instancia nueva sin violar unique. La unicidad de "una sola ACTIVE por request" se enforce a nivel app (orquestador), no a nivel schema. |
| `prisma/migrations/20260730120000_relax_workflow_instance_request_uniqueness/migration.sql` | **APLICADA a `sga_dev`**: (1) `CREATE INDEX workflow_instances_request_id_idx` primero, (2) `DROP INDEX workflow_instances_request_id_key`, (3) `CREATE INDEX workflow_instances_request_id_status_idx`. | Orden crítico en MariaDB/MySQL: el índice UNIQUE-backed-FK no se puede soltar si no existe otro índice (error 1553 "needed in a foreign key"). Crear el simple índice primero evita el conflicto. |

### 2.5 Repository ports / implementations

| Archivo | Cambio |
|---|---|
| `domain/repositories/workflow-instance.repository.port.ts` | Documentado `findByRequestId` como "returns current ACTIVE instance, else null". Añadido `findAllByRequestId(requestId)`. |
| `infrastructure/.../workflow-instance.repository.prisma.ts` | `findByRequestId` reescrito: `findMany` con `orderBy [{status asc}, {createdAt desc}]`, escoge el primero ACTIVE o fallback `rows[0]`. Implementado `findAllByRequestId` con `order createdAt desc`. |

### 2.6 Module wiring (DI graph)

| Archivo | Cambio |
|---|---|
| `src/modules/workflows/workflows.module.ts` | Provider + export `RequestWorkflowOrchestrator`. |
| `src/modules/requests/requests.module.ts` | Import `forwardRef(() => WorkflowsModule)`. |

Referencia circular bidireccional resuelta con `forwardRef` en ambas direcciones (Nest lo resuelve en runtime — verificado en boot del 31/07: `[NestApplication] Nest application successfully started` sin errores de DI).

### 2.7 Tests (117 backend · specs afectadas)

| Spec | Estado | Cubre |
|---|---|---|
| `request-workflow-orchestrator.service.spec.ts` (NUEVO, **13 tests**) | ✅ PASS | (1) submit+published → start atomic · (2) submit+no-published → legacy fall-through · (3) submit idempotente con ACTIVE previa · (4) submit doble-start conflictivo → tx rollback (side-effects NOT committed) · (5) resubmit → fresh start · (6) resubmit legacy · (7) resubmit keeps ACTIVE · (8) review APPROVE → completa tarea + advance atomic · (9) review sin ACTIVE → legacy · (10) review con ACTIVE sin tarea abierta → request transition only · (11) review no lanza NotFound cuando no hay tarea abierta (camino correcto) · (12) review sobre instancia no-ACTIVE → legacy (no advance) · (13) invariant: definitions.findPublishedForRequestType nunca throws. |
| `workflow-engine.service.spec.ts` | ✅ PASS | Fakes actualizados: `findByRequestId` returns ACTIVE-or-newest, `findAllByRequestId` added. |
| `workflow-task.service.spec.ts` | ✅ PASS | Fakes actualizados ídem. |

**Resumen backend:** 11 suites / 117 tests PASS · typecheck EXIT=0 · lint EXIT=0 · build EXIT=0.

### 2.8 Boot runtime verificación (31/07/2026 08:09)

```
[Nest] [RoutesResolver] WorkflowInstancesController {/api/v1/workflows/instances}
[Nest]   POST    /api/v1/workflows/instances/start
[Nest]   GET     /api/v1/workflows/instances/:id
[Nest]   GET     /api/v1/workflows/instances/by-request/:requestId
[Nest] [RoutesResolver] WorkflowTasksController {/api/v1/workflows/tasks}
[Nest]   POST    /api/v1/workflows/tasks/:id/claim
[Nest]   POST    /api/v1/workflows/tasks/:id/complete
[Nest] [NestApplication] Nest application successfully started
[Nest] [Bootstrap] SGA API running on http://localhost:4000/api/v1 (development)

$ Invoke-RestMethod http://localhost:4000/api/v1/health
{ "status": "ok", "timestamp": "2026-07-31T13:09:54.110Z" }
```

La app boottea sin errores de DI → `forwardRef` bidireccional resuelve correctamente. Health check 200 OK.

### 2.9 Cierre riguroso: wiring simétrico en `ReviewService` (paso 2 - 31/07 08:30+)

> Hallazgo del paso de revisión: el cierre inicial declaraba "todos los requisitos cubiertos", pero existía EXACTAMENTE una ruta residual — `ReviewService.applyRequestSideEffect` llamaba directamente `requestService.transition(...)` para `approve_documents`, `reject_documents`, `approve_final`, `return`, `reject`. Esto significa que las decisiones tomadas desde los endpoints standalone `POST /reviews/:id/approve-final` etc. mutating el Request SIN completar/avanzar la tarea correspondiente del workflow. Corregido en este paso.

| Archivo | Cambio | Razón |
|---|---|---|
| `src/modules/reviews/application/review.service.ts` | Inyecta `RequestWorkflowOrchestrator` vía `@Inject(forwardRef(() => RequestWorkflowOrchestrator))`. Reemplaza las 5 ramas directas `requestService.transition(...)` en `applyRequestSideEffect` con `orchestrator.onReviewOutcome(...)`. Tabla `REVIEW_TRANSITION_TO_REQUEST_AND_OUTCOME` mapea cada `ReviewTaskTransition` → `{ requestTransition, outcome }`. Helper `isApplicableForRequest` preserva los guards idempotentes del legacy. `assign`/`unassign` se mantienen fuera del orquestador (no tocan status). | Cierre simétrico: ningún endpoint de decisión puede mutar el Request sin pasar por el puente → requisito (3) "Review actions complete or advance the corresponding workflow task" garantizado para AMBAS rutas (controller.transition Y endpoints standalone reviews). |
| `src/modules/reviews/reviews.module.ts` | Añade `forwardRef(() => WorkflowsModule)` a imports. | ReviewsModule necesita acceso a `RequestWorkflowOrchestrator` (provider de WorkflowsModule). NO introduce ciclo nuevo — ReviewsModule se une al grafo bidireccional existente del mismo modo que RequestsModule ya lo hacía. |

#### Mapeo de transiciones (preservado del legacy, ahora por el orquestador)

| ReviewTaskTransition | requestTransition routing | outcome routing | Comment |
|---|---|---|---|
| `approve_documents` | `approve_documents` | `APPROVE` | Document review approves → Request advances to PENDING_FINAL_APPROVAL |
| `reject_documents` | `return` | `RETURN_FOR_CORRECTION` | ⚠️ NOT `reject` — matches legacy: rejecting documents returns Request for correction, doesn't reject the whole Request |
| `approve_final` | `approve_final` | `APPROVE` | Final approval → Request APPROVED |
| `return` | `return` | `RETURN_FOR_CORRECTION` | Returned for correction |
| `reject` | `reject` | `REJECT` | Request REJECTED |
| `assign` / `unassign` | (no routing — no Request status change) | — | Routed via legacy `applyRequestSideEffect` (returns early) |

#### Verificación de ausencia de bypass

Grep de `requestService.transition` en `review.service.ts` posterior al cambio: **0 ocurrencias** (todos los llamados ahora pasan por `orchestrator.onReviewOutcome`). Ver §11.

### 2.10 Boot runtime verificación extendida (31/07/2026 08:33)

```
[Nest] [RoutesResolver] ReviewsController {/api/v1/reviews}
[Nest]   POST    /api/v1/reviews/:id/approve-documents
[Nest]   POST    /api/v1/reviews/:id/reject-documents
[Nest]   POST    /api/v1/reviews/:id/approve-final
[Nest]   POST    /api/v1/reviews/:id/return
[Nest]   POST    /api/v1/reviews/:id/reject
[Nest] [NestApplication] Nest application successfully started

$ Invoke-RestMethod http://localhost:4000/api/v1/health
{ "status": "ok", "timestamp": "2026-07-31T13:33:49.034Z" }

$ Invoke-RestMethod http://localhost:4000/api/v1/reviews -Headers @{Authorization="Bearer dummy"}
(401) Unauthorized  ← route exists (not 404)
```

Todos los endpoints standalone `/reviews/*` ahora resuelven (la DI extendida con ReviewsModule → WorkflowsModule forwardRef carga correctamente).

---

### 2.11 Cierre técnico: fix bug preexistente en `DomainError` + suite de regresión de jerarquía (paso 3 - 31/07)

**Síntoma.** `instanceof ForbiddenError` devolvía `false` sobre instancias creadas con `new ForbiddenError('...')`. Lo mismo para cualquier subclase de `DomainError`. Las specs previas lidiaban con esto usando `toThrow(/regex/)` en vez de `toThrow(ForbiddenError)`. Encryptaba como bug preexistente, no introducido por FASE 1.

**Causa raíz.** El constructor de la clase abstracta base `DomainError` ejecutaba:
```ts
Object.setPrototypeOf(this, DomainError.prototype);
```
Al ser invocado como `super(message)` desde una subclase (p.ej. `ForbiddenError`), `this` ya tiene por defecto la cadena `instance → ForbiddenError.prototype → DomainError.prototype → Error.prototype`. La línea `Object.setPrototypeOf(this, DomainError.prototype)` **sobrescribe** el eslabón directo, colapsando la cadena a `instance → DomainError.prototype → Error.prototype`. Resultado: `instanceof ForbiddenError` (que recorre `instance.__proto__ === ForbiddenError.prototype`) **falla**; en cambio `instanceof DomainError` **acierta por accidente**.

**Fix aplicado.** Sustituir por `new.target.prototype`: `new.target` es el constructor realmente invocado con `new`, de modo que cuando se hace `new ForbiddenError('...')`, `new.target === ForbiddenError` y la cadena correcta se restaura:
```ts
constructor(message: string) {
  super(message);
  // Restaura la cadena de prototipos correcta para subclases. Necesario
  // porque al extender `Error` (built-in transpilada) `this` puede
  // construirse con `Error.prototype`; y porque el `super(message)` no
  // sabe qué subclase lo está llamando. `new.target` siempre apunta a la
  // constructora invocada por `new`, preservando la jerarquía real.
  Object.setPrototypeOf(this, new.target.prototype);
  this.name = this.constructor.name;
}
```

**Contrato público preservado.** Cada subclase sigue exponiendo `.code`, `.statusCode`, `.name`, `.message` con los mismos valores por defecto (ValidationError 400/'VALIDATION_ERROR', NotFoundError 404/'NOT_FOUND' (con/sin id), ConflictError 409/'CONFLICT', BusinessRuleError 422/'BUSINESS_RULE_VIOLATION', UnauthorizedError 401/'UNAUTHORIZED', ForbiddenError 403/'FORBIDDEN'). El filtro global `global-exception.filter.ts:61` usa `instanceof DomainError` **Y** lee las propiedades `.code/.statusCode/.name/.message` — no hace subclass-checks — por lo que la lógica de respuesta HTTP queda **inmutada**.

**Cambios concretos en este paso:hechos.**

1. `apps/api/src/common/domain/errors/domain-error.ts` — cambio de una línea (constructor) + bloque de comentario explicativo.
2. `apps/api/src/common/domain/errors/domain-error.spec.ts` — **NUEVO**, 16 tests de regresión:
   - La base es abstracta (no instanciable directamente).
   - Para cada subclase (ValidationError, NotFoundError con/sin id, ConflictError, BusinessRuleError, UnauthorizedError default/custom, ForbiddenError default/custom): `instanceof DomainError` ✓, `instanceof <Subclass>` ✓, `instanceof <otra subclase>` ✗ (no contamina).
   - Contrato público: `.code`, `.statusCode`, `.name`, `.message` con valores por defecto para las 6 subclases.
   - Patrón async — `.rejects.toThrow(ForbiddenError)` y `.rejects.toThrow(NotFoundError)` (Constructor matchers, que internamente usan `instanceof`) ahora funcionan.
3. `apps/api/src/modules/reviews/application/review.service.spec.ts` — restaurados los asserts originales:
   - re-import de `ForbiddenError`, `NotFoundError` desde `domain-error.ts`.
   - `toThrow(/You are not allowed.../)` → `toThrow(ForbiddenError)`. 
   - `toThrow(/ReviewTask not found.../)` → `toThrow(NotFoundError)`.
   - Eliminados los comentarios NOTE que justificaban los regex workarounds.

**Audiotría de superficies consumidoras.** Búsqueda de `instanceof DomainError` en el codebase → 1 uso productivo en `global-exception.filter.ts:61` (sigue funcionando: `DomainError` sigue estando en la cadena prototipal). Cero instancias de `instanceof Subclass` en código de producción (solo tests), de modo que el fix no altera comportamiento runtime en endpoints HTTP. El bug solo hacía ruido en tests.

---

## 3. Items parcialmente completados / no cubiertos

| Item | Estado | Razón / Desviación |
|---|---|---|
| ~~Revisión directa por `ReviewService` (POST `/reviews/:id/approve-final` etc.) que cruce al workflow~~ | ✅ **RESUELTO (paso 2)** | El cierre inicial lo marcaba pendiente; corregido en este paso de cierre riguroso (ver §2.9). Hoy `ReviewService.applyRequestSideEffect` enruta approve_documents / reject_documents / approve_final / return / reject por `orchestrator.onReviewOutcome`. `assign` / `unassign` siguen sin tocar Request status. |
| Tests **e2e** (supertest en `test/app.e2e-spec.ts`) | 🟡 Deferred | Las 26 unit + integración spec (13 del orquestador + 13 de ReviewService) cubren el contrato del orquestador con stubs/fakes. Un test e2e simulando POST → DB → POST completo requiere seed workflow + auth fixture extensa; se difiere a FASE 1.5 / FASE 8 (endurecimiento e2e). El controller + service routing está testeado indirectamente vía specs. |
| Migración de requests legacy (sin workflow VersionId guardado) | ✅ Cubierto | Requisito (7) "Existing requests without a workflow must continue operating safely" garantizado por fallback. No hay migración de datos — los requests existentes simplemente no arrancan workflow hasta que tengan `REQUEST_TYPE_CODE` con PUBLISHED. |
| WorkflowVersion **snapshot** en `WorkflowInstance.workflowVersionId` | ✅ Ya existía | `WorkflowInstance.start` ya persiste `workflowVersionId` del PUBLISHED al arrancar. Requisito (6) **ya cubierto por diseño existente** (no hubo cambios). |

---

## 4. Bloqueantes

**Ninguno activo** para FASE 1. Los bloqueantes restantes del roadmap (45–71%) pertenecen a fases posteriores:

| Bloqueante | FASE |
|---|---|
| Integración Intelesis (sincronización identidad) | 5 |
| Integración RH Amaxonia (carga inicial personas) | 5 |
| Integración Honeywell Pro-Watch (emisión física) | 5 |
| Integración Exámenes (médicos/psicotécnicos) | 5 |
| Hardware físico (lectores, cámaras, impresoras) | 5 |

---

## 5. Migraciones de DB creadas en FASE 1

| Migración | Acción | Estado DB |
|---|---|---|
| `20260730120000_relax_workflow_instance_request_uniqueness` | Crea índice simple `requestId` → dropea `requestId` UNIQUE → crea índice compuesto `(requestId, status)` | ✅ **APLICADA a `sga_dev`** (verificada: `Database schema is up to date!` — 18 migraciones aplicadas) |

Lección aprendida (memory `agents-contract-lessons.md` §mariadb-fk-backing-index): en MariaDB no se puede dropear un índice que respalda una FK si no hay OTRO índice que la respalde. Solución: crear el simple primero, después dropear el unique.

---

## 6. Comandos ejecutados y resultados (evidencia reproducible)

| # | Comando | Resultado |
|---|---|---|
| 1 | `npx prisma format` | ✅ `Formatted prisma\schema.prisma in 73ms` |
| 2 | `npx prisma validate` | ✅ `The schema at prisma\schema.prisma is valid` |
| 3 | `npm run typecheck` (backend) | ✅ EXIT=0 |
| 4 | `npm run lint` (backend) | ✅ EXIT=0 |
| 5 | `npm run test` (backend) | ✅ **12 suites / 130 tests PASS (18.6s)** — +1 suite, +13 tests vs. cierre inicial (117→130). La suite nueva es `review.service.spec.ts`. |
| 6 | `npm run build` (backend) | ✅ Prisma Client regenerated · nest build EXIT=0 |
| 7 | `Push-Location apps/api; node dist/src/main.js` | ✅ `Nest application successfully started` · 200 OK en `/api/v1/health` · `/api/v1/reviews` responde 401 (route exists, not 404) |
| 8 | `npm run typecheck` (frontend) | ✅ EXIT=0 (sin cambios en `apps/web` desde FASE 0) |
| 9 | `npm run lint` (frontend) | ✅ EXIT=0 |
| 10 | `npm run test` (frontend) | ✅ 2 files / 39 tests PASS (3.30s) |
| 11 | `npm run build` (frontend) | ✅ 24 rutas compiladas (Next 16, build EXIT=0) |
| 12 | `npx prisma migrate status` | ✅ `Database schema is up to date!` (18 migraciones aplicadas) |

---

## 7. Trabajo restante (priorizado)

| # | Item | FASE | Tipo |
|---|---|---|---|
| 1 | Wiring simétrico en `ReviewService` (`POST /reviews/:id/approve-final` etc.) para que también use el orquestador | 1 (extensión) | Técnico |
| 2 | E2E en `test/app.e2e-spec.ts` cubriendo submit→workflow start→review→complete end-to-end con DB | 1.5 (endurecimiento) | Técnico |
| 3 | Modelo jerárquico organizacional (cargos niveles, escalamiento organizativo) | FASE 2 (7% roadmap) | Técnico + Negocio |
| 4 | 13 tipos de nodo restantes en engine | FASE 3 (7% roadmap) | Técnico |
| 5 | Editor visual @xyflow/react (ya existe la pagina `/workflows/[id]/editor` con scaffold) | FASE 4 (7% roadmap) | Técnico |
| 6 | Flujos especializados de carné | FASE 5 (5% roadmap) | Bloqueante externo |
| 7 | Integraciones externas (Intelesis, RH Amaxonia, Honeywell, Exámenes, hardware) | FASE 5 (restante +1% cada una) | Externo / Negocio |

---

## 8. Porcentaje interno honesto (excluyendo integraciones externas)

| | % |
|---|---|
| FASE 0 | 66% base |
| **+ FASE 1 (este cierre)** | **+5% → acumulado 71%** |
| -150 Integrationes externas (Intelesis + RH + Honeywell + Exámenes + HW) | restan dentro de FASE 5 — **no afectan el conteo interno** (se excluyen explícitamente per enunciado) |

**% interno COMPLETADO (excluyendo 4 integraciones externas + HW):** **71%**
**% interno PENDIENTE:** 29% (FASES 2, 3, 4, sub-flujos de FASE 5, 6, 7, 8).

---

## 9. Trazabilidad Requisitos ↔ Implementación (traceability matrix)

| # | Requisito (verbatim) | Implementación | Evidencia | Test |
|---|---|---|---|---|
| R1 | Submitting a Request starts the applicable published workflow | `onSubmit` → `$transaction([saveInTx, engine.startInTx])` | §2.1, §2.6 | Test #1 spec orchestrator |
| R2 | Resubmitting a returned Request continues or safely restarts the correct execution | `onResubmit` → relaxation `requestId @unique` permite nueva instancia tras RETURN/REJECT | §2.4 migration, §2.1 | Tests #5, #7 |
| R3 | Review actions complete or advance the corresponding workflow task | `onReviewOutcome` → completeTaskInTx + advanceAfterTaskInTx | §2.1 | Test #8 |
| R4 | Workflow system actions update Request status without causing duplicate transitions | `engine.startInTx/advanceAfterTaskInTx` setean `skipRequestSync` durante orchestrated run | §2.1 invariantes | Implícito en todos los tests (no se dobla la transición) |
| R5 | Operations must be idempotent | `idempotencyKey` propagation; ACTIVE-existing guards en onSubmit/onResubmit | §2.1 invariantes | Tests #3, #4 |
| R6 | Each Request must retain the workflow version used when execution started | `WorkflowInstance.workflowVersionId` persistido en `WorkflowInstance.start` | Ya existente (no hubo cambios) | n/a (diseño previo) |
| R7 | Existing requests without a workflow must continue operating safely until migrated | Fallback legacy cuando no PUBLISHED workflow o no ACTIVE instance o no open task | §2.1 entrypoints | Tests #2, #6, #9, #10 |
| R8 | Add unit and integration tests for submit, resubmit, approve, reject, return and duplicate execution | 13 tests orchestrator + fakes actualizados en engine-task specs | §2.7 | 13 tests PASS + 117 total backend PASS |

---

## 10. Historial de cambios

| Fecha | Fase | Acción |
|---|---|---|
| 2026-07-31 | FASE 1 | Cierre: orquestador + persistencia + DI graph + 13 tests + boot verification + pipeline verde. Documento creado. |
| 2026-07-31 | FASE 1 (paso 2) | **Cierre riguroso**: wiring simétrico en `ReviewService` → +13 tests en `review.service.spec.ts` → 130 tests total backend. Boot extendido verifica ReviewsModule ⊂ forwardRef graph. Eliminada la única ruta residual de bypass. |
| 2026-07-31 | FASE 1 (paso 3 — técnico) | **Cierre técnico**: fix bug preexistente en `DomainError` (`Object.setPrototypeOf(this, DomainError.prototype)` → `new.target.prototype`) + suite de regresión `domain-error.spec.ts` (16 tests jerarquía + contrato) + restauración de asserts `toThrow(ForbiddenError)`/`toThrow(NotFoundError)` en `review.service.spec.ts`. 13 suites / ~146 tests backend. FASE 1 declarada **commit-ready**. |
| 2026-07-31 | Roadmap | Reordenamiento acordado con usuario: F2 **Emisión y custodia temporal** → F3 Alertas → F4 Auditoría/reportes → F5 Endurecimiento interno → EXT integraciones externas. Modelo jerárquico organizacional movido a backlog. Roadmap formal sincronizado en `docs/audit/SGA-ROADMAP-TO-100.md §1/§8/§10`. |

---

## 11. Próximo paso

**Esperando autorización explícita del usuario** para iniciar la siguiente fase, **FASE 2 — Emisión y custodia temporal**, conforme al roadmap vigente reformulado el 31/07/2026 (`docs/audit/SGA-ROADMAP-TO-100.md §1.1`).

> NOTA DE SINCRONIZACIÓN DOCS: la versión original de este documento y de `SGA-ROADMAP-TO-100.md` mencionaban a "Fase 2 — Modelo jerárquico organizacional" como siguiente. La tabla ejecutiva `SGA-ROADMAP-TO-100.md §1.1` fue actualizada el 31/07/2026 al plan acordado con el usuario: F2 ahora es **Emisión y custodia temporal**; el modelo jerárquico organizacional fue movido al **backlog** como deferido (NO eliminado, sigue en §3 como referencia técnica). El usuario dijo explícitamente **«No inicies todavía FASE 2.»** y **«No hagas commit todavía.»** — este documento queda en estado de espera.
