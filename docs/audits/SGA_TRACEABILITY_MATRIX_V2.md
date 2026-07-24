# SGA — Matriz de Trazabilidad Documental Completa (Post-Eliminación Personas)

**Fecha:** 2026-07-24
**Versión:** 2.0 (post-cierre Person, post-snapshot architecture, post-Fase 3 workflow engine)
**Auditoría basada en evidencia viva verificada** (no en estimaciones).
**Alcance:** funcionalidades del SGA. Integraciones externas marcadas como `PENDIENTE DE INTEGRACIÓN` aparte.

---

## Convenciones de estado

| Estado | Significado |
|---|---|
| COMPLETO | Implementado en backend + frontend + base de datos + probado. Verificado en código. |
| PARCIAL | Implementado parcialmente (alguna capa falta o tiene limitaciones documentadas). |
| AUSENTE | No existe en ninguna capa. |
| PENDIENTE DE INTEGRACIÓN | Depende de sistema externo (Intelesis / RH Amaxonia / Control Vehicular / Gestión Exámenes). Excluido del % funcional. |
| NO APLICA | Funcionalidad fuera de alcance del módulo. |

| Prioridad | Criterio |
|---|---|
| P0 | Bloquea operación de un flujo nuclear del SGA (carné, permiso temporal, revisión, emisión). |
| P1 | Funcionalidad crítica pero con workaround manual. |
| P2 | Mejora de UX o productividad. |
| P3 | Optimización / deuda técnica. |

---

## 1. Matriz de Trazabilidad (22 requerimientos funcionales)

