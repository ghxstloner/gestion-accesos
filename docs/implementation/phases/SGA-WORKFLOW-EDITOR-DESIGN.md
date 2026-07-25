# SGA — Diagnóstico de Contratos Backend + Diseño Técnico del Editor Visual

**Fecha:** 2026-07-24
**Versión:** 1.0
**Bloque:** FASE 1 (FASE 0 git commit `a2c75bb` ya aplicado)
**Decisión:** No reescribir el motor. dispro; implementar frontend a contratos existentes.

---

## 1. Contratos backend encontrados — Matriz de operaciones

> Fuente de verdad: `apps/api/src/modules/workflows/`. Todos los endpoints requieren Bearer JWT (`Authorization: Bearer <token>`); cada uno tiene un segundo gate `@RequirePermissions(...)`.

### 1.1 Operaciones de WorkflowDefinition

| Operación | Endpoint | Método | DTO entrada | Respuesta | Permiso requerido | Disponible | Cambio backend necesario |
|---|---|---|---|---|---|---|---|
| Listar workflows | `/api/v1/workflows/definitions?status&requestType&key&search&page&pageSize` | GET | query params | `{items:[WorkflowDefinitionResponseDto], total, page, pageSize}` | `workflows.read` | ✅ SÍ | NO |
| Consultar workflow | `/api/v1/workflows/definitions/:id` | GET | — | `WorkflowDefinitionResponseDto` | `workflows.read` | ✅ SÍ | NO |
| Crear workflow | `/api/v1/workflows/definitions` | POST | `CreateWorkflowDefinitionDto` | `WorkflowDefinitionResponseDto` | `workflows.manage` | ✅ SÍ | NO |
| Editar metadata (nombre/desc) | `/api/v1/workflows/definitions/:id` | PATCH | `UpdateWorkflowDefinitionDto` | `WorkflowDefinitionResponseDto` | `workflows.manage` | ✅ SÍ | NO |
| Activar/Desactivar workflow | `/api/v1/workflows/definitions/:id/retire` | POST | — | `WorkflowDefinitionResponseDto` | `workflows.publish` | ✅ SÍ (retire) | NO |
| Eliminar workflow (solo DRAFT) | `/api/v1/workflows/definitions/:id` | DELETE | — | `void` 204 | `workflows.manage` | ✅ SÍ | NO |

### 1.2 Operaciones de WorkflowVersion (nodos + conexiones viven aquí)

| Operación | Endpoint | Método | DTO entrada | Respuesta | Permiso requerido | Disponible | Cambio backend necesario |
|---|---|---|---|---|---|---|---|
| Listar versiones | `/api/v1/workflows/definitions/:definitionId/versions?page&pageSize` | GET | query | `{items:[WorkflowVersionResponseDto]}` | `workflows.read` | ✅ SÍ | NO |
| Consultar versión | `/api/v1/workflows/definitions/:definitionId/versions/:versionId` | GET | — | `WorkflowVersionResponseDto` | `workflows.read` | ✅ SÍ | NO |
| Crear/Editar versión borrador | `/api/v1/workflows/definitions/:definitionId/versions` | POST | `CreateWorkflowVersionDto` (`definitionJson: WorkflowGraphDto`) | `WorkflowVersionResponseDto` | `workflows.manage` | ✅ SÍ | NO |
| Guardar nodos+conexiones | `/api/v1/workflows/definitions/:definitionId/versions/:versionId` | PATCH | `UpdateWorkflowVersionDto` | `WorkflowVersionResponseDto` | `workflows.manage` | ✅ SÍ | NO |
| Validar definición | (implícito en PATCH/publish) | — | — | `ValidationError` HTTP 422 con array de strings | `workflows.manage` | ✅ SÍ | NO (validación empotrada en `WorkflowVersion.updateGraph` + `publish`) |
| Publicar versión | `/api/v1/workflows/definitions/:definitionId/versions/:versionId/publish` | POST | — | `WorkflowVersionResponseDto` | **`workflows.publish`** (solo SYSTEM_ADMIN) | ✅ SÍ | NO |
| Consultar versión publicada | `GET /definitions/:id/versions?status=PUBLISHED&page=1&pageSize=1` o `findPublishedForRequestType` interno | GET | — | `WorkflowVersionResponseDto` o `null` | `workflows.read` | ✅ SÍ (transitivo) | NO |
| Retirar versión | `/api/v1/workflows/definitions/:definitionId/versions/:versionId/retire` | POST | — | `WorkflowVersionResponseDto` | `workflows.publish` | ✅ SÍ | NO |

