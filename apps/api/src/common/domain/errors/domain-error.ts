export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;

  constructor(message: string) {
    super(message);
    // Restore the prototype chain so `instanceof` works correctly for every
    // subclass. When a subclass `extends Error` (transitively via this class)
    // is instantiated with `new`, the compiler-emitted prototype chain is
    // broken by the ES5-era `Error` machinery: `this.__proto__` ends up
    // pointing to `Error.prototype` instead of the subclass prototype, so
    // `new ForbiddenError(...) instanceof ForbiddenError` returns false.
    //
    // The previous implementation hard-collapsed every subclass instance to
    // `DomainError.prototype`, which made ONLY `instanceof DomainError` work
    // — `instanceof ForbiddenError`, `instanceof NotFoundError`, etc. all
    // returned false (the prototype was overwritten even when called by a
    // subclass). Using `new.target.prototype` instead resolves to the actual
    // constructor that was invoked via `new`, restoring the proper chain:
    //   ForbiddenError.prototype -> DomainError.prototype -> Error.prototype
    // so BOTH `instanceof DomainError` AND `instanceof ForbiddenError` succeed.
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = this.constructor.name;
  }
}

export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;
}

export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';
  readonly statusCode = 404;

  constructor(resource: string, id?: string) {
    super(id ? `${resource} not found: ${id}` : `${resource} not found`);
  }
}

export class ConflictError extends DomainError {
  readonly code = 'CONFLICT';
  readonly statusCode = 409;
}

export class BusinessRuleError extends DomainError {
  readonly code = 'BUSINESS_RULE_VIOLATION';
  readonly statusCode = 422;
}

export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED';
  readonly statusCode = 401;

  constructor(message = 'Authentication required') {
    super(message);
  }
}

export class ForbiddenError extends DomainError {
  readonly code = 'FORBIDDEN';
  readonly statusCode = 403;

  constructor(message = 'Insufficient permissions') {
    super(message);
  }
}