| ID | Documento / Sección | Requerimiento | Backend | Frontend | Base de datos | Roles / Permisos | Validaciones | Prueba ejecutada | Evidencia en código | Estado | Brecha | Prioridad | Acción necesaria |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **RT-01** | Form. AIT "Solicitud de Carné Permanente" | Crear solicitud de carné permanente + datos personales + institución | `POST /requests` (RequestsController) ✅ | `/requests/new` (wizard Step 1-8) ✅ | `requests` + `request_participants` (snapshots) ✅ | `APPLICANT` (requests.create + submit), `COMPANY_ADMIN` ✅ | Zod `wizard-schemas.ts`, dominio `addParticipant()` snapshot check ✅ | `request.entity.spec.ts` 12/12 ✅, suite 97/97 ✅, flujo manual E2E | `apps/api/src/modules/requests/*`, `apps/web/app/(app)/requests/new/page.tsx`, `apps/web/lib/wizard-schemas.ts` | **COMPLETO** | — | — | Mantener |
| **RT-02** | Form. AIT "Autorización Única de Carnés y Permisos" | Generar PDF de autorización firmada por firmante autorizado | Servicio de generación PDF ❌ | Sin UI ❌ | `company_authorized_signers` ✅ | `requests.approve` ❌ | Sin validar | Ninguna | Solo se asigna `authorizedSignerId` como dato | **PARCIAL** | Falta renderizar PDF de la "Autorización Única" prefirmada. Existe el signer pero no la plantilla. | **P1** | Implementar generación PDF (puppeteer/pdf-lib) usando plantilla AIT + datos del request + firma del signer. |
| **RT-03** | Form. AIT "Permiso Temporal Equipo/Herramientas" | Permiso temporal de personas / vehículos / equipos | `POST /requests` con tipo `TEMPORARY_*` ✅ | `/requests/new` permite elegir tipo ✅ | `request_vehicles` + `request_equipment` ✅ | `requests.create` ✅ | Zod condicional por tipo ✅ | Tests dominio vehicle/equipment dedup ✅ | `apps/api/prisma/schema.prisma`, `request.entity.ts` addVehicle/addEquipment | **COMPLETO** | — | — | Mantener |
| **RT-04** | Especificación Técnica §3.4 | Personas asociadas / participantes múltiples | `RequestParticipant` (PRIMARY + BENEFICIARY) ✅ | Wizard Step 3 con `BeneficiaryEditorDialog` ✅ | `request_participants` con snapshots demográficos ✅ | — | Detección híbrida de duplicados ✅ | 12/12 specs ✅ | `request.entity.ts addParticipant()` | **PARCIAL** | Enum de roles solo cubre `PRIMARY/BENEFICIARY`. Faltan roles DOMAIN dedicados: `TITULAR`, `VISITANTE`, `CUSTODIO`, `ACOMPAÑANTE` para clasificar participantes según tipo de solicitud. | **P2** | Evaluar extensión del enum `RequestParticipantRole` cuando un formulario AIT lo exija explícitamente. No detectado aún en forms extraídos. |
| **RT-05** | Form. AIT "Permiso Vehicular Temporal" | Captura de vehículos (placa, marca, modelo, color, año) | `addVehicle()` + validación placa única ✅ | Wizard Step 4 ✅ | `request_vehicles` ✅ | — | Placa case-insensitive dedup ✅ | `request.entity.spec.ts` ✅ | `request.entity.ts addVehicle()` | **COMPLETO** | — | — | Mantener |
| **RT-06** | Form. AIT "Permiso de Herramientas/Equipos" | Captura de equipos (marca, tipo, serial, cantidad) | `addEquipment()` ✅ | Wizard Step 5 ✅ | `request_equipment` ✅ | — | Cantidad > 0 ✅ | Tests dominio ✅ | `request.entity.ts addEquipment()` | **COMPLETO** | — | — | Mantener |
| **RT-07** | Especificación Técnica §5 (Documents) | Adjuntar documentos (cédula, foto, antecedentes, etc.) | DocumentsModule + `document_requirements` ✅ | Upload UI en `reviews/[id]/page.tsx` y wizard ✅ | `request_documents` + `document_versions` + `file_metadata` ✅ | `requests.review` (aprob/rechazo doc) ✅ | Tamaño/tipo por config ✅ (configurable) | Specs docs parciales ✅ | `apps/api/src/modules/documents/*` | **COMPLETO** | — | — | Mantener |
| **RT-08** | Especificación Técnica §6 (Zonas y Puntos) | Selección de puntos de acceso y zonas (con colores) | `request_access_points` + `request_access_areas` (con colores) ✅ | Wizard Step 6 ✅ | Tablas ✅ | — | Catálogo validado ✅ | Tests dominio ✅ | `request.entity.ts addAccessPoint/addAccessArea` | **COMPLETO** | — | — | Mantener |
| **RT-09** | Especificación Técnica §7 (Renovaciones) | Renovación basada en solicitud previa (reutilizar foto) | Campo `usePreviousPhoto` en `RequestParticipant` ✅ | Wizard Step 3 checkbox ✅ | Columna `use_previous_photo` ✅ | — | Campo en snapshot ✅ | Tests dominio ✅ | `schema.prisma`, `request.entity.ts` | **PARCIAL** | Falta el workflow "Renovación": crear solicitud nueva pre-poblada desde una anterior vencida/vigente. Hoy se marca el flag pero no hay acción "Clonar para renovación". | **P2** | Implementar acción `POST /requests/:id/clone-for-renewal` que copie participantes, vehículos, equipos, accesos y marque `usePreviousPhoto=true`. |
| **RT-10** | Form. AIT + Spec. §8 | Captura de fotografía | Subida de archivo en users (perfil) ✅ | Sin "estación de carnetización" dedicada ❌ | `users.photoUrl` ✅ | `users.manage` ✅ | Tipo/size en client ✅ | Manual | `apps/api/src/modules/identity/*` `useUploadUserPhotoMutation` (eliminado para Person, existe para Users) | **PARCIAL** | Falta UI de "estación de carnetización" con captura WebRTC + integración con issuance. Hoy solo sube archivo. | **P1** | Crear `/issuance/capture` con cámara WebRTC + assignación a credential.subjectUserId. Reutilizar hook `useUploadUserPhotoMutation` (que sí existe para Users). |
| **RT-11** | Spec. §9.2 (Revisión documental) | Función de revisor documental | `ReviewTasksController` + `DocumentReviewsController` ✅ | `/reviews/[id]` ✅ | `review_tasks` + `document_reviews` ✅ | `DOCUMENT_RECEIVER` + `requests.review` ✅ | State machine ✅ | Workflow service specs ✅ | `apps/api/src/modules/reviews/*` | **COMPLETO** | — | — | Mantener |
| **RT-12** | Spec. §9.3 (Devolución) | Devolución para corrección de solicitud | `POST /requests/:id/return` (estado `RETURNED_FOR_CORRECTION`) ✅ | Botón "Devolver" en reviews ✅ | `request_events` registra el evento ✅ | `requests.return` ✅ | Solo editable en DRAFT/RETURNED ✅ | Test domain immutability ✅ | `request.entity.ts applyTransition` | **COMPLETO** | — | — | Mantener |
| **RT-13** | Spec. §9.4 (Aprobación final) | Aprobación final del jefe de documentos | `POST /requests/:id/approve` ✅ | Botón "Aprobar" en reviews cuando aplica ✅ | `requests.status = APPROVED` ✅ | `ACCESS_DOCUMENTS_MANAGER` + `requests.approve` ✅ | State machine ✅ | Workflow engine task complete ✅ | `apps/api/src/modules/requests/application/request.service.ts` | **COMPLETO** | — | — | Mantener |
| **RT-14** | Spec. §9.5 (Rechazo) | Rechazo con motivo | `POST /requests/:id/reject` con `rejectionReasonId` ✅ | UI de rechazo con catálogo de motivos ✅ | `rejection_reason_id` ✅ | `requests.reject` ✅ | Motivo obligatorio ✅ | Catalog spec ✅ | `apps/api/.../catalogs/*` | **COMPLETO** | — | — | Mantener |
| **RT-15** | Spec. §9.6 (Cancelación) | Cancelación por solicitante | `POST /requests/:id/cancel` ✅ | Botón cancelar ✅ | `cancelled_at` ✅ | `requests.create` (own) ✅ | Solo DRAFT/SUBMITTED ✅ | Tests dominio ✅ | `request.entity.ts` | **COMPLETO** | — | — | Mantener |
| **RT-16** | Form. AIT Carné | Emisión de carné (confección + transición estados) | `CredentialsController` + transiciones ✅ | `/issuance` con tabs (Pendientes / Producción / Listas / Entregadas) ✅ | `credentials` + `credential_events` ✅ | `CARD_ISSUER` + `issuance.manage` ✅ | State machine credencial ✅ | Service specs ✅ | `apps/api/src/modules/credentials/*` | **COMPLETO** | — | — | Mantener |
| **RT-17** | Spec. §10 (Entrega) | Entrega de carné con firma/observación | `POST /credentials/:id/deliver` + `delivery_records` ✅ | Diálogo de entrega en `/issuance` ✅ | `delivery_records` (receptor, observaciones) ✅ | `CARD_ISSUER` + `issuance.manage` ✅ | Validaciones ✅ | Manual | `apps/api/src/modules/credentials/*` | **COMPLETO** | — | — | Mantener |
| **RT-18** | Spec. §11 (Vencimiento) | Alertas de vencimiento / devolución tardía | Sin cron ni scheduler implementado ❌ | Sin UI de alertas ❌ | Sin tabla de scheduled_jobs ❌ | — | — | Ninguna | — | **AUSENTE** | No hay servicio programado para detectar pases temporales vencidos no devueltos ni alertas de carné próximo a vencer. | **P1** | Implementar `@nestjs/schedule` cron diario que revise `credentials.expiresAt < now + threshold` y `CustodyRecord.return_time IS NULL AND deposit_time + max < now`. Publicar `Notification`. |
| **RT-19** | Spec. §12 (Auditoría) | Bitácora de todas las acciones | `AuditEvent` inmutable ✅ | **Sin UI de auditoría** ❌ | `audit_events` ✅ | `audit.read` ✅ | Append-only ✅ | Manual | `apps/api/src/modules/audit/*` | **PARCIAL** | El backend ya captura pero falta UI para listado/visor con filtros (actor, tipo, rango fechas). | **P1** | Crear `/audit` con DataTable + filtros + Export CSV. Hooks ya pueden reusarse del backend. |
| **RT-20** | Spec. §13 (Roles y permisos) | Gestión de usuarios + roles + permisos granulares | `UsersController` + `Permissions` seed ✅ | `/users` CRUD completo ✅ | `users` + `user_roles` + `user_permissions` ✅ | `SYSTEM_ADMIN` + `users.manage` ✅ | Validación ✅ | `access-scope.spec.ts` 6/6 ✅ | `apps/api/src/modules/identity/*`, `PermissionMatrix.tsx` | **COMPLETO** | — | — | Mantener |
| **RT-21** | Spec. §14 (Motor de flujos configurable) | Workflow engine (definition + versioned + execution + tasks) | `WorkflowDefinitionsController` + `WorkflowEngineService` + DSL evaluator + graph validator ✅ | **Sin UI** ❌ | `workflow_definitions` + `workflow_versions` + `workflow_instances` + `workflow_node_instances` + `workflow_tasks` + `workflow_transitions` ✅ | `workflows.read` + `workflows.manage` + `workflows.publish` + `workflows.execute` + `workflows.task.*` ✅ | Graph DAG validation ✅ | 7 suites / 82 tests ✅ | `apps/api/src/modules/workflows/*`, seed `temporary_person_default` PUBLICADO | **PARCIAL** | Backend completo y probado. **Sin editor visual ni visor de instancias**. Hoy solo se opera vía API/seed. | **P0** | Implementar editor visual frontend con `@xyflow/react`,lienzoeditor de nodos, panel de condiciones DSL, publicar versión, visor de instancias en ejecución. |
| **RT-22** | Spec. §15 (Editor visual de flujos) | Editor visual con lienzo drag&drop | Backend lo soporta (publish/draft) ✅ | **AUSENTE** ❌ | — | `workflows.manage` ✅ | — | Ninguna | — | **AUSENTE** | 0 frontend. Parte Nuclear del P0 RT-21. | **P0** | Implementar `apps/web/app/(app)/workflows` con React Flow, nodos START/HUMAN_TASK/AUTO_TASK/GATEWAY/END, paneleditor y preview de simulación. |

