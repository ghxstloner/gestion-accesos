import { Injectable, PipeTransform } from '@nestjs/common';

/**
 * Treat blank form controls as omitted values before DTO validation.
 * Required validators still fail because their value becomes undefined, while
 * `@IsOptional()` fields no longer fail format validators for an empty input.
 */
@Injectable()
export class EmptyStringToUndefinedPipe implements PipeTransform {
  transform(value: unknown): unknown {
    return this.normalize(value);
  }

  private normalize(value: unknown): unknown {
    if (typeof value === 'string') {
      return value.trim() === '' ? undefined : value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.normalize(item));
    }

    if (
      value &&
      typeof value === 'object' &&
      (Object.getPrototypeOf(value) === Object.prototype ||
        Object.getPrototypeOf(value) === null)
    ) {
      for (const [key, item] of Object.entries(value)) {
        (value as Record<string, unknown>)[key] = this.normalize(item);
      }
    }

    return value;
  }
}
