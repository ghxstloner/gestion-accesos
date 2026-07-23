# SGA - Trazabilidad de Requisitos y Flujos de Negocio

**Fecha:** 21 de Julio de 2026  
**Proyecto:** SGA - Aeropuerto Internacional de Tocumen, S.A.  

---

## 1. Trazabilidad de los Cuatro Flujos Principales

### Flujo A: Solicitud Amazonia/Proactiva (Carné Permanente con Examen y Foto)
- **Inicio de Solicitud:** Frontend (`/requests/new`) -> Endpoint `POST /requests`. Estado: **IMPLEMENTADO** (Evidencia: `apps/web/app/(app)/requests/new/page.tsx`, `apps/api/src/modules/requests/requests.controller.ts`).
- **Revisión Documental y Exámenes:** Frontend (`/reviews/[id]`) -> Endpoint `POST /requests/:id/review`. Estado: **PARCIAL** (Falta la verificación automatizada del examen de seguridad aeroportuaria mediante API; actualmente se maneja como campo de observaciones o adjunto manual).
- **Captura de Fotografía:** Frontend (`/people/[id]`) -> Endpoint `POST /people/:id/photo`. Estado: **PARCIAL** (Permite subida de archivo PNG/JPG, pero no integración con cámara WebRTC/hardware directa en estación de carnetización).
- **Confección y Emisión:** Frontend (`/issuance`) -> Endpoint `POST /issuance/credentials`. Estado: **IMPLEMENTADO** (Evidencia: `apps/web/app/(app)/issuance/page.tsx`, `apps/api/src/modules/issuance/issuance.service.ts`).
- **Entrega de Carné:** Endpoint `PATCH /issuance/credentials/:id/deliver`. Estado: **IMPLEMENTADO**.

---

### Flujo B: Proveedor/Visita Temporal (Custodia de Documento de Identidad y Escolta)
- **Solicitud de Permiso Temporal:** Frontend (`/requests/new`) -> Tipo `TEMPORARY_PERMIT`. Estado: **IMPLEMENTADO**.
- **Revisión y Aprobación:** Frontend (`/reviews/[id]`). Estado: **IMPLEMENTADO**.
- **Custodia de Cédula/Pasaporte:** Frontend (`/issuance`) -> Endpoint `POST /issuance/custody`. Estado: **IMPLEMENTADO** (Evidencia: Modelo `CustodyRecord` en Prisma, controlador `issuance.controller.ts`).
- **Asignación y Verificación de Escolta:** Backend `RequestEquipment` / `RequestPerson`. Estado: **PARCIAL** (La indicación de escolta requerida no está forzada mediante una regla estricta de validación ni entidad de escolta asignado).
- **Devolución de Carné y Documento:** Endpoint `PATCH /issuance/custody/:id/return`. Estado: **IMPLEMENTADO** (Evidencia: `issuance.service.ts`).
- **Alerta de Devolución Tardía:** Estado: **AUSENTE** (Falta servicio cron de alertas de expiración de permanencia temporal).

---

### Flujo C: Solicitud mediante Mesa de Servicios
- **Recepción Externa (API / Webhook):** Endpoint `POST /integrations/mesa-servicios`. Estado: **AUSENTE / NO IMPLEMENTADO** (No existe endpoint de recepción ni adaptador de integración).
- **Verificación de Examen:** Estado: **AUSENTE**.
- **Aprobación y Emisión:** Estado: **PARCIAL** (Utiliza el flujo estándar manual una vez digitada la solicitud).

---

### Flujo D: Renovación / Emisión sin Captura de Foto (Reutilización de Fotografía)
- **Verificación de Fotografía Existente:** Frontend `PersonForm.tsx` & Backend `PeopleService`. Estado: **IMPLEMENTADO** (Reutiliza `photoUrl` almacenada en la entidad `Person`).
- **Validación de Expiración de Foto:** Estado: **PARCIAL** (No hay regla de expiración de foto mayor a X años en la validación del backend).

---

## 2. Matriz de Rutas Alternativas y Excepciones

| Ruta / Excepción | Estado | Evidencia y Observaciones |
|---|---|---|
| **Aprobación Estándar** | **IMPLEMENTADO** | `POST /requests/:id/approve` cambia estado a `APPROVED`. |
| **Rechazo con Motivo** | **IMPLEMENTADO** | `POST /requests/:id/reject` requiere `rejectionReasonId` y observaciones. |
| **Devolución para Corrección** | **PARCIAL** | Permite rechazo, pero no un estado explícito de `RETURNED_FOR_CORRECTION` con reenvío directo. |
| **Cancelación por Solicitante** | **IMPLEMENTADO** | `POST /requests/:id/cancel` cuando está en estado `DRAFT` o `SUBMITTED`. |
| **Documentos Incompletos** | **PARCIAL** | Validación Zod en cliente, pero sin rechazo automático en backend por falta de anexos requeridos según tipo. |
| **Examen Fallido** | **AUSENTE** | Sin módulo de notas/calificaciones de examen AIT. |
| **Solicitud Duplicada** | **PARCIAL** | No hay restricción de clave única para solicitud activa simultánea de la misma persona. |
| **Reintentos y Timeout API** | **IMPLEMENTADO** | React Query maneja reintentos y estados de carga en frontend. |
| **Transición Concurrente / Doble Clic** | **IMPLEMENTADO** | Mutaciones controladas con disabled state y transiciones de estado atómicas en Prisma. |
