# SGA — Hoja de Ruta al 100% (Roadmap to 100)

**Proyecto:** SGA — Aeropuerto Internacional de Tocumen, S.A.
**Fecha:** 23 de Julio de 2026 (versión original) · **31 de Julio de 2026** (reordenamiento acordado con el usuario tras cierre de FASE 1)

> **Reordenamiento acordado (31/07/2026):** Las fases se han recompactado a 5 fases internas + integraciones externas al final, conforme al plan fijado por el usuario. La fase “Modelo jerárquico organizacional” se conserva en el *backlog* como **deferred** (no requerida como siguiente fase). Ver §1 (tabla nueva) y §2.1 (no-promoted). Las secciones de detalle original (§3-§7) quedan como referencia técnica; su numeración interna NO coincide con el nuevo orden de ejecución. La **tabla ejecutiva de §1** y el **orden de §8** son la fuente de verdad.

> Este documento lista lo que falta. No crea ni modifica código. Cada fase define tareas exactas, dependencias, artefactos afectados, migraciones necesarias (a proponer — no a ejecutar), pruebas obligatorias, criterios binarios de aceptación, riesgos, complejidad y orden recomendado.

---

## 0. Resumen del estado y meta

- **Completado evidenciado:** **66%** (ver `SGA-CURRENT-STATE.md §10`). El gap principal: motor no integrado + editor visual ausente + flujos especializados de carné sin cubrir + jerarquía organizacional ausente.
- **Meta:** motor de flujos configurable con editor visual basado en `@xyflow/react`, integrado al lifecycle de Request, que soporte los 18 tipos de nodo del enunciado y reemplace progresivamente las state machines hardcoded (`RequestStatePolicy`, `ReviewStatePolicy`).

---

## 1. Fases ordenadas (resumen ejecutivo)

> ⚠️ **Importante:** esta es la tabla reformulada que refleja el plan acordado con el usuario el 31/07/2026. Las secciones de detalle originales (§2-§7 más abajo) preservan la numeración histórica para referencia; la tabla de aquí es la **fuente de verdad**.

### 1.1 Hoja de ruta vigente (31/07/2026)

| Fase | Nombre | Complejidad | Desbloquea | Aporta al global | Estado |
|---|---|---|---|---|---|
| **F1** | Bridge Workflow Engine ↔ Request/Review Lifecycle | Media | F2, F3, F4, F5 | +5% | ✅ **COMPLETED** (31/07/2026 — cierre riguroso) |
| **F2** | **Emisión y custodia temporal** (credential lifecycle: PHOTO, EXAM, custody, temp-pass emit, deliver) | Media-Alta | cerrar flujos CARNÉ 1-3 | +7% (absorbe nodos F1-previo + flujos especializados) | 🟢 Listo para iniciar tras autorización |
| **F3** | **Alertas y notificaciones** multi-canal + SLA + escalamiento | Media | GAP-05/06 cierre; cierra F6-previo | +2% | ⚪ NOT STARTED |
| **F4** | **Auditoría transversal + reportes + visibilidad operativa** | Media | cierre Áreas 8/9; cierra F7-previo | +3% | ⚪ NOT STARTED |
| **F5** | **Endurecimiento interno** (seguridad, consistencia tipos de errores, e2e, observabilidad, despliegue-cloud) | Alta | productivo real; cierra F3-previo + F8-previo + parte de F5-previo | +6% | ⚪ NOT STARTED |
| **EXT** | **Integraciones externas** (Intelesis · RH Amaxonia · Honeywell Pro-Watch · Exámenes médicos · HW físico) | Alta (externo) | sincronización + emisión física | +varios (depende negocio) | ⚪ Diferido al final |

> **Total interno acumulado proyectado (sin EXT):** 5+7+2+3+6 = **23% sobre baseline 66% → 89% + 11% buffer**. La fase EXT (integraciones externas) es dependiente de business decisions / contratos y no se incluye en el % interno de completitud.

### 1.2 Backlog / diferidos (NO en la hoja de ruta vigente)

