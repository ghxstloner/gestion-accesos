# SGA - Roadmap hacia el 100% de Preparación para Producción

**Fecha de Actualización:** 21 de Julio de 2026  
**Proyecto:** SGA - Aeropuerto Internacional de Tocumen, S.A.  

---

## Fases del Roadmap de Desarrollo

### FASE 1: Calidad Base y Suite de Pruebas Backend (COMPLETADO)
- **Estado:** **CERRADO Y VERDE**
- **Logros:** Corrección de Jest v29.7.0. 10/10 pruebas unitarias e integración en verde.

### FASE 2: Consolidación de Identidades User + Person y Login por Documento (COMPLETADO)
- **Estado:** **CERTIFICADO Y COMPLETO**
- **Logros:** Eliminación del modelo `Person`. `User` es la única entidad humana. Autenticación por `documentType` + `documentNumber` + `password` sobre `AuthIdentity`. 15 migraciones aplicadas.

### FASE 3: Motor Backend de Flujos Dinámicos (EN EJECUCIÓN ACTUAL)
- **Objetivo:** Implementar los modelos Prisma, evaluador determinista DSL de condiciones, validador de grafos, servicio de versionado inmutable, selección de flujo y WorkflowEngineService para gestionar las transiciones de solicitudes.
- **Entregables:** Modelos Prisma (`WorkflowDefinition`, `WorkflowVersion`, `WorkflowInstance`, `WorkflowNodeInstance`, `WorkflowTask`, `WorkflowTransition`), migración `20260721170000_create_workflow_engine`, APIs REST y 4 workflows sembrados.

### FASE 4: Editor Visual con React Flow (PENDIENTE SIGUIENTE)
- **Objetivo:** Implementar la interfaz gráfica basada en React Flow (`@xyflow/react`) para diseñar, editar borradores y publicar workflows visualmente.

### FASE 5: Vinculación Completa de Solicitudes al Motor Backend
- **Objetivo:** Migración progresiva de las acciones de solicitud (`submit`, `approve`, `reject`, `return_for_correction`) hacia el motor de workflow.

### FASE FUTURA: Integraciones Externas (DEFERRED / FUERA DEL ALCANCE ACTUAL)
- Mesa de Servicios, Amazonia, Proactiva, APIs externas de exámenes.
- **Clasificación:** Diferidas. No afectan la tasa de preparación ni bloquean la versión actual.