> **No existe un endpoint dedicado de validación previa** — la validación se ejecuta dentro de PATCH (updateGraph) y publish. El frontend debe replicar las 12 reglas en cliente para UX y tratar los errores 422 del backend como fuente final de verdad.

---

## 2. Tipos de datos canónicos (decisión de diseño)

El frontend debe usar **tipos estrictos derivados del dominio**, NO los DTOs sueltos (`Record<string, unknown>`). Definiremos en `apps/web/lib/workflow-types.ts`:

```typescript
export type WorkflowNodeType = 'START'|'END'|'HUMAN_TASK'|'SYSTEM'|'DECISION';
export type HumanTaskOutcome = 'APPROVE'|'REJECT'|'RETURN_FOR_CORRECTION'|'RESUBMIT'|'CANCEL'|'COMPLETE';
export type SystemAction = 'UPDATE_REQUEST_STATUS'|'NOOP';
export type WorkflowStatus = 'DRAFT'|'PUBLISHED'|'RETIRED';
export type AssignmentType = 'ROLE'|'USER';

export interface WorkflowAssignment {
  type: AssignmentType;
  roleCode?: string;
  userId?: string;
  companyScoped?: boolean;
}

export interface WorkflowNodeConfig {
  outcomes?: HumanTaskOutcome[];
  systemAction?: SystemAction;
  targetRequestStatus?: string;
  allowReturnCycle?: boolean;
}

export interface WorkflowNode {
  key: string;
  type: WorkflowNodeType;
  name: string;
  description?: string;
  assignment?: WorkflowAssignment;
  config?: WorkflowNodeConfig;
}

export type ConditionExpression =
  | { op: 'AND'|'OR'; conditions: ConditionExpression[] }
  | { op: 'NOT'; condition: ConditionExpression }
  | { field: string; operator: AtomicConditionOperator; value?: unknown };

export type AtomicConditionOperator =
  | 'EQUALS' | 'NOT_EQUALS' | 'IN' | 'NOT_IN'
  | 'GREATER_THAN' | 'GREATER_THAN_OR_EQUAL'
  | 'LESS_THAN' | 'LESS_THAN_OR_EQUAL'
  | 'EXISTS' | 'NOT_EXISTS';

export interface WorkflowEdge {
  key?: string;            // opcional: calculado `${from}__${to}__${action}`
  from: string;
  to: string;
  action: string;
  condition?: ConditionExpression;
  priority?: number;       // default 0; mayor gana
}

export interface WorkflowGraphLayout {
  [nodeKey: string]: { x: number; y: number };
}

export interface WorkflowGraph {
  schemaVersion: 1;        // constante WORKFLOW_SCHEMA_VERSION
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  metadata?: {
    layout?: WorkflowGraphLayout;     // ⭐ aquí persistimos X/Y de React Flow
    description?: string;
  };
}
```

### 2.1 Mapeo React Flow ↔ SGA

| React Flow | SGA WorkflowGraph | Notas |
|---|---|---|
| `node.id` | `node.key` | identidad |
| `node.position` `{x,y}` | `graph.metadata.layout[nodeKey]` | **coordenadas persistidas en metadata** (validador lo ignora) |
| `node.type` (custom) | `node.type` (`start`/`end`/`human_task`/`system`/`decision`) | mapeo lowercase a nombre de componente registered |
| `node.data` | todo lo demás (`name`, `description`, `assignment`, `config`) | inyectado como `data: WorkflowNode` |
| `edge.id` | `${from}__${to}__${action}` (calculado) | soporta múltiples edges entre el mismo par |
| `edge.source`/`target` | `edge.from`/`edge.to` | |
| `edge.label` | `edge.action` (+ icono si `condition` presente) | |
| `edge.data` | `{condition?, priority?}` | panel lateral edita |

### 2.2 Operaciones aplicadas por tipo de nodo (reglas `action` válidas)

