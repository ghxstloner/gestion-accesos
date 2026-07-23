# SGA - Flujo de Recuperación de Contraseña (Password Recovery Flow)

**Fecha:** 21 de Julio de 2026  
**Proyecto:** SGA - Aeropuerto Internacional de Tocumen, S.A.  

---

## 1. Reglas de Negocio de Recuperación

1. **Identificación por Documento:** La recuperación se solicita enviando `documentType` y `documentNumber`.
2. **Respuesta Antienumeración Obligatoria:** Independientemente de si el documento existe o no en la base de datos, el servidor responde **siempre** con el mismo mensaje genérico:
   > `"Si la cuenta tiene un correo electrónico verificado, se enviarán las instrucciones de recuperación."`
3. **Condiciones para Generación de Código:** Solamente se genera y envía un código cuando:
   - `User` existe en el sistema.
   - `User.status` es `ACTIVE`.
   - `User.email` no es nulo ni vacío.
   - `User.emailVerifiedAt` no es nulo.
   - `AuthIdentity` está activa.
4. **Usuarios sin Correo Verificado (ej. Administrador Yoiner Moreno):** Para usuarios con `email: null` o sin verificar, el sistema no genera un desafío válido ni intenta enviar correos, manteniendo la respuesta genérica para evitar filtración de información. Su contraseña debe ser restablecida por un administrador mediante procedimiento interno.

---

## 2. Entidad y Desafío de Recuperación (`PasswordRecoveryChallenge`)

- **Código:** Numérico aleatorio de 6 dígitos.
- **Seguridad en BD:** No se almacena el código en texto plano; se guarda su hash Argon2id (`codeHash`).
- **Expiración:** 10 minutos desde su creación (`expiresAt`).
- **Límite de Intentos:** Máximo 3 intentos por código (`maxAttempts`).
- **Consumo Único:** Al ser validado exitosamente, se marca `consumedAt = now()`. Los desafíos anteriores no consumidos se invalidan automáticamente al solicitar uno nuevo (`invalidatedAt = now()`).
- **Token de Recuperación:** Tras validar el código de 6 dígitos, se emite un `recoveryToken` firmado de un solo uso con vigencia de 15 minutos para invocar la actualización de contraseña (`POST /auth/password-recovery/reset`).
