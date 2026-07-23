import { ConditionEvaluator } from './condition-evaluator';
import type {
  ConditionExpression,
  ConditionOperator,
  EvaluationContext,
} from './workflow-definition.types';

describe('ConditionEvaluator', () => {
  describe('validate', () => {
    it('throws on disallowed field prefix', () => {
      expect(() =>
        ConditionEvaluator.validate({
          field: 'password',
          operator: 'EQUALS',
          value: 'x',
        }),
      ).toThrow('not allowed');
    });

    it('throws on unknown operator', () => {
      const invalidOperator = 'BANANA' as unknown as ConditionOperator;
      expect(() =>
        ConditionEvaluator.validate({
          field: 'request.status',
          operator: invalidOperator,
          value: 'x',
        }),
      ).toThrow('invalid operator');
    });

    it('throws ON path traversal patterns', () => {
      expect(() =>
        ConditionEvaluator.validate({
          field: 'request.__proto__',
          operator: 'EXISTS',
        }),
      ).toThrow('not safe');
      expect(() =>
        ConditionEvaluator.validate({
          field: 'request[status]',
          operator: 'EXISTS',
        }),
      ).toThrow('not safe');
    });

    it('throws on AND without conditions array', () => {
      expect(() =>
        ConditionEvaluator.validate({
          op: 'AND',
          conditions: [],
        }),
      ).toThrow('non-empty');
      expect(() => ConditionEvaluator.validate({ op: 'AND' } as any)).toThrow(
        'non-empty',
      );
    });

    it('throws on NOT without condition', () => {
      expect(() => ConditionEvaluator.validate({ op: 'NOT' } as any)).toThrow(
        'NOT requires condition',
      );
    });

    it('throws on IN without array value', () => {
      expect(() =>
        ConditionEvaluator.validate({
          field: 'request.type',
          operator: 'IN',
          value: 'NOPE',
        }),
      ).toThrow('array');
    });

    it('accepts a valid atomic condition', () => {
      expect(() =>
        ConditionEvaluator.validate({
          field: 'request.status',
          operator: 'EQUALS',
          value: 'DRAFT',
        }),
      ).not.toThrow();
    });
  });

  describe('evaluate', () => {
    const ctx: EvaluationContext = {
      request: { status: 'UNDER_REVIEW', type: 'PERMANENT_CARD', count: 3 },
      company: { name: 'AAC' },
      creatorUser: { email: 'x@y.com' },
    };

    it('EQUALS / NOT_EQUALS', () => {
      expect(
        ConditionEvaluator.evaluate(
          {
            field: 'request.status',
            operator: 'EQUALS',
            value: 'UNDER_REVIEW',
          },
          ctx,
        ),
      ).toBe(true);
      expect(
        ConditionEvaluator.evaluate(
          {
            field: 'request.status',
            operator: 'NOT_EQUALS',
            value: 'DRAFT',
          },
          ctx,
        ),
      ).toBe(true);
    });

    it('IN / NOT_IN', () => {
      expect(
        ConditionEvaluator.evaluate(
          {
            field: 'request.type',
            operator: 'IN',
            value: ['PERMANENT_CARD', 'TEMPORARY_PERSON'],
          },
          ctx,
        ),
      ).toBe(true);
      expect(
        ConditionEvaluator.evaluate(
          {
            field: 'request.type',
            operator: 'NOT_IN',
            value: ['TEMPORARY_VEHICLE'],
          },
          ctx,
        ),
      ).toBe(true);
    });

    it('numeric comparisons', () => {
      expect(
        ConditionEvaluator.evaluate(
          { field: 'request.count', operator: 'GREATER_THAN', value: 2 },
          ctx,
        ),
      ).toBe(true);
      expect(
        ConditionEvaluator.evaluate(
          {
            field: 'request.count',
            operator: 'LESS_THAN_OR_EQUAL',
            value: 3,
          },
          ctx,
        ),
      ).toBe(true);
    });

    it('EXISTS / NOT_EXISTS', () => {
      expect(
        ConditionEvaluator.evaluate(
          { field: 'request.status', operator: 'EXISTS' },
          ctx,
        ),
      ).toBe(true);
      expect(
        ConditionEvaluator.evaluate(
          { field: 'request.missing', operator: 'NOT_EXISTS' },
          ctx,
        ),
      ).toBe(true);
    });

    it('AND / OR / NOT composition', () => {
      const e: ConditionExpression = {
        op: 'AND',
        conditions: [
          {
            field: 'request.status',
            operator: 'EQUALS',
            value: 'UNDER_REVIEW',
          },
          {
            op: 'OR',
            conditions: [
              { field: 'company.name', operator: 'EQUALS', value: 'AAC' },
              { field: 'company.name', operator: 'EQUALS', value: 'COPA' },
            ],
          },
          {
            op: 'NOT',
            condition: {
              field: 'request.count',
              operator: 'GREATER_THAN',
              value: 100,
            },
          },
        ],
      };
      expect(ConditionEvaluator.evaluate(e, ctx)).toBe(true);
    });

    it('returns true for null expression', () => {
      expect(ConditionEvaluator.evaluate(null, ctx)).toBe(true);
    });

    it('resolves deep nested fields', () => {
      const ctx2: EvaluationContext = {
        request: { company: { id: 'cmp-1' } },
      };
      expect(
        ConditionEvaluator.evaluate(
          {
            field: 'request.company.id',
            operator: 'EQUALS',
            value: 'cmp-1',
          },
          ctx2,
        ),
      ).toBe(true);
    });

    it('loose equal string vs number', () => {
      expect(
        ConditionEvaluator.evaluate(
          { field: 'request.count', operator: 'EQUALS', value: '3' },
          ctx,
        ),
      ).toBe(true);
    });
  });
});
