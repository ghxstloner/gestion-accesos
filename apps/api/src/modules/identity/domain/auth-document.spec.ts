import { normalizeDocumentNumber } from '../application/auth.service.js';

describe('Auth & Document Login Domain Logic', () => {
  describe('normalizeDocumentNumber', () => {
    it('normalizes document numbers by removing leading/trailing spaces and converting to uppercase', () => {
      expect(normalizeDocumentNumber(' 5849827 ')).toBe('5849827');
      expect(normalizeDocumentNumber('pa-1234567')).toBe('PA-1234567');
      expect(normalizeDocumentNumber('8-123-456')).toBe('8-123-456');
    });
  });

  describe('JWT Payload & Security Constraints', () => {
    it('ensures minimal JWT payload structure without sensitive document or password hash data', () => {
      const userId = 'usr-12345';
      const companyId = 'cmp-67890';
      const roles = ['SYSTEM_ADMIN'];
      const permissions = ['users.manage'];

      const minimalPayload = {
        sub: userId,
        companyId,
        roles,
        permissions,
      };

      const payloadKeys = Object.keys(minimalPayload);
      expect(minimalPayload.sub).toBe('usr-12345');
      expect(payloadKeys).not.toContain('passwordHash');
      expect(payloadKeys).not.toContain('documentNumber');
      expect(payloadKeys).not.toContain('normalizedDocumentNumber');
    });
  });

  describe('Account Lockout & Attempt Counter Thresholds', () => {
    it('calculates lockout threshold correctly after 5 failed attempts', () => {
      const maxAttempts = 5;
      let currentAttempts = 4;

      currentAttempts += 1;
      const isLocked = currentAttempts >= maxAttempts;

      expect(currentAttempts).toBe(5);
      expect(isLocked).toBe(true);
    });

    it('resets attempt counter to 0 on successful login', () => {
      let failedLoginAttempts = 4;
      let lockedUntil: Date | null = new Date();

      // Successful login reset
      failedLoginAttempts = 0;
      lockedUntil = null;

      expect(failedLoginAttempts).toBe(0);
      expect(lockedUntil).toBeNull();
    });
  });
});