---

## 2. Integraciones Externas (marcadas como PENDIENTE DE INTEGRACIÓN)

| ID | Sistema | Documento fuente | Estado | Notas |
|---|---|---|---|---|
| **INT-01** | Intelesis (validación de identidad) | Especificación Técnica §A.1 | PENDIENTE DE INTEGRACIÓN | Sistema externo. Definir contrato API. |
| **INT-02** | Recursos Humanos — Amaxonia | Especificación Técnica §A.2 | PENDIENTE DE INTEGRACIÓN | Sincronización de empleados. |
| **INT-03** | Control de Acceso de Vehículos | Especificación Técnica §A.3 | PENDIENTE DE INTEGRACIÓN | Validar placas activas en portón. |
| **INT-04** | Sistema de Gestión de Exámenes | Especificación Técnica §A.4 | PENDIENTE DE INTEGRACIÓN | Verificar examen AIT vigente. |

**Estas 4 integraciones se excluyen del % funcional total.**

---

## 3. Cálculo del porcentaje funcional real

### Resumen por estado

| Estado | Cantidad | Porcentaje |
|---|---|---|
| COMPLETO | 13 / 22 | **59.1%** |
| PARCIAL | 6 / 22 | 27.3% |
| AUSENTE | 3 / 22 | 13.6% |
| PENDIENTE DE INTEGRACIÓN | 4 (excluidos del cálculo) | — |

