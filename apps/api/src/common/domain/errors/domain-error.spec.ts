/**
 * `DomainError` hierarchy regression spec.
 *
 * Background: the base class used to set
 *   `Object.setPrototypeOf(this, DomainError.prototype)`
 * in its constructor. Because `new.target` was ignored, EVERY subclass
 * instance had its prototype collapsed to `DomainError`, so
 * `instanceof ForbiddenError` (and friends) returned `false`. This broke
 * downstream consumers (filters, controllers, tests) that branch on the
 * concrete subclass and broke Jest's `toThrow(ConcreteSubclass)` matcher
 * (which internally invokes `instanceof`).
 *
 * The fix uses `new.target.prototype` so the prototype chain is preserved
 * for the actual constructor invoked via `new`. This spec locks that
 * invariant — it must NEVER regress or `instanceof` checks in filters,
 * controllers, guards, unit tests and shared libraries will silently lose
 * precision again.
 */
import { describe, it, expect } from '@jest/globals';
import {
  DomainError,
  ValidationError,
  NotFoundError,
  ConflictError,
  BusinessRuleError,
  UnauthorizedError,
  ForbiddenError,
} from './domain-error';

describe('DomainError hierarchy', () => {
  describe('abstract base', () => {
    it('DomainError is abstract but instantiable transitively via subclasses', () => {
      // Direct `new DomainError('x')` is forbidden by TS abstract; but every
      // subclass must be an instance of DomainError.
      const err = new ValidationError('bad input');
      expect(err).toBeInstanceOf(DomainError);
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe('prototype chain preserved for each subclass (instanceof checks)', () => {
    it('ValidationError', () => {
      const err = new ValidationError('bad input');
      expect(err).toBeInstanceOf(ValidationError);
      expect(err).toBeInstanceOf(DomainError);
      expect(err).toBeInstanceOf(Error);
    });

    it('NotFoundError (with id)', () => {
      const err = new NotFoundError('Request', 'req-1');
      expect(err).toBeInstanceOf(NotFoundError);
      expect(err).toBeInstanceOf(DomainError);
      expect(err).toBeInstanceOf(Error);
      // Concrete subclass is NOT another subclass (precision):
      expect(err).not.toBeInstanceOf(ForbiddenError);
      expect(err).not.toBeInstanceOf(ValidationError);
    });

    it('NotFoundError (without id)', () => {
      const err = new NotFoundError('Request');
      expect(err).toBeInstanceOf(NotFoundError);
    });

    it('ConflictError', () => {
      const err = new ConflictError('conflict');
      expect(err).toBeInstanceOf(ConflictError);
      expect(err).not.toBeInstanceOf(ForbiddenError);
    });

    it('BusinessRuleError', () => {
      const err = new BusinessRuleError('violates rule X');
      expect(err).toBeInstanceOf(BusinessRuleError);
    });

    it('UnauthorizedError (default + custom message)', () => {
      expect(new UnauthorizedError()).toBeInstanceOf(UnauthorizedError);
      expect(new UnauthorizedError('no token')).toBeInstanceOf(
        UnauthorizedError,
      );
    });

    it('ForbiddenError (default + custom message)', () => {
      expect(new ForbiddenError()).toBeInstanceOf(ForbiddenError);
      expect(new ForbiddenError('not allowed')).toBeInstanceOf(ForbiddenError);
    });
  });

  describe('public contract is unchanged', () => {
    type Sample = {
      name: string;
      make: () => DomainError;
      expectedCode: string;
      expectedStatus: number;
      expectedName: string;
      expectedMessage: string;
    };

    const samples: Sample[] = [
      {
        name: 'ValidationError',
        make: () => new ValidationError('bad email'),
        expectedCode: 'VALIDATION_ERROR',
        expectedStatus: 400,
        expectedName: 'ValidationError',
        expectedMessage: 'bad email',
      },
      {
        name: 'NotFoundError',
        make: () => new NotFoundError('Request', 'req-1'),
        expectedCode: 'NOT_FOUND',
        expectedStatus: 404,
        expectedName: 'NotFoundError',
        expectedMessage: 'Request not found: req-1',
      },
      {
        name: 'ConflictError',
        make: () => new ConflictError('state mismatch'),
        expectedCode: 'CONFLICT',
        expectedStatus: 409,
        expectedName: 'ConflictError',
        expectedMessage: 'state mismatch',
      },
      {
        name: 'BusinessRuleError',
        make: () => new BusinessRuleError('rule X'),
        expectedCode: 'BUSINESS_RULE_VIOLATION',
        expectedStatus: 422,
        expectedName: 'BusinessRuleError',
        expectedMessage: 'rule X',
      },
      {
        name: 'UnauthorizedError (default)',
        make: () => new UnauthorizedError(),
        expectedCode: 'UNAUTHORIZED',
        expectedStatus: 401,
        expectedName: 'UnauthorizedError',
        expectedMessage: 'Authentication required',
      },
      {
        name: 'ForbiddenError (default)',
        make: () => new ForbiddenError(),
        expectedCode: 'FORBIDDEN',
        expectedStatus: 403,
        expectedName: 'ForbiddenError',
        expectedMessage: 'Insufficient permissions',
      },
    ];

    it.each(samples)(
      '$name exposes correct code/statusCode/name/message',
      (s) => {
        const err = s.make();
        expect(err.code).toBe(s.expectedCode);
        expect(err.statusCode).toBe(s.expectedStatus);
        expect(err.name).toBe(s.expectedName);
        expect(err.message).toBe(s.expectedMessage);
      },
    );
  });

  describe('bonus: error surfaces through async rejection (consumer pattern)', () => {
    it('a thrown ForbiddenError is caught with the right instanceof', async () => {
      // Returns a promise that rejects with a ForbiddenError instance.
      // (Avoid `async () => { throw ... }` to satisfy
      // @typescript-eslint/require-await.)
      const fail = (): Promise<never> =>
        Promise.reject(new ForbiddenError('no perms'));
      // Jest uses instanceof internally for toThrow(Constructor).
      await expect(fail()).rejects.toThrow(ForbiddenError);
      await expect(fail()).rejects.toThrow(DomainError);
      await expect(fail()).rejects.toThrow(/no perms/);
    });

    it('a thrown NotFoundError is caught with the right instanceof', async () => {
      const fail = (): Promise<never> =>
        Promise.reject(new NotFoundError('ReviewTask', '123'));
      await expect(fail()).rejects.toThrow(NotFoundError);
      await expect(fail()).rejects.toThrow(/ReviewTask not found: 123/);
    });
  });
});
