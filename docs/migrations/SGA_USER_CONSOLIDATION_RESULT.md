# SGA - Resultado de Consolidación de Identidades (User + Person)

**Fecha:** 21 de Julio de 2026  
**Estatus:** CERTIFICADO Y COMPLETO  
**Base de Datos:** `sga_dev` (MySQL 8)  

---

## 1. Resumen Ejecutivo

Se ha completado la consolidación del modelo de identidad del Sistema de Gestión de Accesos (SGA). La entidad física `Person` ha sido eliminada por completo, convirtiendo a **`User` en la fuente única de verdad** para todos los individuos registrados. La autenticación ha sido desacoplada al modelo **`AuthIdentity`** (relación 1:1 con `User`), permitiendo el inicio de sesión mediante **tipo de documento, número de documento y contraseña**.

---

## 2. Migración Formal Creada

- **Nombre de la Migración:** `20260721160000_consolidate_user_identity`
- **Ubicación:** `apps/api/prisma/migrations/20260721160000_consolidate_user_identity/migration.sql`
- **Acciones Ejecutadas:**
  - `DROP TABLE people` y `DROP TABLE request_persons`.
  - Ampliación de la tabla `users` con atributos personales, de contacto, laborales y de identificación.
  - Creación de la tabla `auth_identities` (hashing Argon2id, contador de intentos fallidos `failed_login_attempts`, `locked_until`, `must_change_password`).
  - Creación de la tabla `password_recovery_challenges` (códigos hash de 1 solo uso con expiración a los 10 minutos).
  - Creación de la tabla `request_participants` (relación `participant_user_id` -> `users.id`).
  - Actualización de llaves foráneas: `company_authorized_signers.signer_user_id`, `credentials.subject_user_id`, `custody_records.subject_user_id`.
  - Creación del índice único: `@@unique([document_type, normalized_document_number])`.

---

## 3. Semilla de Base de Datos y Administrador Inicial

- **Validación Estricta de Entorno:** El script `apps/api/prisma/seed.ts` valida obligatoriamente la existencia de `SEED_ADMIN_PASSWORD`. Si la variable no está definida, el proceso se detiene con código de salida 1 sin crear cuentas ni revelar información sensible.
- **Usuario Administrador Creado:**
  - **Nombre:** Yoiner Moreno
  - **Tipo de Documento:** `PASSPORT`
  - **Número de Documento:** `5849827`
  - **Número Normalizado:** `5849827`
  - **Rol:** `SYSTEM_ADMIN`
  - **Correo:** `null` (`emailVerifiedAt`: `null`)
  - **Estado:** `ACTIVE` (`mustChangePassword`: `false`)
- **Usuarios de Demostración:** 18 usuarios registrados directamente como `User` con sus respectivas `AuthIdentity` asociadas.

---

## 4. Verificación de Despliegue Limpio (Zero-Intervention Rebuild)

El sistema demostró ser 100% reproducible desde una base de datos vacía ejecutando la secuencia oficial:
```bash
npx prisma migrate reset --force
npx prisma migrate status
npx prisma validate
npx prisma generate
SEED_ADMIN_PASSWORD="Demo1234!" npm run prisma:seed
```
Resultado: **15/15 migraciones aplicadas correctamente**, esquema validado y datos de semilla creados con éxito.