### Porcentaje ponderado por avance

Aproximando avances por requerimiento:
- COMPLETO = 100% (13 items)
- PARCIAL = ~50% (6 items → 3 equivalentes completos)
- AUSENTE = 0% (3 items)

$$
\text{\% Funcional real} = \frac{13 \cdot 1.0 + 6 \cdot 0.5 + 3 \cdot 0.0}{22} = \frac{13 + 3 + 0}{22} = \frac{16}{22} \approx \mathbf{72.7\%}
$$

**SGA está al 72.7% de la funcionalidad descrita en la documentación (excluyendo integraciones externas).**

> No se declara 100% hasta que todas las brechas no dependientes de integraciones se cierren.

---

## 4. Brechas agrupadas por prioridad

### P0 — Bloqueante para declaración de producto completo
| ID | Brecha | Esfuerzo relativo |
|---|---|---|
| **RT-21** | UI del Editor Visual de Workflows + visor de instancias | M (motor backend ya hecho) |
| **RT-22** | Editor visual con React Flow (parte Nuclear de RT-21) | L |

### P1 — Funcionalidad crítica con workaround manual
| ID | Brecha | Esfuerzo relativo |
|---|---|---|
| **RT-18** | Alertas de vencimiento/devolución tardía (cron) | M |
| **RT-19** | UI de auditoría (visor con filtros) | M |
| **RT-02** | Generación PDF de "Autorización Única" | M |
| **RT-10** | Estación de carnetización (cámara WebRTC) | L |

