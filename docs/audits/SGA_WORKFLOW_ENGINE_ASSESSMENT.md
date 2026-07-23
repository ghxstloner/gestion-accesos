# SGA - Evaluación del Motor de Flujos de Trabajo (Workflow Engine Assessment)

**Fecha de Actualización:** 21 de Julio de 2026  
**Proyecto:** SGA - Aeropuerto Internacional de Tocumen, S.A.  

---

## 1. Estado y Arquitectura del Motor Backend (Fase 3)

El motor backend de flujos dinámicos reemplaza las reglas hardcodeadas mediante un sistema determinista, versionado e inmutable:

- **Identidad Única de Usuario (`User`):** Todas las tareas humanas (`WorkflowTask`), transiciones (`WorkflowTransition`) e instancias (`WorkflowInstance`) se vinculan a `User.id` (eliminando cualquier referencia a `Person`).
- **Definiciones y Versionado Inmutable (`WorkflowVersion`):** Cada workflow posee versiones inmutables una vez publicadas.
- **Evaluación Segura de Condiciones:** DSL estructurado en JSON que soporta operadores (`EQUALS`, `IN`, `GREATER_THAN_OR_EQUAL`, `AND`, `OR`, `NOT`) evaluados sobre un contexto restringido (`request.*`, `subjectUser.*`, `creatorUser.*`, `company.*`).
- **Validación Estricta de Grafos:** Verificación antes de publicar (nodo START único, alcance de nodos END, asignaciones válidas y ciclos controlados únicamente para `RETURN_FOR_CORRECTION`).