| Tipo nodo | Acciones válidas en edges salientes |
|---|---|
| `START` | `BEGIN` (una sola) |
| `SYSTEM` | `COMPLETE` (una sola) |
| `DECISION` | `EVALUATE` (+ condition + priority) |
| `HUMAN_TASK` | uno de `config.outcomes` (APPROVE/REJECT/RETURN_FOR_CORRECTION/RESUBMIT/CANCEL/COMPLETE) |
| `END` | ninguna (0 salientes) |

---

## 3. Cambios backend necesarios — Evaluación honesta

### 3.1 NO NECESARIO para MVP
- ❌ Endpoint de validación previa (`POST /definitions/:id/validate`) — no existe, pero la UI puede replicar las 12 reglas en cliente y usar los errores 422 del PATCH para el feedback final.
- ❌ Exponer `WorkflowNodeInstance[]` / `WorkflowTransition[]` vía API — esos son para el **visor de instancias en ejecución** (no requerido en este MVP del editor).
- ❌ Añadir `position?: {x,y}` al modelo WorkflowNode — se persiste en `metadata.layout`,á válido para el validador.

### 3.2 Cambio TRANSPORTABLE PERO OPCIONAL (decisión: NO en este bloque)
- Ampliar el DTO de tareas con `dueAt`/`completedAt`/`completedByUserId` — solo relevante para el visor de instancias, fuera de scope MVP.

### 3.3 Bug del seed a documentar (sin tocar código en este bloque)
- La `ROUTE_OUTCOME` definida en `seed.ts:432` pero **sin edges incidentes ni salientes** → el grafo publicado del seed **fallaría la validación del backend si se guardara vía API**. La semilla escribe directamente a Prisma sin pasar por `WorkflowVersion.createDraft`/`assertValid`.
- **Implicación para el editor:** el "skeleton" por defecto de un nuevo workflow **NO debe** replicar este patrón inválido. Usaremos un skeleton limpio START→SYSTEM(submit)→HUMAN_TASK→END.

### 3.4 Conclusión
**El backend ya cumple todos los contratos necesarios.** El frontend MVP se construye enteramente sobre los endpoints existentes.

---

## 4. Diseño técnico del editor

### 4.1 Stack
- `@xyflow/react` (React Flow v12) — lienzo + drag&drop + minimap + controls.
- `dagre` (peer dep o directa) — auto-layout cuando `metadata.layout` no existe.
- TanStack Query 5 — cache + mutaciones.
- React Hook Form + Zod — panel de propiedades.
- shadcn/ui existente — consistencia visual.

### 4.2 Estructura de archivos frontend (propuesta)

```
apps/web/
├── app/(app)/workflows/
│   ├── page.tsx                          # listado
│   ├── new/page.tsx                      # create form (redirect a /:id/editor)
│   ├── [id]/
│   │   ├── page.tsx                      # detalle (metadata + versiones)
│   │   ├── editor/page.tsx               # lienzo React Flow
│   │   └── versions/page.tsx             # histórico versiones
├── components/workflows/
│   ├── WorkflowCanvas.tsx                # wrapper <ReactFlow>
│   ├── NodePalette.tsx                   # paleta drag-source
│   ├── PropertyPanel.tsx                 # panel lateral editable
│   ├── EdgePanel.tsx                     # panel lateral de edges
│   ├── ConditionBuilder.tsx              # editor visual de ConditionExpression
│   ├── ValidationSummary.tsx             # lista de errores del validator
│   ├── PublishDialog.tsx                 # confirmación + diff
│   ├── DraftBadge.tsx                    # "cambios sin guardar"
│   ├── nodes/
│   │   ├── StartNode.tsx
│   │   ├── EndNode.tsx
│   │   ├── HumanTaskNode.tsx
│   │   ├── SystemNode.tsx
│   │   └── DecisionNode.tsx
│   └── graph/
│       ├── validateGraph.ts              # port 1:1 del graph-validator.ts (12 reglas)
│       ├── layoutGraph.ts                # dagre fallback
│       ├── serializeGraph.ts             # RF nodes/edges ↔ WorkflowGraph
│       └── skeletonGraph.ts              # default graph válido para /new
├── hooks/
│   └── workflow-hooks.ts                 # TanStack Query hooks
├── lib/
│   ├── workflow-types.ts                 # tipos de §2 (estrictos)
│   └── workflow-mapping.ts               # services ↔ domain types
```

### 4.3 Hooks TanStack Query