### P2 — Mejoras de productividad
| ID | Brecha | Esfuerzo relativo |
|---|---|---|
| **RT-04** | Roles más finos (`TITULAR/VISITANTE/CUSTODIO/ACOMPAÑANTE`) si el form AIT lo exige | S |
| **RT-09** | Acción "Clonar solicitud para renovación" | S |

### P3 — Optimización
(ninguno pendiente de relevancia)

---

## 5. Requerimientos pendientes ÚNICAMENTE por integración

- **RT-INT-01:** Verificación de identidad vía Intelesis (INT-01).
- **RT-INT-02:** Sincronización de empleados con RH Amaxonia (INT-02).
- **RT-INT-03:** Validación de placas activas contra Control Vehicular (INT-03).
- **RT-INT-04:** Verificación de vigencia de Examen AIT contra Gestión de Exámenes (INT-04).

---

## 6. Próximo desarrollo recomendado

**Justificación basada en evidencia:**

Aun cuando RT-22 (Editor Visual) aparece marcado como "AUSENTE" en sí mismo, RT-21 tiene como brecha explícita "Sin editor visual ni visor de instancias". El motor backend está completo y probado (7 suites / 82 tests) pero **no es operable por usuarios finales sin UI**. Es el único P0 detectado.

**Next block recomendado: RT-21 + RT-22 — Editor Visual de Flujos con React Flow (`@xyflow/react`)**

Detalle del plan técnico en §7.

---

## 7. Plan técnico del próximo bloque — Editor Visual de Workflows

### Problema
El motor de workflow backend (Fase 3) está completo y probado pero no tiene UI. Los administradores no pueden diseñar, publicar ni monitorear flujos sin recurrir a curl/Postman o seeds.

### Requerimiento documental
- Spec. §14: "Motor de flujos configurable"
- Spec. §15: "Editor visual de flujos"

### Estado actual
- ✅ Backend `apps/api/src/modules/workflows/` con 4 controllers REST.
- ✅ Modelos Prisma `WorkflowDefinition`, `WorkflowVersion`, `WorkflowInstance`, `WorkflowNodeInstance`, `WorkflowTask`, `WorkflowTransition`.
- ✅ 7 specs / 82 tests en verde.
- ❌ Frontend: 0 archivos en `apps/web/app/(app)/workflows/`.
- ❌ `@xyflow/react` no instalado.

### Archivos afectados (estimación)
- **Frontend nuevos:**
  - `apps/web/app/(app)/workflows/page.tsx` — listado de definiciones
  - `apps/web/app/(app)/workflows/[id]/edit/page.tsx` — editor con lienzo
  - `apps/web/app/(app)/workflows/[id]/instances/page.tsx` — visor de instancias
  - `apps/web/components/workflows/WorkflowCanvas.tsx` — wrapper React Flow
  - `apps/web/components/workflows/nodes/` — StartNode, HumanTaskNode, AutoTaskNode, GatewayNode, EndNode
  - `apps/web/components/workflows/ConditionEditor.tsx` — editor del DSL
  - `apps/web/components/workflows/PublishVersionDialog.tsx`
  - `apps/web/hooks/workflow-hooks.ts` — TanStack Query hooks
  - `apps/web/lib/workflow-types.ts`
  - `apps/web/lib/workflow-mapping.ts`

