# SGA - Estado Actual del Sistema (Current State Architecture)

**Fecha de Actualización:** 21 de Julio de 2026  
**Auditor Lead:** Arquitecto Principal de Software & QA Lead  
**Proyecto:** Sistema de Gestión de Accesos (SGA) — Aeropuerto Internacional de Tocumen, S.A.  

---

## 1. Inventario Tecnológico

| Capa | Tecnología | Versión | Estado Verificado |
|---|---|---|---|
| **Frontend Framework** | Next.js (App Router, Turbopack) | `16.2.10` | Build exitoso (`npm run build`) |
| **Frontend Runtime** | React / React DOM | `19.2.7` | Funcional con TypeScript 6.0.3 |
| **Estilos & UI** | Tailwind CSS, Radix UI, Lucide Icons | `4.3.2` | Componentes shadcn/ui estilizados |
| **Gestión de Estado** | TanStack React Query, Zustand | `5.101.2`, `5.0.14` | Session Store sin mocks |
| **Formularios & Validación** | React Hook Form, Zod | `7.81.0`, `4.4.3` | Esquemas de wizard en `wizard-schemas.ts` |
| **Backend Framework** | NestJS | `11.0.1` | Compilación exitosa (`nest build`) |
| **ORM & Base de Datos** | Prisma ORM, MariaDB / MySQL | `7.8.0` | **15 migraciones aplicadas** |
| **Seguridad & Auth** | Argon2id, JWT (@nestjs/jwt), Throttler | `0.44.0`, `11.0.2` | AuthIdentity 1:1, Login por Documento |
| **Pruebas Automatizadas** | Jest + ts-jest | `29.7.0` | **10 tests en verde (100% aprobados)** |

---

## 2. Consolidación de Identidad (`User` Único)

- **Entidad Humana Única:** `User` representa a todos los individuos en el sistema (solicitantes, titulares, participantes, escoltas, aprobadores, emisores).
- **Modelo `Person` Eliminado:** La entidad `Person`, `PeopleModule`, `PeopleController`, `personId` y la ruta `/people` han sido removidos por completo.
- **Relación de Participantes:** `RequestParticipant` reemplaza a `RequestPerson`, vinculando a los usuarios participantes (`participantUserId`).
- **Autenticación Desacoplada:** El login se efectúa mediante `documentType` + `documentNumber` + `password` consultando `AuthIdentity`.

---

## 3. Integraciones Externas (Diferidas / Fuera del Alcance Actual)

Las siguientes integraciones externas no se consideran fallos P0 ni afectan la preparación de la versión actual:
- Mesa de Servicios (Service Desk Webhook / API)
- Amazonia
- Proactiva
- APIs externas de exámenes de seguridad aeroportuaria

---

## 4. Estado de los Componentes y Pruebas

- **Autenticación JWT & Login por Documento:** COMPLETADA y probada.
- **Configuración Jest (GAP-03):** **CERRADO Y VERDE** (10/10 pruebas de dominio e integración aprobadas).
- **Base de Datos:** 15 migraciones aplicadas con reconstrucción limpia (`npx prisma migrate reset --force`).
- **Motor Backend de Flujos Dinámicos:** En proceso de implementación (Fase 3).
- **Editor Visual de Flujos (React Flow):** Diferido para la Fase 4.
