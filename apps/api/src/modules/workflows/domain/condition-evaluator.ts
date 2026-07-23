import { ValidationError } from '../../../common/domain/errors/domain-error';
import {
  ALLOWED_CONDITION_FIELD_PREFIXES,
  CONDITION_OPERATORS,
  type ConditionExpression,
  type ConditionOperator,
  type EvaluationContext,
} from './workflow-definition.types';

const ATOMIC_OPS = new Set<ConditionOperator>([
  'EQUALS',
  'NOT_EQUALS',
  'IN',
  'NOT_IN',
  'GREATER_THAN',
  'GREATER_THAN_OR_EQUAL',
  'LESS_THAN',
  'LESS_THAN_OR_EQUAL',
  'EXISTS',
  'NOT_EXISTS',
]);

/**
 * Deterministic, side-effect-free condition evaluator.
 * Rejects unknown operators and fields outside the allow-list.
 */
export class ConditionEvaluator {
  static validate(expression: unknown, path = 'condition'): void {
    if (expression === null || expression === undefined) {
      throw new ValidationError(`${path}: condition is required`);
    }
    if (typeof expression !== 'object' || Array.isArray(expression)) {
      throw new ValidationError(`${path}: condition must be an object`);
    }
    const expr = expression as Record<string, unknown>;

    if (expr.op === 'AND' || expr.op === 'OR') {
      if (!Array.isArray(expr.conditions) || expr.conditions.length === 0) {
        throw new ValidationError(
          `${path}: ${expr.op} requires a non-empty conditions array`,
        );
      }
      expr.conditions.forEach((c, i) =>
        this.validate(c, `${path}.conditions[${i}]`),
      );
      return;
    }

    if (expr.op === 'NOT') {
      if (!expr.condition) {
        throw new ValidationError(`${path}: NOT requires condition`);
      }
      this.validate(expr.condition, `${path}.condition`);
      return;
    }

    if (typeof expr.field !== 'string' || !expr.field.trim()) {
      throw new ValidationError(`${path}: field is required`);
    }
    this.assertAllowedField(expr.field, path);

    if (
      typeof expr.operator !== 'string' ||
      !ATOMIC_OPS.has(expr.operator as ConditionOperator)
    ) {
      throw new ValidationError(
        `${path}: invalid operator ${this.stringifyValue(expr.operator)}. Allowed: ${[...ATOMIC_OPS].join(', ')}`,
      );
    }

    const op = expr.operator as ConditionOperator;
    if (op === 'IN' || op === 'NOT_IN') {
      if (!Array.isArray(expr.value)) {
        throw new ValidationError(`${path}: ${op} requires an array value`);
      }
    } else if (op !== 'EXISTS' && op !== 'NOT_EXISTS') {
      if (!('value' in expr)) {
        throw new ValidationError(`${path}: value is required for ${op}`);
      }
    }
  }

  static evaluate(
    expression: ConditionExpression | null | undefined,
    ctx: EvaluationContext,
  ): boolean {
    if (!expression) return true;
    this.validate(expression);
    return this.eval(expression, ctx);
  }

  private static eval(
    expression: ConditionExpression,
    ctx: EvaluationContext,
  ): boolean {
    if ('op' in expression && expression.op === 'AND') {
      return expression.conditions.every((c) => this.eval(c, ctx));
    }
    if ('op' in expression && expression.op === 'OR') {
      return expression.conditions.some((c) => this.eval(c, ctx));
    }
    if ('op' in expression && expression.op === 'NOT') {
      return !this.eval(expression.condition, ctx);
    }

    if (!('field' in expression)) {
      throw new ValidationError('Invalid condition expression shape');
    }

    const actual = this.resolveField(expression.field, ctx);
    const op = expression.operator;
    const expected = expression.value;

    switch (op) {
      case 'EXISTS':
        return actual !== undefined && actual !== null;
      case 'NOT_EXISTS':
        return actual === undefined || actual === null;
      case 'EQUALS':
        return this.looseEqual(actual, expected);
      case 'NOT_EQUALS':
        return !this.looseEqual(actual, expected);
      case 'IN':
        return Array.isArray(expected)
          ? expected.some((v) => this.looseEqual(actual, v))
          : false;
      case 'NOT_IN':
        return Array.isArray(expected)
          ? !expected.some((v) => this.looseEqual(actual, v))
          : true;
      case 'GREATER_THAN':
        return this.toNumber(actual) > this.toNumber(expected);
      case 'GREATER_THAN_OR_EQUAL':
        return this.toNumber(actual) >= this.toNumber(expected);
      case 'LESS_THAN':
        return this.toNumber(actual) < this.toNumber(expected);
      case 'LESS_THAN_OR_EQUAL':
        return this.toNumber(actual) <= this.toNumber(expected);
      default:
        throw new ValidationError('Unsupported operator: ' + String(op));
    }
  }

  static assertAllowedField(field: string, path = 'field'): void {
    // Reject path traversal / prototype pollution / bracket notation patterns
    // FIRST, so attackers can't smuggle dangerous characters past the prefix check.
    if (
      field.includes('__proto__') ||
      field.includes('constructor') ||
      field.includes('prototype') ||
      field.includes('[') ||
      field.includes(']')
    ) {
      throw new ValidationError(`${path}: field path is not safe: ${field}`);
    }
    const allowed = ALLOWED_CONDITION_FIELD_PREFIXES.some((p) =>
      field.startsWith(p),
    );
    if (!allowed) {
      throw new ValidationError(
        `${path}: field "${field}" is not allowed. Prefixes: ${ALLOWED_CONDITION_FIELD_PREFIXES.join(', ')}`,
      );
    }
  }

  static resolveField(field: string, ctx: EvaluationContext): unknown {
    this.assertAllowedField(field);
    const parts = field.split('.');
    let current: unknown = ctx;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }

  private static stringifyValue(value: unknown): string {
    if (value === undefined) return 'undefined';
    if (value === null) return 'null';
    if (typeof value === 'symbol') return value.toString();
    if (typeof value === 'string') return value;
    if (
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'bigint'
    ) {
      return String(value);
    }
    if (typeof value === 'object' || typeof value === 'function') {
      try {
        const json = JSON.stringify(value);
        if (typeof json === 'string') return json;
      } catch {
        // Fall through to fallback below.
      }
      const fallback = Object.prototype.toString.call(value) as string;
      return fallback;
    }
    return 'undefined';
  }

  private static looseEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a == null || b == null) return a === b;
    if (typeof a === 'number' || typeof b === 'number') {
      return Number(a) === Number(b);
    }
    return this.stringifyValue(a) === this.stringifyValue(b);
  }

  private static toNumber(v: unknown): number {
    const n = typeof v === 'number' ? v : Number(v);
    if (Number.isNaN(n)) {
      throw new ValidationError(
        `Cannot compare non-numeric value: ${this.stringifyValue(v)}`,
      );
    }
    return n;
  }

  /** Expose operators for documentation / tests */
  static allowedOperators(): readonly string[] {
    return CONDITION_OPERATORS;
  }
}