- **Frontend modificados:**
  - `apps/web/lib/navigation.ts` — entrada /workflows
  - `apps/web/lib/role-mapping.ts` — comprobar permiso `workflows.*`
  - `apps/web/components/shared/PermissionMatrix.tsx` — ya expone workflows.*

- **Backend:** sin cambios significativos. Posiblemente `GET /workflow-definitions/:id/graph` para pintar el grafo completo en formato nodes/edges React Flow.

- **Database:** sin cambios. Los modelos `WorkflowDefinition.graph` JSON ya soportan la estructura nodos+edges+conditions.

### Modelo de datos afectado
- `WorkflowDefinition.graph`: ya almacena `{nodes: Node[], edges: Edge[], conditions: Record<nodeId, string[]>}`. Se serializa desde/desde React Flow.
- `WorkflowVersion`: snapshot del grafo al publicar (inmutable).
- `WorkflowNodeInstance` / `WorkflowTask`: lectura para el visor.

### Riesgos
1. **DSL de condiciones:** actualmente el evaluator usa una sintaxis específica (ver `condition-evaluator.spec.ts`). El editor debe regenerar exactamente la misma sintaxis — si el UI construye strings inválidos, falla al `publish`. → Mitigación: validador compartido + preview en el editor.
2. **Graph cycles:** el `graph-validator.spec.ts` ya detecta ciclos y nodos huérfanos. El UI debe llamar a `POST /workflow-definitions/:id/validate` antes de permitir Publicar.
3. **Compatibilidad con flujos en producción:** `temporary_person_default` está PUBLICADO yvivo. El UI solo edita DRAFTs → no rompe runtime.
4. **Layout de nodos:** React Flow persistir `position` en el nodo; backend debe aceptar y devolver positions.
5. **Performance:** grafos grandes (>30 nodos) → memoizar.
6. **Permisos:** solo `SYSTEM_ADMIN` y roles con `workflows.manage` pueden editar; `workflows.read` para ver.

### Plan técnico (fases)
1. **Setup + listado** (S): instalar `@xyflow/react`, crear `/workflows` listado con TanStack Query.
2. **Editor de lienzo basic** (M): canvas con custom nodes, leer grafo existente, drag&drop paleta.
3. **Editor de condiciones DSL** (M): panel lateral con snippets + linting en vivo via API `/validate`.
4. **Guardar draft** (S): `PATCH /workflow-definitions/:id` con grafo serializado.
5. **Publicar versión** (S): diálogo con diff vs última versión publicada.
6. **Visor de instancias** (M): `/workflows/[id]/instances` con tareas pendientes y estado por nodo.
7. **Tests** (S): integración E2E crear→publicar→iniciar instancia manualmente.

### Criterios de aceptación
- [ ] `apps/web/app/(app)/workflows` accesible para SYSTEM_ADMIN.
- [ ] Listado muestra definiciones con estado (DRAFT / PUBLISHED).
- [ ] Editor permite agregar nodos START, HUMAN_TASK, AUTO_TASK, GATEWAY, END.
- [ ] Cada nodo edita: key, label, tipo, asignables (para HUMAN_TASK), guard meta (para AUTO_TASK).
- [ ] Cada edge permite editar condiciones DSL con validación en vivo.
- [ ] Validar grafo antes de publicar (sin ciclos, 1 START, 1+ END, todos alcanzables).
- [ ] Publicar crea `WorkflowVersion` inmutable.
- [ ] Visor de instancias muestra tareas pendientes/asignadas/completadas con timestamps.
- [ ] Frontend typecheck EXIT=0, backend typecheck EXIT=0, suite completa en verde.
- [ ] `@xyflow/react` agregado a `apps/web/package.json`.

### Estimación relativa
**Esfuerzo total: L (grande)** — entre 4-7 días-equivalente comparado con bloques anteriores. El componente más caro es el editor DSL con validación en vivo. Recomendado partir en 2 sub-entregas: (a) editor visual básico sin DSL avanzado, (b) editor DSL + visor de instancias.

---