```typescript
useWorkflowDefinitionsQuery(filters)
useWorkflowDefinitionQuery(id)
useCreateWorkflowDefinitionMutation()
useUpdateWorkflowDefinitionMutation(id)
useRetireWorkflowDefinitionMutation(id)
useDeleteWorkflowDefinitionMutation(id)

useWorkflowVersionsQuery(definitionId)
useLatestDraftVersionQuery(definitionId) // helper: lista 1, filter DRAFT
usePublishedVersionQuery(definitionId)   // helper
useCreateDraftVersionMutation(definitionId)
useUpdateDraftVersionMutation(definitionId, versionId)
usePublishVersionMutation(definitionId, versionId)
useRetireVersionMutation(definitionId, versionId)
useDeleteDraftVersionMutation(definitionId, versionId)
```

### 4.4 Flujo de edición (decisiones críticas)

1.Usuario entra a `/workflows/:id/editor`:
   - `useWorkflowDefinitionQuery(id)` → `definition`.
   - `useLatestDraftVersionQuery(id)`:
     - Si existe DRAFT → usar su `definitionJson` como grafo base.
     - Si no existe DRAFT pero existe PUBLISHED → ofrecer "Crear borrador a partir de versión publicada" → llama `POST /versions` con el PUBLISHED graph.
     - Si no existe ninguna versión → botón "Crear primer borrador" → POST skeleton limpio.
2.El usuario arrastra nodos, conecta, edita:
   - Estado local en `<ReactFlow nodes edges>` con `useNodesState`/`useEdgesState`.
   - Cada mutación local activa `dirty = true` (DraftBadge visible).
   - `serializeGraph()` convierte RF state → `WorkflowGraph` (incluyendo `metadata.layout`).
3."Guardar borrador":
   - Ejecuta `validateGraph(graph)` en cliente → si errores, mostrar `ValidationSummary` y bloquear.
   - Si válido, mutación `PATCH /versions/:versionId` con `definitionJson: graph`.
   - Toast éxito/error; `dirty = false`.
4."Publicar":
   - Botón **visible solo si actor tiene `workflows.publish`** (SYSTEM_ADMIN).
   - Abre `PublishDialog` mostrando el checksum actual + confirmación.
   - Llama `POST /versions/:versionId/publish`.
   - Traduce 422 → mensaje claro. Traduce 403 → "Solo el administrador del sistema puede publicar".
   - Tras éxito, redirige a `/workflows/:id` con la versión PUBLISHED en modo lectura.

### 4.5 Modo solo lectura

Si la versión consultada es PUBLISHED:
- `<ReactFlow nodesDraggable={false} nodesConnectable={false} elementsSelectable />` (visualización pura).
- Sin paleta, sin panel de propiedades editable, sin botón Guardar.
- Botón "Crear nuevo borrador a partir de esta versión" → POST duplicando el grafo.
- Banner "🔒 Versión publicada — solo lectura".

### 4.6 Validaciones de cliente (replica 12 reglas del backend)

| # | Regla | Implementación |
|---|---|---|
| 1 | `definitionJson` es objeto | `typeof graph === 'object'` |
| 2 | `schemaVersion === 1` | constante chequeada |
| 3 | `nodes` no vacío, `edges` es array | `Array.isArray && length > 0` para nodes |
| 4 | nodo: key/name/type válidos, sin keys duplicados | Set() + lookup `WORKFLOW_NODE_TYPES` |
| 5 | HUMAN_TASK: assignment + outcomes no vacío; ROLE→roleCode, USER→userId | switch |
| 6 | SYSTEM: systemAction válido + targetRequestStatus si UPDATE_REQUEST_STATUS | switch |
| 7 | Exactamente 1 START | `nodes.filter(type==='START').length === 1` |
| 8 | ≥1 END | filtro |
| 9 | Edges: from/to/action requeridos, from/to existen | map + lookup |
| 10 | Condition si presente válida (ConditionEvaluator.validate port) | recursive |
| 11 | Reachability desde START (todos los nodos alcanzables; algún END alcanzable) | BFS |
| 12 | Detección de ciclos no autorizados (solo RETURN_FOR_CORRECTION/RESUBMIT) | DFS WHITE/GRAY/BLACK |

Estas reglas viven en `components/workflows/graph/validateGraph.ts` y se ejecutan:
- Antes de "Guardar borrador".
- Antes de "Publicar".
- Live inline cuando se mueve/conecta nodo.

