# SGA — Estado de Implementación al 100% (Tracking Document)

**Proyecto:** SGA — Sistema de Gestión de Accesos · Aeropuerto Internacional de Tocumen, S.A.
**Rama de trabajo:** `main`
**Documento maestro de seguimiento del roadmap (`docs/audit/SGA-ROADMAP-TO-100.md`).**
**Última actualización:** 31 de Julio de 2026 (FASE 1 cerrada rigurosamente — paso 3: fix de bug preexistente en `DomainError` + suite de regresión de jerarquía de errores + restauración de asserts `instanceof` en ReviewService spec; 13 suites / ~146 tests backend)

---

## 0. Meta y definición de 100%

Una fase se considera `COMPLETED` solo cuando: backend + frontend + persistencia + permisos + auditoría + pruebas + builds + lint + typecheck están verdes; no quedan TODO/mocks/stubs relacionados; existe evidencia reproducible; y la documentación está actualizada.

Cualquier desviación → `PARTIAL` o `BLOCKED`. **Nunca** se reporta como completo por la sola existencia de endpoint/UI/entidad.

---

## 1. Porcentaje global

| | Valor |
|---|---|
| **% inicial (auditoría FASE 0)** | **66%** (ver `docs/audit/SGA-CURRENT-STATE.md §10`) |
| **% tras FASE 0** | **66%** (baseline saneado, sin cambio funcional) |
| **% actual tras FASE 1** | **71%** (+5%: bridge engine↔Request lifecycle cerrado) |
| **Meta final** | **100%** |

> El % se recalcula por fase siguiendo los pesos del enunciado (motor 20%, solicitudes 15%, operaciones 15%, editor 10%, etc.).

---

## 2. Resumen de fases

> **Reordenamiento acordado con el usuario (31/07/2026):** la hoja de ruta se compactó a 5 fases internas + integraciones externas (EXT) al final. La fase “Modelo jerárquico organizacional” se mueve al *backlog* como deferida. La tabla de fases detallada y el orden de ejecución están en `docs/audit/SGA-ROADMAP-TO-100.md §1` y `§8` (fuente de verdad).

| Fase | Nombre | Estado | % aplicado | Documento |
|---|---|---|---|---|
| 0 | Protección y línea base | ✅ **COMPLETED** | — (base saneada, sin cambio funcional) | `SGA-IMPLEMENTATION-STATUS.md` |
| **1** | **Bridge Workflow Engine ↔ Request/Review Lifecycle** | ✅ **COMPLETED** (cierre riguroso, 3 pasos) | +5% | `phases/SGA-PHASE-01-WORKFLOW-BRIDGE.md` |
| **2** | **Emisión y custodia temporal** (foto, examen, custodia, pase temporal, entrega — cierra CARNÉ 1-3) | 🟡 READY TO START (siguiente, pendiente autorización) | +7% | — |
| **3** | **Alertas y notificaciones** multi-canal + SLA + escalamiento | ⚪ NOT STARTED | +2% | — |
| **4** | **Auditoría transversal + reportes + visibilidad operativa** | ⚪ NOT STARTED | +3% | — |
| **5** | **Endurecimiento interno** (seguridad, consistencia de domain errors, e2e, observabilidad, deploy-cloud) | ⚪ NOT STARTED | +6% | — |
| **EXT** | **Integraciones externas** (Intelesis · RH Amaxonia · Honeywell Pro-Watch · Exámenes médicos · HW físico) | ⚪ Diferido al final (depende de contratos externos) | n/a interna | — |

### 2.1 Backlog / diferidos (fuera de la línea principal)

| Item | Razón de postergación |
|---|---|
| Modelo jerárquico organizacional (`CompanyOrgUnit`) | Re-evaluable si F2 o F5 lo requieren |
| Editor visual `@xyflow/react` (scaffold existe en `/workflows/[id]/editor`) | Se re-evaluará tras F2 |
| 13 tipos de nodo avanzados del engine | Se añadirán conforme F2/F4 los demande |

---

## 3. Línea base capturada en FASE 0

### 3.1 Git baseline

| | Valor |
|---|---|
| Branch | `main` (trabajamos directamente sobre ella por decisión del usuario) |
| Commit HEAD (pre-FASE 0) | `50caa17 🚑️ [hotfix] correcciones de UI` |
| Commit HEAD (post-FASE 0) | `26493aa docs(sga): capture baseline, audits, security flows and implementation tracker` |
| Estado working tree | ✅ **LIMPIO** — todos los cambios committados en 6 commits atómicos |
| Commits atomicos FASE 0 | `42de480` identidad/drop people · `0fade8e` workflows engine · `bcc9fc5` align módulos · `dd6775b` common types · `5244472` build config · `26493aa` docs |
| Migraciones pendientes en código | `20260721160000_consolidate_user_identity`, `20260721170000_add_dynamic_workflow_engine` (sin aplicar a BBDD compartida — gestión externa) |

