import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type {
  AuthenticatedRequest,
  AuthenticatedResponse,
} from '../decorators/authenticated-request';

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers['x-correlation-id'];
    const correlationId =
      typeof header === 'string' && header.length > 0 ? header : randomUUID();
    request.correlationId = correlationId;

    return next.handle().pipe(
      tap(() => {
        const response = context
          .switchToHttp()
          .getResponse<AuthenticatedResponse>();
        response.setHeader('x-correlation-id', correlationId);
      }),
    );
  }
}