| Item | Razón de la postergación | Re-evaluación |
|---|---|---|
| **Modelo jerárquico organizacional** (`CompanyOrgUnit`, niveles, escalamiento jerárquico por cargo+unidad) | El usuario lo declaró no prioritario como siguiente fase; se conserva en el backlog. Reaparece en §3 como referencia técnica original. | Si F2 (Emisión) o F5 (Endurecimiento) necesitan escalamiento organizacional real, se desempolvará. |
| **Editor visual** con `@xyflow/react` (F4 original) | Permanece en §5 como referencia técnica. NO existe plan de ejecución como fase separada; el scaffold de `/workflows/[id]/editor` ya existe. Se re-evaluará al finalizar F2 si la complejidad de flujos lo justifica. |Tras F2 |
| **13 nuevos tipos de nodo en engine** (F3 original) | Se retiene en §4 como referencia técnica. NO se incluye como fase separada; los nodos avanzados (TIMERS, PARALLEL_SPLIT, etc.) se añadirán conforme aparezcan requerimientos en F2/F4. | Cuando lo requiera una fase en curso |

---

## 2. Fase 1 — Bridge engine ↔ Request lifecycle

**Objetivo**: que cada `RequestService.transition(... 'submit')` arranque automáticamente un `WorkflowInstance` si existe `WorkflowVersion PUBLISHED` para el `requestType`, y que los movimientos futuros provengan del engine.

### 2.1 Tareas exactas
- T1.1 — En `apps/api/src/modules/requests/requests.module.ts` importar `forwardRef(() => WorkflowsModule)` para resolver la dependencia circular que ya existe (`workflows.module.ts:22`).
- T1.2 — Inyectar `WorkflowEngineService` en `RequestService` con `@Optional() forwardRef(() => WorkflowEngineService)` para no romper tipos existentes.
- T1.3 — En `RequestService.transition`, **después** de `recordEvent('SUBMITTED'|'RESUBMITTED')`, llamar `engine.start({requestId, requestType, actor, contextPatch, idempotencyKey})`. Capturar el caso "no PUBLISHED workflow" → *fallback* silencioso a la `RequestStatePolicy` actual (no rompe tipos sin workflow).
- T1.4 — En `ReviewService.transition` decisor: si `Request.workflowInstance !== null`, la transición se hace vía `POST /workflows/tasks/:id/complete` (engine), NO vía `RequestService.transition` directo; sino, mantener la pipeline actual.
- T1.5 — Documentar invariantes en `apps/api/src/modules/requests/domain/request.entity.ts`: `Request.workflowInstanceId` se persiste como FK en la migración F1.M1.

### 2.2 Migraciones necesarias (a proponer — no ejecutar)
- **F1.M1** — `alter table requests add column workflow_instance_id char(36) null unique;` + FK. (Confirmar si ya existe como relación 1:1 soft en schema.prisma; en la version auditada `Request` aparece con `1:1 WorkflowInstance?` en la exploración — verificar antes de migrar.)

### 2.3 Pruebas obligatorias
- `request.service.spec.ts`: `submit` con workflow PUBLISHED → instancia creada; `submit` sin workflow → fallback OK; transición simultánea manual + engine rechazada con `ConflictError`.
- `workflow-engine.service.spec.ts`: agregar caso de integración real con `RequestService` no stub.
- E2E `app.e2e-spec.ts`: end-to-end `POST /requests → POST /requests/:id/transition submit → GET /workflows/instances/by-request/:id`.

### 2.4 Criterios binarios de aceptación
- [ ] Para `requestType` con workflow PUBLISHED, todo `POST /requests/:id/transition {transition:'submit'}` produce una `WorkflowInstance` con `status=ACTIVE` y un `WorkflowTask` inicial.
- [ ] Para `requestType` SIN workflow, el comportamiento旒fall back es idéntico al snapshot auditado (12 transiciones hardcoded).
- [ ] No existen dobles actualizaciones: si se llama `engine.start` manualmente después de `submit`, devuelve `ConflictError`.
- [ ] `lockVersion` del `WorkflowInstance` es respetado en concurrency test.

### 2.5 Riesgos
- R1.1 — Doble state-machine: que `RequestStatePolicy` y `engine.runSystemAction(UPDATE_REQUEST_STATUS)` ejecuten la misma transición dos veces. **Mitigación:** los `SYSTEM_ACTIONS` ya mapean a `RequestTransition`; revisar `workflow-engine.service.ts:311` y acotar a *una sola* llamada por step.
- R1.2 — Performance: cada submit ahora hace +1 lookup +1 transaction. Mitigar con cache en `WorkflowDefinitionPrismaRepository`.

### 2.6 Complejidad
**Media** — 5 a 8 días de implementación + pruebas; alto impacto conceptual.

---

## 3. Fase 2 — Modelo jerárquico organizacional (`CompanyOrgUnit`)

**Objetivo**: soportar resolución de aprobadores por *cargo y unidad*, no por `roleCode`.

