# SGA — Sistema de Gestión de Accesos — Estado del MVP

> **Fecha de la auditoría:** 2026-07-13
> **Última actualización:** 2026-07-13 (post-fixes)
> **Alcance:** Frontend MVP (Next.js App Router + React + TypeScript + Tailwind + shadcn/ui + Zustand + React Hook Form + Zod). Sin backend.
>
> **Verificación técnica:**
> - `npm run typecheck` → ✅ Pasa (0 errores).
> - `npm run lint` → ✅ Pasa con 1 advertencia menor preexistente (`react-hooks/exhaustive-deps` en `reviews/page.tsx`).
> - `npm run build` → ✅ Compila. 21 rutas generadas (3 dinámicas).
>
> **Resumen:** El proyecto se recibió con ~85% funcional. Tras esta sesión se corrigieron los 6 hallazgos críticos/parciales, completando el flujo de extremo a extremo (creación, edición de borradores/devueltas, revisión, emisión) y el CRUD completo de catálogos. El MVP ya permite demostrar todo el ciclo especificado.

---

## Resumen ejecutivo

| Bloque | Cobertura aprox. |
|---|---|
| Infraestructura / Design system / Layout | 95% |
| Login mock + selector de rol/usuario + persistencia | 95% |
| Dashboards por rol | 90% |
| CRUD Empresas | 100% |
| CRUD Usuarios | 95% (scoping por empresa añadido; email único pendiente) |
| CRUD Personas | 95% |
| Firmantes autorizados | 95% (Zod + aviso de vigencia añadidos) |
| Catálogos | **100% — COMPLETO** (CRUD persistente con activar/desactivar) |
| Wizard de solicitudes | 90% |
| Bandeja de revisión | 95% |
| Flujo de emisión | 95% |
| Historial de estados | 100% |
| localStorage / Reset | 100% |
| Responsive / Loading / Empty / Error / Toasts | 90% |
| Total funcional estimado | **≈ 95%** (post-fixes) |

---

## Matriz de estado

