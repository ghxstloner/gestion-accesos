# SGA - Flujo de Autenticación y Seguridad (Authentication Flow)

**Fecha:** 21 de Julio de 2026  
**Proyecto:** SGA - Aeropuerto Internacional de Tocumen, S.A.  

---

## 1. Arquitectura de Autenticación por Documento

El inicio de sesión en el SGA no utiliza la dirección de correo electrónico como identificador. En su lugar, el sistema exige:
1. `documentType`: Enum (`NATIONAL_ID`, `PASSPORT`, `RESIDENCE_ID`, `OTHER`).
2. `documentNumber`: Cadena de texto (ejemplo: `8-123-456` o `5849827`).
3. `password`: Contraseña en texto plano transmitida sobre HTTPS.

### Diagrama del Flujo de Login:
```
[Cliente Web / App]
       │
       │ POST /api/v1/auth/login
       │ { documentType, documentNumber, password }
       ▼
[AuthController]
       │ Normalizar documentNumber -> normalizedDocumentNumber (Mayúsculas, trim)
       ▼
[AuthService / Prisma]
       │ Buscar User por [documentType, normalizedDocumentNumber]
       ├─► ¿Usuario no existe o no tiene AuthIdentity? ──► Retornar 401 (Respuesta Genérica)
       ├─► ¿Cuenta inactiva / bloqueada? ──────────────────► Retornar 401 ("Account blocked/inactive")
       └─► ¿lockedUntil > fecha actual? ────────────────────► Retornar 401 ("Account locked temporarily")
       ▼
[PasswordHasher (Argon2id)]
       │ Verificar password contra AuthIdentity.passwordHash
       ├─► VÁLIDO:
       │     - Incrementar lastLoginAt
       │     - Reiniciar failedLoginAttempts = 0, lockedUntil = null
       │     - Emitir AuditEvent ('user.login_success')
       │     - Emitir Access Token JWT (Payload mínimo: sub, companyId, roles, permissions)
       │     - Establecer Refresh Token en Cookie HttpOnly
       │     - Retornar 200 OK + UserResponseDto
       └─► INVÁLIDO:
             - Incrementar failedLoginAttempts (+1)
             - Si failedLoginAttempts >= 5 ──► Establecer lockedUntil = Ahora + 15 minutos
             - Emitir AuditEvent ('user.login_failed')
             - Retornar 401 ("Invalid document or password")
```

---

## 2. Especificación de Seguridad JWT

- **Algoritmo:** RS256 / HS256 con clave secreta rotativa.
- **Payload Mínimo Emitido:**
  ```json
  {
    "sub": "usr-8a9d20c1-54b2-4d1e",
    "companyId": "cmp-1001-aac",
    "roles": ["SYSTEM_ADMIN"],
    "permissions": ["users.manage", "requests.approve"],
    "iat": 1784640000,
    "exp": 1784640900
  }
  ```
- **Campos Excluidos Explícitamente:** `documentNumber`, `normalizedDocumentNumber`, `passwordHash`, correo personal u otra información sensible de identidad.