### 3.1 Tareas exactas
- T2.1 — Crear migración `create_organization_units` con tabla:
  ```
  company_org_units(
    id char(36) pk,
    companyId char(36) fk restrict,
    parentUnitId char(36) fk null,
    level enum('VICEPRESIDENCIA','DEPARTAMENTO','SECCION','EQUIPO','GRUPO'),
    code varchar(50),
    name varchar(120),
    managerUserId char(36) fk null -> users,
    isActive bool,
    createdAt, updatedAt,
    unique(companyId, code)
  )
  ```
  ← Respetar AGENTS §8 en código: usar `level1..level7`/`orgLevel` como **identificadores**; los valores "Vicepresidencia/Departamento" son datos del tenant, no nomenclatura de código.
- T2.2 — Crear módulo `apps/api/src/modules/org-units/` (controller+service+entity+Prisma repo).
- T2.3 — En `User` agregar `orgUnitId char(36) fk null`.
- T2.4 — Crear servicio `HierarchyResolver.resolveApprover({userId, levelWalk})` que parta del `User.orgUnitId` y suba levels hasta encontrar un `managerUserId`.
- T2.5 — Exponer API: `GET /org-units?companyId=` y `POST /org-units` con permiso `org.manage`.

### 3.2 Pruebas
- `hierarchy-resolver.service.spec.ts` — escalamiento por niveles.
- `org-units.integration.spec.ts` — CRUD + tree integrity.

### 3.3 Criterios binarios
- [ ] Existe la tabla y CRUD funcional.
- [ ] Dado un `User` sin `roleCode 'COMPANY_ADMIN'`, `resolveApprover` sube niveles hasta el aprobador competente sin loop infinito (cap por nivel 1 = vicepresidencia).
- [ ] El árbol admite renombrado de etiquetas por tenant (no por tenant en código, sino por dato `name`).

### 3.4 Riesgos
- R2.1 — Migración de datos existentes: `User.department` (VarChar libre) debe migrarse a una unidad por defecto o quedar nullable.
- R2.2 — Árboles profundos con huecos: validar `assertNoCycle` y `assertLevel ordering`.

### 3.5 Complejidad
**Alta** — 10-15 días (incluye política de migración departamento→unidad).

---

## 4. Fase 3 — Ampliación del engine: 13 tipos de nodo faltantes

**Objetivo**: cubrir los 18 tipos del enunciado (`FORM`, `DOCUMENT_REVIEW`, `CORRECTION`, `EXAM_VALIDATION`, `APPROVAL`, `CONDITION`/`DECISION` ya hecho, `HIERARCHY_ASSIGNMENT`, `NOTIFICATION`, `TIMER`, `PHOTO_CAPTURE`, `CARD_PRODUCTION`, `CARD_DELIVERY`, `DOCUMENT_CUSTODY`, `TEMPORARY_PASS_CHECKOUT`, `TEMPORARY_PASS_RETURN`, `SUBFLOW`; quedan START/END ya).

### 4.1 Tareas por tipo de nodo

| Nodo | Tarea backend | Acción `runFromNode` |
|---|---|---|
| FORM | Nuevo `WorkflowNodeConfig.formData: {schemaRef}` | Crear `WorkflowTask(assignmentType=USER)` con `taskType='FORM'`. (Refactor: permitir `taskType`.) |
| DOCUMENT_REVIEW | `config.documents: {requiredDocumentTypes[]}` | Crear task que requiere `DocumentReview[]` completos para continuar. |
| CORRECTION | Ruta de edge `RETURN_FOR_CORRECTION` ya existe; promoverla a tipo de nodo dedicado para `usePreviousPhoto`. | `state='return'`. |
| EXAM_VALIDATION | `config.examTypes[]` + nueva entidad `ExamAttempt` | Validar que existe `ExamAttempt` vigente para el `subjectUserId`; si no, fallar. |
| APPROVAL | Casa con `HUMAN_TASK` con outcomes APPROVE/REJECT; crear nodo como alias con `config.requiredSignaturesBy: {level}` | Reutiliza `HIERARCHY_ASSIGNMENT` para resolver aprobador. |
| HIERARCHY_ASSIGNMENT | Depende de Fase 2 | Llama `HierarchyResolver.resolveApprover`. |
| NOTIFICATION | Inyecta `NotificationService` en engine; `config.channel: IN_APP|EMAIL|SMS` + `templateId` | Best-effort `notify.send(...)`. |
| TIMER | Requiere scheduler BullMQ / @nestjs/schedule | Programa `WorkflowInstance.timer("timeout")`; si no completa antes → edge `TIMEOUT_EDGE`. |
| PHOTO_CAPTURE | Crea task con `taskKind=PHOTO_CAPTURE`; valida MIME + face detect (opcional) | Modifica `User.photoUrl`. |
| CARD_PRODUCTION / CARD_DELIVERY | Inyecta `CredentialService`; `config.credentialsAction` | Llama `credentialService.transition(...)` correspondiente. |
| DOCUMENT_CUSTODY / TEMPORARY_PASS_CHECKOUT / RETURN | Inyecta nuevo `CustodyService` (Fase 5) | Crea/cierra `CustodyRecord`. |
| SUBFLOW | Permite anidar `WorkflowVersion` hijo | Reservado para Fase posterior — descomponer en runtime. |

