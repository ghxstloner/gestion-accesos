import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const { method, path } = request;
    const userId = request.user?.userId;
    const correlationId = request.correlationId;
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse();
        const duration = Date.now() - start;
        const meta = `${method} ${path} ${response.statusCode} ${duration}ms`;
        const ctx = userId ? `[user:${userId}]` : '[anonymous]';
        this.logger.log(
          `${meta} ${ctx}${correlationId ? ` [cid:${correlationId}]` : ''}`,
        );
      }),
    );
  }
}