| Módulo | Estado | Evidencia | Problemas encontrados | Próximo paso |
|---|---|---|---|---|
| Design system | COMPLETO | `tailwind.config.ts`, `app/globals.css` (tokens brand/surface/states en HSL y hex) | Ninguno crítico; `eslint-config-next` 13.5.1 anclado a Next 13.5 | Mantener |
| Layout principal | COMPLETO | `components/layout/AppShell.tsx` (sidebar + header + main) | Sin guard por rol a nivel de route (solo nav) | Aceptar por ahora |
| Sidebar | COMPLETO | `components/layout/AppSidebar.tsx` (colapsable, persiste en `sga-sidebar-collapsed`) | Duplicación posible con header en móvil | OK |
| Header | COMPLETO | `components/layout/AppHeader.tsx` (breadcrumbs, switch usuario/rol, notif, reset, buscador) | Ninguno — buscador global ahora redirige a `/requests?search=` (respetado por la lista) | OK |
| Login mock | COMPLETO | `app/login/page.tsx` (selector usuario + rol, panel visual, sugerencia demostración) | Ninguno | OK |
| Selector de usuario | COMPLETO | `AppHeader.tsx` dropdown → `setCurrentUser({userId, role})` | Ninguno | OK |
| Selector de rol | COMPLETO | `AppHeader.tsx` dropdown → `setCurrentUser({userId, role})` | Muestra lista completa de roles a cualquier usuario (aceptable: es MVP) | OK |
| Persistencia de sesión mock | COMPLETO | `lib/store.ts` Zustand `persist({ name: 'sga-mvp-storage' })` con `currentUser` en el estado | Ninguno | OK |
| Dashboard admin general | COMPLETO | `app/(app)/dashboard/page.tsx` → `AdminDashboard` (KPIs + recientes + actividad) | Ninguno | OK |
| Dashboard admin empresa | COMPLETO | `CompanyAdminDashboard` (alcance por empresa) | Ninguno | OK |
| Dashboard solicitante | COMPLETO | `SolicitanteDashboard` | Ninguno | OK |
| Dashboard receptor documentos | PARCIAL | `RevisorDashboard` existe y renderiza | Mostrar pendientes documentales | Verificar métricas vs. estado `EN_REVISION_DOCUMENTAL` |
| Dashboard jefe documentos | COMPLETO | `JefeDashboard` | Ninguno | OK |
| Dashboard emisor | COMPLETO | `EmisorDashboard` | Ninguno | OK |
| Empresas (CRUD) | COMPLETO | `companies/page.tsx`, `new/page.tsx`, `[id]/page.tsx` + store actions `addCompany/updateCompany/toggleCompanyStatus` | Ninguno | OK |
| Usuarios (CRUD) | COMPLETO | `users/page.tsx`, `new/page.tsx`, `[id]/page.tsx` + `addUser/updateUser/toggleUserStatus/resetUserPassword` | Scoping por empresa añadido (ADMIN_EMPRESA ve solo su empresa en list/new/[id]); rol limitado a subordinados al crear/editar en contexto empresa. Reset de contraseña sigue siendo no-op simulado (esperado) | OK |
| Personas (CRUD) | COMPLETO | `people/page.tsx`, `new/page.tsx`, `[id]/page.tsx` + `PersonForm.tsx` | Ninguno mayor. Scoping por empresa correcto en listado. Edición in-place. Validación de `idNumber` única manual (no por `z.refine`) | OK |
| Firmantes autorizados | COMPLETO | `authorized-signers/page.tsx` + store actions | Zod añadido (incl. validación `endDate >= startDate`); aviso visual de "Vencido" en filas activas fuera de vigencia; limpiados imports muertos (`Eye`, helpers) | OK |
| Catálogos | COMPLETO | `catalogs/page.tsx` (7 pestañas + Diálogo RHF/Zod) + store actions `addCatalogEntry`/`updateCatalogEntry`/`toggleCatalogEntry` | Añadidas acciones de store y wiring completo; acción Activar/Desactivar persistida y protegida con confirmación; limpiados imports muertos (`Trash2`, `CheckCircle2`, `XCircle`) | OK |
| Listado de solicitudes | COMPLETO | `requests/page.tsx` (filtros por estado/tipo/empresa, búsqueda, scoping por rol en `scopedRequests`) | Ninguno | OK |
| Wizard de nueva solicitud | COMPLETO | `requests/new/page.tsx` — wizard 8 pasos, autosave, edición de solicitudes existentes vía `?edit=<id>`, validación por paso, resumen + envío con número SGA | La carga edita en sitio (no crea un nuevo borrador). Tres detalles menores abiertos: (a) autosave sigue creando un único borrador huérfano si el usuario selecciona tipo y abandona; (b) el Input de búsqueda del paso 3 todavía no filtra cards; (c) sin Zod central por paso. No rompen el flujo | Opcional: conectar búsqueda y Zod |
| Guardado de borradores | COMPLETO | `createDraftRequest` + `updateRequest` en store + autosave debounced 1500ms + carga vía `?edit=<id>` | La edición funciona para BORRADOR y DEVUELTA_PARA_CORRECCION | OK |
| Envío de solicitudes | COMPLETO | `submitRequest` action → genera evento historial + cambio a `ENVIADA` | Ninguno | OK |
| Detalle de solicitud | COMPLETO | `requests/[id]/page.tsx` con tabs (info, beneficiarios, accesos, documentos, historial, emisión) + submit | Botón "Editar" ya redirige a `/requests/new?edit=<id>` y carga la solicitud existente | OK |
| Historial de estados | COMPLETO | `RequestHistoryEvent[]` construido en cada `setRequestStatus` y mostrado en pestaña Historial + timeline en `reviews/[id]` | Ninguno | OK |
| Bandeja de revisión (listado) | COMPLETO | `reviews/page.tsx` | Filtro por prioridad decorativo implícito (no expuesto como tal); OK funcional | OK |
| Revisión de documentos individual | COMPLETO | `reviews/[id]/page.tsx` → Aprobación directa + Rechazo con Diálogo shadcn (Textarea, observación obligatoria) y barra de progreso documental | Ninguno | OK |
| Devolución para corrección | COMPLETO | Diálogo con motivo (`REJECTION_REASONS`) + comentario obligatorio + acción `returnRequest` | Ninguno | OK |
| Rechazo de solicitud | COMPLETO | Diálogo similar + `rejectRequest` | Ninguno | OK |
| Aprobación de etapa / aprobación | COMPLETO | `approveDocumentStage` (REVISOR/JEFE) + `approveRequest` (JEFE) | Ninguno | OK |
| Bandeja de emisión | COMPLETO | `issuance/page.tsx` tabs: Pendientes / En confección / Listas / Entregadas KPIs | Sin generación de número de carné | Opcional |
| Confección simulada | COMPLETO | `startIssuance` → `EN_CONFECCION` | Ninguno | OK |
| Entrega simulada | COMPLETO | `registerDelivery(reqId, receivedBy, observation, actor)` con diálogo | Ninguno | OK |
| localStorage | COMPLETO | Zustand persist(`sga-mvp-storage`) cubre todo el estado excepto `sga-sidebar-collapsed` (propio) | Ninguno | OK |
| Reset de datos MVP | COMPLETO | `AppHeader.tsx` → `resetData()` action | Ninguno | OK |
| Responsive | COMPLETO | Layout móvil con Sheet sidebar; tablas scrollables; grids responsivos | Ninguno | OK |
| Loading states | PARCIAL | Redirecciones muestran "Cargando…/Redirigiendo…" | Sin skeleton/loading real en operaciones asíncronas simuladas (no crítico en MVP local) | Opcional |
| Empty states | COMPLETO | `components/shared/EmptyState.tsx` usado en scraps | Ninguno | OK |
| Error states | PARCIAL | Validaciones con toast; not-found handles en `[id]` | Sin página 404 personalizada; errores de validación en línea | OK para MVP |
| Toasts y confirmaciones | COMPLETO | `use-toast.ts` + `ConfirmDialog.tsx` | Ninguno | OK |
| Validaciones de formularios | PARCIAL | Zod en companies, users, people, signers y catalogs; manual en wizard | Wizard todavía con `canProceed` booleano por paso (P4) | Extender Zod al wizard por paso |