### 4.2 Archivos afectados
- `apps/api/src/modules/workflows/domain/workflow-definition.types.ts:8` — ampliar `WORKFLOW_NODE_TYPES`.
- `apps/api/src/modules/workflows/domain/graph-validator.ts` — reglas por tipo (config requerido).
- `apps/api/src/modules/workflows/application/workflow-engine.service.ts:124` — `runFromNode` dispatch por tipo.
- `apps/api/src/modules/workflows/presentation/dto/workflow.dto.ts` — Swagger enum + DTOodenied config.

### 4.3 Migraciones
- **F3.M1** — `workflow_tasks` add column `taskType varchar(40) not null default 'HUMAN_TASK'`.
- **F3.M2** — New table `exam_attempts` (codificado como `RequestDocument` con `documentType='EXAM_AIT'` es viable a corto plazo para evitar nueva tabla — evaluar).

### 4.4 Pruebas
- Una spec por nuevo tipo de nodo (13 specs nuevas).
- Ampliar `graph-validator.spec.ts` con casos de config inválido por tipo.
- E2E por nodo crítico: `EXAM_VALIDATION`, `HIERARCHY_ASSIGNMENT`, `NOTIFICATION`, `CARD_PRODUCTION`.

### 4.5 Criterios binarios
- [ ] Cada tipo de nodo del enunciado tiene un `case` en `runFromNode` con test aprobado.
- [ ] `GraphValidator` rechaza grafos con un nuevo nodo mal configurado.
- [ ] `WorkflowNodeDto` Swagger enum refleja los 18 tipos.

### 4.6 Riesgos
- R3.1 — El MAX_AUTO_TRANSITIONS=25 puede timeoutear si un grafo tiene muchos SYSTEM seguidos. Mitigar con async/await por nodo.
- R3.2 — SLAs y TIMERS requieren cron externo; sin `@nestjs/schedule` configurado actualmente, hay que añadir.

### 4.7 Complejidad
**Alta** — 25-30 días distribuidos en 13 nodos. Recomendado paralelizar con Fase 5.

---

## 5. Fase 4 — Editor visual con `@xyflow/react`

**Objetivo**: paleta de nodos, drag&drop, panel de propiedades, validación, simulación, publicación, versionado y comparación.

### 5.1 Tareas exactas

**Setup**
- T4.1 — `apps/web/package.json`: añadir `@xyflow/react @^12` (anteriores `reactflow` v11 están deprecated).
- T4.2 — Crear ruta `apps/web/app/(app)/workflows/` con `page.tsx` (lista de definiciones), `[id]/page.tsx` (editor) y `[id]/versions/page.tsx` (diff).

**Paleta + DnD**
- T4.3 — Componente `components/workflows/NodePalette.tsx` con drag source por cada uno de los 18 tipos.
- T4.4 — `ReactFlow` canvas con `onConnect` validando tipos de edge.

**Panel de propiedades**
- T4.5 — `components/workflows/NodePropertiesPanel.tsx` — formulario condicional según `node.type` (RHF + Zod por tipo).

**Validación + Simulación**
- T4.6 — `POST /workflows/definitions/:id/versions/:vid/validate` (nuevo endpoint) que retorne `GraphValidator.errors`.
- T4.7 — `POST /workflows/definitions/:id/versions/:vid/simulate` (nuevo endpoint, requiere Fase 3 lista) — recebe input y devuelve el camino + tasks creados en memoria (rollback al final).

**Publicación + versionado + diff**
- T4.8 — Botón **Publicar** → `POST .../versions/:vid/publish` (existe).
- T4.9 — `versions-diff` extendido: comparar `definitionJson` de dos versiones y resaltar nodos/edges añadidos/eliminados (librería `jsondiffpatch` o diff custom).

