# SGA - Matriz de Brechas (Gap Matrix)

**Fecha:** 21 de Julio de 2026  
**Proyecto:** SGA - Aeropuerto Internacional de Tocumen, S.A.  

---

## Matriz General de Brechas y Defectos

| ID | Requisito / Brecha | Fuente | Prioridad | Estado | Riesgo | Brecha / Solución en Curso |
|---|---|---|---|---|---|---|
| **GAP-01** | Integración externa con Mesa de Servicios (API / Webhook) | PDF Formulario AIT | **DEFERRED** | **DIFERIDO** | Bajo | Clasificado como integración externa futura. No bloquea la versión actual. |
| **GAP-02** | Motor Backend de Flujos Dinámicos (Workflow Engine) | Requisitos Fase 3 | **P0** | **EN PROCESO** | Alto | Implementación de modelos Prisma, evaluador DSL de condiciones, validador de grafos y WorkflowEngineService. |
| **GAP-03** | Configuración de Pruebas Automatizadas Backend (Jest) | Calidad de Software | **P0** | **CERRADO** | Nulo | **RESUELTO:** Alineado a Jest v29.7.0. 10/10 pruebas unitarias e integración en verde. |
| **GAP-04** | Editor Visual de Flujos de Trabajo (React Flow) | Requisitos Fase 4 | **P1** | **PENDIENTE** | Medio | Programado para la Fase 4 del roadmap (Editor visual sobre el motor backend). |
| **GAP-05** | Alertas de Devolución Tardía de Carné y Custodia | Formulario Permiso Temporal | **P1** | **PARCIAL** | Medio | Servicio programado (Cron) para vigencia de pases temporales. |
| **GAP-06** | Regla de Validación de Examen de Seguridad Aeroportuaria | Especificación Técnica | **P1** | **PARCIAL** | Medio | Validación estructurada de vigencia de Examen AIT en el motor de workflow. |