---

## Hallazgos críticos (estado post-fix)

Todos los hallazgos originales se resolvieron en esta sesión:

1. ✅ **Catálogos persistentes.** Añadidas acciones de store (`addCatalogEntry`, `updateCatalogEntry`, `toggleCatalogEntry`) en `lib/store.ts`; la UI ahora persiste crear/editar y permite activar/desactivar entradas con diálogo de confirmación.
2. ✅ **Edición de solicitudes borrador/devueltas.** `/requests/new?edit=<id>` carga la solicitud existente (en BORRADOR o DEVUELTA), permite editar y reenviar. El botón "Editar" del detalle ahora apunta a la URL correcta.
3. ✅ **Rechazo de documento mejorado.** Sustituido `window.prompt` por un `Dialog` de shadcn con Textarea y validación de comentario obligatorio.
4. ✅ **Scoping por empresa en Usuarios y Personas.** `ADMIN_EMPRESA` solo lista/edita/crea en su propia empresa; rol limitado a subordinados al crear/editar; las páginas de detalle deniegan el acceso por URL directa a registros ajenos.
5. ✅ **Firmantes con Zod y aviso de vigencia.** Validación con Zod (incluida `endDate >= startDate`) y badge "Vencido" en filas activas cuya vigencia expiró.
6. ✅ **Buscador global funcional.** El input del `AppHeader` ahora realiza búsqueda y redirige a `/requests?search=...`, parámetro que la lista de solicitudes respeta.
7. ✅ **Imports muertos limpiados** en `catalogs/page.tsx`, `authorized-signers/page.tsx` y `PersonForm.tsx`.

## Verificación final

| Comando | Resultado |
|---|---|
| `npm run typecheck` | ✅ Pasa (0 errores) |
| `npm run lint` | ✅ Pasa (1 advertencia menor preexistente) |
| `npm run build` | ✅ Compila — 21 rutas generadas (3 dinámicas) |
| Pruebas | El proyecto no incluye suite de tests; no aplica |

## Estado actual del MVP

- **Cobertura funcional estimada: ~95%** (antes ≈85%).
- **Flujo completo demostrable de extremo a extremo:** login mock → selección de usuario/rol → dashboard por rol → administración de empresas/usuarios/personas/firmantes/catálogos → creación de solicitud (con borrador) → envío → revisión documental (aprobar/rechazar docs) → devolución + corrección + reenvío → aprobación → confección → lista para entrega → entrega → historial completo. Todo persiste en `localStorage` y sobrevive a la recarga, con botón "Restablecer datos del MVP".

## Pendientes recomendados (no bloqueantes)

1. **Wizard con Zod central.** Hoy valida por paso con `canProceed`. Recomendar definir un esquema Zod por paso para reportar errores en línea.
2. **Conectar búsqueda interna del Paso 3** del wizard (Input sin `onChange`) para filtrar cards de personas.
3. **Validación de email único en Usuarios** (similar a `idNumber` único de Personas).
4. **Generación de número de carné** en el flujo de emisión y visualización del número en carné entregado.
5. **Skeletons de carga** en operaciones asíncronas simuladas.
6. **Consolidar fuente única de catálogos** entre `lib/constants.ts` (constantes para el wizard) y `lib/mock-data/catalogs.ts` (datos editables) para evitar desviaciones futuras.
7. **Deshacer / rollback** en emisión (actualmente no se puede corregir un "Marcar como lista" o entrega errónea).