**Runtime visualization**
- T4.10 — Vista de instancia activa (`/workflows/instances/:id`): highlight del nodo current (`WorkflowInstance.currentNodeKey`).

**Permisos**
- T4.11 — Ruta protegida por `workflows.manage` o `workflows.publish` (verificar role mapping en `apps/web/lib/role-mapping.ts`).

**Import/Export JSON**
- T4.12 — Subida/descarga de `definitionJson`.

### 5.2 Endpoints backend FALTANTES (crear)
- `POST /workflows/definitions/:id/versions/:vid/validate`
- `POST /workflows/definitions/:id/versions/:vid/simulate`
- `GET /workflows/definitions/:id/versions/compare?v1=&v2=`

### 5.3 Pruebas
- Test de snapshot del UI en estado vacío + grafo de 5 nodos.
- E2E: crear draft → añadir nodo → validar → publicar → activar → revertir.
- Accesibilidad WCAG 2.2 AA del editor (verificar skill `accessibility` si se gaat a certificar).

### 5.4 Criterios binarios
- [ ] Operador no técnico puede crear un flujo end-to-end desde la UI sin tocar código.
- [ ] Cualquier grafo inválido se rechaza antes de `publish` con mensaje claro.
- [ ] `POST /simulate` produce la persona correcta aprobadora para `HIERARCHY_ASSIGNMENT`.
- [ ] La versión utilizada por cada `Request` en curso se mantiene (Fase 1 + `WorkflowInstance.workflowVersionId`).

### 5.5 Riesgos
- R4.1 — `@xyflow/react` v12 tiene breaking changes vs sample docs. Verificar changelog antes de lock.
- R4.2 — Performance con grafos grandes: `reactflow` recomienda virtualization > 200 nodos.

### 5.6 Complejidad
**Muy alta** — 25-35 días. Depende de Fases 1-3 listas.

---

## 6. Fase 5 — Flujos especializados de carné

**Objetivo**: cerrar los sub-flujos marcados como MISSING/BROKEN en `SGA-FLOW-MATRIX.md` §6.

### 6.1 Tareas
- **Custodia**: crear `apps/api/src/modules/custody/` (nuevo módulo) con controller + service para `POST /credentials/:id/custody/deposit` y `POST /credentials/:id/custody/return`. UI `apps/web/app/(app)/issuance/custody/`.
- **Captura foto (WebRTC)**: añadir componente `<PhotoCapture>` (usar `navigator.mediaDevices.getUserMedia`) en `/issuance` y `/requests/new`.
- **Examen AIT**:
  - Migración: tabla `exam_attempts(id, userId, examType, status, passed, validUntil, certifiedBy)`.
  - Módulo `apps/api/src/modules/exams/` CRUD.
  - En el workflow node `EXAM_VALIDATION` (Fase 3) consumirlo.
- **Scheduler SLA**: añadir `@nestjs/schedule` con cron de revisión de `Credential.expiresAt` y `WorkflowTask.dueAt`.
- **Escolta obligatoria por zona**: regla de validación en `RequestService.create` que exija `participantRole='ESCORT'` si `accessArea.parentZoneCode='SECURITY_ZONE_ROJA'`.

### 6.2 Migraciones
- **F5.M1** — `create_custody_service_endpoints` (no nueva tabla: ya existe `CustodyRecord`).
- **F5.M2** — `create_exam_attempts` (nueva tabla).
- **F5.M3** — `add_escort_role` (RoleCode enum add `ESCORT`) — breaking, requiere careful migration.

### 6.3 Pruebas
- E2E por subflujo.
- Specs de reglas de validación (zona→escolta).

### 6.4 Criterios binarios
- [ ] Existe pantalla de depósito/retorno de custodia y persiste `CustodyRecord.depositTime` y `returnTime`.
- [ ] Examen AIT se valida automáticamente antes de `approve_final` si el workflow lo requiere.
- [ ] Cron dispara alerta 24h antes de `WorkflowTask.dueAt`.

### 6.5 Riesgos
- R5.1 — WebRTC requiere HTTPS y permisos browser; documentar requisitos despliegue.
- R5.2 — BREAKING: añadir `ESCORT` a RoleCode enum impacta seed y migrations existentes.

### 6.6 Complejidad
**Media-Alta** — 15-20 días.

---