### 3.2 Resultados de pipeline (capturados antes de cualquier cambio)

| Plataforma | Comando | Resultado FASE 0 (final) |
|---|---|---|
| Backend tests | `npm run test` | ✅ **9 suites / 92 tests PASS** (sin regresiones por los cambios de tipos) |
| Backend typecheck | `npm run typecheck` | ✅ **EXIT=0** (TS6059 corregido vía `rootDir: ./`) |
| Backend lint | `npm run lint` | ✅ **EXIT=0, 0 errores / 0 warnings** (de 46650 → 99 → 0 con tipos concretos) |
| Backend build | `npm run build` | ✅ **EXIT=0** (Prisma Client regenerado, Nest compilado) |
| Frontend typecheck | `npm run typecheck` | ✅ **EXIT=0** |
| Frontend lint | `npm run lint` | ✅ **EXIT=0** |

### 3.3 Errores preexistentes documentados (pre-FASE 1)

Estos NO son atribuibles a las fases nuevas; se documentan para trazabilidad:

| ID | Error | Severidad | Causa raíz | Acción FASE 0 |
|---|---|---|---|---|
| PRE-01 | `TS6059: ... not under 'rootDir'` | Bloqueante | `tsconfig.json` base tenía `rootDir: ./src` + `include: ["src/**/*.ts", "test/**/*.ts"]` | **FIX**: cambiado a `rootDir: ./` (el `tsconfig.build.json` ya excluye tests para el bundle de prod) |
| PRE-02 | 46 650 errores `prettier/prettier` | No bloqueante, pero ensucia diffs | El codebase se escribió sin `prettier --write` en commits pasados | **FIX**: `eslint --fix` aplicado |
| PRE-03 | `JwtAuthGuard` no valida revocación de access-token en caliente | Medio | `JwtAuthGuard` solo valida signature + exp (documentado en memoria del proyecto) | Diferido a FASE 8 (endurecimiento) |
| PRE-04 | `AuthService` escribe `AuditEvent` directo vía Prisma en vez de `AuditService` | Medio | `AuditService` existe pero no es inyectado por ningún módulo | Diferido a FASE 7 |
| PRE-05 | Varios `throw new Error(...)` en controllers/entities | Medio | Deberían ser `BusinessRuleError` 422/400 | Diferido a FASE 8 |

---

## 4. Hallazgos arquitectónicos clave (relevantes para FASE 1+)

Estos hechos determinan el diseño de las fases siguientes:

1. **`Request 1:1 WorkflowInstance?` YA EXISTE** en `schema.prisma:521` con FK completa.
   → La migración propuesta `F1.M1` del roadmap **NO es necesaria**.
2. **`WorkflowEngineService.start(req,type,actor)` YA EXISTE**, valida idempotencia (`findByRequestId` → `ConflictError`) y vincula `WorkflowInstance.workflowVersionId`.
3. **`WorkflowDefinition.findPublishedForRequestType`** está implementado en Prisma repo y retorna `{definition, publishedVersion}`.
4. **`review.service.ts` YA invoca `requestService.transition`** como side-effect. → Riesgo concreto de **doble transición** cuando se active el bridge.
5. **`workflow-engine.service.ts:runSystemAction(UPDATE_REQUEST_STATUS)`** ya mapea a `RequestTransition` vía `mapStatusToTransition()`.
6. La semilla `temporary_person_default` es **PUBLISHED v1** pero el engine nunca arranca automáticamente desde `RequestService.transition('submit')`.
7. **Solo 5/18 tipos de nodo** están implementados (START, END, HUMAN_TASK, SYSTEM, DECISION) — FASE 3.
8. **No existe `@xyflow/react`** instalado — FASE 4.

---

## 5. Decisiones de FASE 0

| Decisión | Justificación |
|---|---|
| Trabajar sobre `main` | Decisión explícita del usuario (2026-07-23) |
| Commits atómicos por área | 6 commits que agrupan los ~70 archivos modificados: identidad, workflows, ajustes módulos, transversales, lint-format, docs |
| `rootDir: ./` (no `./src`) | `tsconfig.build.json` ya excluye `test/` para producción; el typecheck de IDE/tests necesita ambos árboles |
| `eslint --fix` en bloque | El coste de revisión manual de 46k problemas de whitespace supura el costo real; son 100% auto-fixables y semánticamente nulos |
| No tocar BBDD compartida | `prisma migrate reset` no ejecutado; las 2 migraciones pendientes se aplicarán en gestión de despliegue del usuario |

