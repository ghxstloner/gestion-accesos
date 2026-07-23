import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '../../../generated/prisma/client';
import { DomainError } from '../../domain/errors/domain-error';

interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  code: string;
  detail: string;
  instance: string;
  correlationId?: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const correlationId =
      (request.headers['x-correlation-id'] as string) || undefined;

    const problem = this.mapToProblemDetail(
      exception,
      request.path,
      correlationId,
    );

    if (problem.status >= 500) {
      this.logger.error(
        `${request.method} ${request.path} → ${problem.status} ${problem.code}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else if (problem.status >= 400) {
      this.logger.warn(
        `${request.method} ${request.path} → ${problem.status} ${problem.code}: ${problem.detail}`,
      );
    }

    response.status(problem.status).json(problem);
  }

  private mapToProblemDetail(
    exception: unknown,
    path: string,
    correlationId?: string,
  ): ProblemDetail {
    const instance = path;

    if (exception instanceof DomainError) {
      return {
        type: `https://sga.errors/${exception.code.toLowerCase()}`,
        title: exception.name,
        status: exception.statusCode,
        code: exception.code,
        detail: exception.message,
        instance,
        correlationId,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const detail = extractResponseMessage(res);

      return {
        type: `https://sga.errors/http-${status}`,
        title: exception.name,
        status,
        code: `HTTP_${status}`,
        detail: detail ?? exception.message,
        instance,
        correlationId,
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.mapPrismaError(exception, instance, correlationId);
    }

    if (exception instanceof Error && exception.message.includes('argon2')) {
      return {
        type: 'https://sga.errors/internal-error',
        title: 'Internal Error',
        status: 500,
        code: 'INTERNAL_ERROR',
        detail: 'An internal error occurred',
        instance,
        correlationId,
      };
    }

    return {
      type: 'https://sga.errors/internal-error',
      title: 'Internal Error',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      detail: 'An unexpected error occurred',
      instance,
      correlationId,
    };
  }

  private mapPrismaError(
    exception: Prisma.PrismaClientKnownRequestError,
    instance: string,
    correlationId?: string,
  ): ProblemDetail {
    switch (exception.code) {
      case 'P2002': {
        const metaTarget = exception.meta?.target;
        const target =
          (Array.isArray(metaTarget)
            ? (metaTarget as string[]).join(', ')
            : 'field') || 'field';
        return {
          type: 'https://sga.errors/conflict',
          title: 'Conflict',
          status: 409,
          code: 'DUPLICATE_VALUE',
          detail: `A record with this ${target} already exists.`,
          instance,
          correlationId,
        };
      }
      case 'P2025':
        return {
          type: 'https://sga.errors/not-found',
          title: 'Not Found',
          status: 404,
          code: 'NOT_FOUND',
          detail: 'The requested record was not found.',
          instance,
          correlationId,
        };
      default:
        return {
          type: 'https://sga.errors/internal-error',
          title: 'Database Error',
          status: 500,
          code: 'DATABASE_ERROR',
          detail: 'A database error occurred',
          instance,
          correlationId,
        };
    }
  }
}

/**
 * Safely narrow a NestJS exception response and extract its `message` field.
 * The response can be a plain string, an object exposing `message` (string or
 * array of validation messages), or anything else.
 */
function extractResponseMessage(res: unknown): string | undefined {
  if (typeof res === 'string') return res;
  if (res && typeof res === 'object') {
    const msg = (res as { message?: unknown }).message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg) && msg.every((m) => typeof m === 'string')) {
      return msg.join(', ');
    }
  }
  return undefined;
}