## 7. Fases 6, 7, 8 — Servicio y Hardening (resumidas)

| Fase | Tareas clave | Migraciones | Criterio | Complejidad |
|---|---|---|---|---|
| F6 Notif. multi-canal + SLA | Adapter Email (nodemailer), SMS, Scheduler BullMQ; `Notification.channel/sentAt/status` | `notif_v2` (add columns) | Email de prueba llega; SLA dispara | Media |
| F7 Audit transversal + reportes | Inyectar `AuditService` en todos los services; endpoint `/audit/reports.csv`; retention job | `audit_retention` (add `retentionUntil`) | AuditEvent presente tras cada mutate; CSV exporta | Media |
| F8 Endurecimiento + e2e + deploy | Domain errors consistency (cambiar `throw new Error` → `BusinessRuleError`); JWT revocation check; e2e Playwright suite; Docker prod manifests | — | 0 harness `throw new Error` no-guardado; e2e suite verde; deploy cloud-ready | Alta |

---

## 8. Orden recomendado de implementación

> Orden acordado con el usuario el **31/07/2026** (reemplaza los diagramas de dependencias históricos).

```
F1 (Bridge) ──✅ DONE──▶ F2 (Emisión y custodia temporal)
                              │
                              ▼
                        F3 (Alertas y notificaciones)
                              │
                              ▼
                        F4 (Auditoría, reportes, visibilidad operativa)
                              │
                              ▼
                        F5 (Endurecimiento interno)
                              │
                              ▼
                        EXT (Integraciones externas: Intelesis / RH Amaxonia / Honeywell Pro-Watch / Exámenes / HW físico)
```

**Backlog / diferidos** (re-evaluable, NO en la línea principal):
- Modelo jerárquico organizacional
- Editor visual @xyflow/react (scaffold existe en `/workflows/[id]/editor`)
- 13 tipos de nodo avanzados del engine

**Camino crítico actual:** `F2 → F5` completo, luego EXT según disponibilidad de contratos externos.

---

## 9. Estimación de complejidad y riesgos consolidados

| Fase | Días estimados | Probabilidad de retraso | Riesgo top |
|---|---|---|---|
| F1 | 5-8 | Baja | Doble state machine |
| F2 | 10-15 | Media | Migración `User.department` legacy |
| F3 | 25-30 | Alta | TIMERS requieren scheduler nuevo |
| F4 | 25-35 | Alta | Depende de F1+F3+Fase 2 |
| F5 | 15-20 | Media | BREAKING enum RoleCode |
| F6 | 8-12 | Baja | SMTP rechazos invisibles |
| F7 | 5-8 | Baja | |
| F8 | 15-25 | Media | E2E Playwright setup |
| **Total** | **108-153 días** ≈ 5-7 meses | | |

---

## 10. Primera fase recomendada (reiterada)

> ✅ **Fase 1 — Bridge engine ↔ Request lifecycle** está CERRADA (31/07/2026, cierre riguroso, ver `docs/implementation/phases/SGA-PHASE-01-WORKFLOW-BRIDGE.md`).
>
> **Siguiente fase (vigente desde 31/07/2026): FASE 2 — Emisión y custodia temporal** (no el modelo jerárquico organizacional como decía la versión original de este documento). Sin ejecución automática del `WorkflowInstance` al `submit` de una `Request` — hoy confirmado con FASE 1 cerrada — el engine configurable queda utilizable desde el producto completo. La fase de Emisión y custodia temporal es el siguiente cuello de botella: cierra el ciclo **CARNÉ 1-3** (foto, examen, custodia, pase temporal, entrega) dejando el backbone de credentials end-to-end operativo.

---

## 11. Apéndice — fuentes citadas

- `SGA-CURRENT-STATE.md` (este folder, §0-§10)
- `SGA-FLOW-MATRIX.md` (este folder, §1-§7)
- `docs/audits/SGA_REQUIREMENTS_TRACEABILITY.md` (matriz de flujos previa, parcialmente obsoleta respecto a `people` module)
- `docs/audits/SGA_GAP_MATRIX.md` (GAP-05/06)
- `apps/api/prisma/schema.prisma` (líneas citadas inline)
- `apps/api/prisma/seed.ts:452,491` (semillas de workflows)
- `apps/api/src/modules/workflows/application/workflow-engine.service.ts:50,124,311` (motor actual)
- `apps/api/src/modules/requests/application/request.service.ts` (punto de inserción F1)
- `apps/web/package.json` (confirmación: xyflow AUSENTE)