---

## 6. Migraciones

| Migración | Estado | FASE que la introdujo |
|---|---|---|
| `20260721160000_consolidate_user_identity` | En código (sin aplicar) | Pre-FASE 0 (commit incoming) |
| `20260721170000_add_dynamic_workflow_engine` | En código (sin aplicar) | Pre-FASE 0 (commit incoming) |
| *(Ninguna nueva prevista en FASE 0)* | — | — |
| `20260730120000_relax_workflow_instance_request_uniqueness` | ✅ APLICADA a `sga_dev` (18 migraciones totales) | FASE 1 |

---

## 7. Próxima fase (próximo prompt)

> **Siguiente fase fijada por el usuario (2026-07-31):** **FASE 2 — Emisión y custodia temporal** (no el modelo jerárquico organizacional). El roadmap formal (`docs/audit/SGA-ROADMAP-TO-100.md §1.1`) queda actualizado a este orden. Pendiente de autorización explícita para iniciar implementación.
>
> **El usuario indicó explícitamente: «No inicies todavía FASE 2.»** — este documento queda en estado de espera. Cuando el usuario autorice, se generará `phases/SGA-PHASE-02-CREDENTIAL-ISSUANCE.md` con tareas, migraciones propuestas y tests obligatorios.
>
> FASE 1 quedó cerrada rigurosamente el 2026-07-31 en 3 pasos: (1) Bridge engine↔Request lifecycle, (2) wiring simétrico ReviewService, (3) fix bug preexistente en `DomainError` + suite de regresión de la jerarquía + restauración de asserts `instanceof` en ReviewService spec. Ver `phases/SGA-PHASE-01-WORKFLOW-BRIDGE.md`.

---

## 8. Bloqueantes

Ninguno activo. Los PRE-03..05 están diferidos a sus fases correspondientes.

---

## 9. Deuda técnica pendiente

> Numeración de fases conforme al plan vigente (§2). Si la fase original del roadmap se referenciaba en esquemas previos, se asignó a la nueva más cercana.

| Item | FASE donde se cierra |
|---|---|
| AUTH: `JwtAuthGuard` sin revocación en caliente | F5 (Endurecimiento interno) |
| AUDIT: `AuthService` escribe directo a Prisma | F4 (Auditoría transversal) |
| Dominio: `throw new Error(...)` que deberían ser domain errors | F5 (Endurecimiento interno) |
| Editor visual inexistente (scaffold presente) | Backlog — re-evaluar tras F2 |
| 13 tipos de nodo workflow sin implementar | Backlog — demanda-driven por F2/F4 |
| Asignación jerárquica por cargo+unidad | Backlog (diferido según decisión usuario) |
| Custodia física / captura foto / examen / SLA de emisión | F2 (Emisión y custodia temporal) |
| Notificaciones multi-canal | F3 (Alertas y notificaciones) |
| Integraciones externas (Intelesis, RH Amaxonia, Honeywell Pro-Watch, HW físico) | EXT (al final) |

---

## 10. Historial de cambios

| Fecha | Fase | Acción |
|---|---|---|
| 2026-07-23 | FASE 0 | Creación del documento; baseline capturado; tsconfig y lint saneados |
| 2026-07-31 | FASE 1 (paso 1) | Bridge engine↔Request lifecycle: `RequestWorkflowOrchestrator` (onSubmit/onResubmit/onReviewOutcome) + persistencia relajada + DI boot verification. |
| 2026-07-31 | FASE 1 (paso 2) | Wiring simétrico: ReviewService ahora rutea decisiones a través de `RequestWorkflowOrchestrator.onReviewOutcome` (forwardRef ReviewsModule → WorkflowsModule). 13 tests ReviewService spec. |
| 2026-07-31 | FASE 1 (paso 3) | **Fix bug preexistente en `DomainError`** (constructor usaba `Object.setPrototypeOf(this, DomainError.prototype)` colapsando prototipos de subclases → cambiado a `new.target.prototype`). Creada suite de regresión `domain-error.spec.ts` (16 tests cubriendo jerarquía + contrato público). Restaurados asserts `instanceof` (`toThrow(ForbiddenError)` / `toThrow(NotFoundError)`) en ReviewService spec. 13 suites / ~146 tests backend. FASE 1 declarada **commit-ready**. |
| 2026-07-31 | Roadmap | Reordenamiento acordado con el usuario: 5 fases internas (F2 Emisión → F3 Alertas → F4 Auditoría/reportes → F5 Endurecimiento) + EXT integraciones externas al final. Modelo jerárquico organizacional movido a backlog. Actualizado `docs/audit/SGA-ROADMAP-TO-100.md §1/§8/§10`. |