Las missages se muestran en `ValidationSummary` y también inline en los nodos problemáticos (`invalid={true}` highlight).

### 4.7 Persistencia de layout

**Decisión:** React Flow `onChange` actualiza `metadata.layout[nodeKey]={x,y}`. Se guarda junto con el grafo en cada `PATCH`. Al recargar (`useWorkflowVersionsQuery` o draft ya en state), si `metadata.layout` existe, se aplica; si no, se corre `dagre.autoLayout(graph)` y se persiste en el primer save.

Esto garantiza "recargar restaura nodos, conexiones y posiciones" (criterio FASE 6).

---

## 5. Decisiones que afectan el modelo de datos (NO rupturas)

| Aspecto | Decisión | ¿Afecta a workflows publicados existentes? |
|---|---|---|
| Layout X/Y | En `graph.metadata.layout` (nuevo campo libre) | NO: `metadata?` ya opcional. Workflows publicados sin `metadata.layout` → autolayout dagre. |
| Ids de edges | Calculado `${from}__${to}__${action}` (no se envía al backend) | NO: `edge.key` es opcional. |
| Skeleton nuevo workflow | START + SYSTEM(submit) + HUMAN_TASK(sample) + END | NO: solo aplica a nuevas creaciones; published siguen intactos. |
| Tipos TS estrictos | Reflejan el dominio; DTO backend es compatible (`@IsObject`) | NO. |

**Ningún cambio rompe instancias ya iniciadas.** El motor ata `WorkflowInstance.workflowVersionId` a una versión publicada **inmutable**; ajustes posteriores generan nuevas versiones.

---

## 6. Riesgos identificados

| # | Riesgo | Mitigación |
|---|---|---|
| R1 | Validator cliente y backend pueden divergir | Port 1:1 del file; tests con CASOS idénticos a `graph-validator.spec.ts` |
| R2 | `ROUTE_OUTCOME` huérfano del seed confunde | NO usar el seed como skeleton. Skeleton limpio en `skeletonGraph.ts`. Documentado. |
| R3 | Publicación 403 para COMPANY_ADMIN | UI esconde Publish si `actor.permissions ∌ workflows.publish`. Toast claro si bypass. |
| R4 | ConflictError en publish por checksum duplicado | Catch específico → "Ya existe una versión publicada idéntica". No reintentar. |
| R5 | Auto-save conflictuando con edición simultánea | **No implementar autosave en MVP** — botón explícito "Guardar borrador" según criterio FASE 7. |
| R6 | Pérdida de cambios al navegar away | `beforeunload` + état interne `dirty`. Diálogo shadcn. |
| R7 | Concurrency: dos tabs editando el mismo draft | MVP: optimistic lock del backend (`updateGraph` lanza si version no DRAFT). Toast y `invalidate` queries. |
| R8 | DSL de condiciones demasiado complejo para usuarios | `ConditionBuilder` con dropdowns (field∈prefixes × operator). NO texto libre. |
| R9 | `definitionJson`-enorme en responses grandes | TanClient `staleTime: 0` y `refetchOnFocus` para evitar staleness; paginar versiones. |

---

## 7. Plan de implementación (FASES 2-9)

> Continúo automáticamente tras este informe según directriz del usuario ("no existe ambigüedad que pueda afectar el modelo de datos o el comportamiento de workflows ya publicados"). Las decisiones de §5 confirman que no hay ambigüedad.

### Orden de implementación

1. **Tipos + mapping** (`lib/workflow-types.ts`, `lib/workflow-mapping.ts`).
2. **Hooks** (`hooks/workflow-hooks.ts`).
3. **Validador port** (`components/workflows/graph/validateGraph.ts`).
4. **Layout + skeleton** (dagre + skeletonGraph).
5. **Navegación** (sidebar + breadcrumbs + permiso gate).
6. **Listado** (`/workflows`).
7. **Crear workflow** (`/workflows/new`).
8. **Detalle** (`/workflows/:id`).
9. **Editor** (`/workflows/:id/editor`):
   - Canvas + custom nodes + paleta + minimap + controls.
   - PropertyPanel + EdgePanel + ConditionBuilder.
   - Guardar + Validar + Publicar + read-only.
10. **Versiones** (`/workflows/:id/versions`).
11. **Tests** (vitest RTL tests sobre flujo crítico).
12. **Validación final** (FASE 10).
