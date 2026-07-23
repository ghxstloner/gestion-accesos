import type { IncomingMessage } from 'node:http';
import type { AuthenticatedUser } from './authenticated-user';

/**
 * Minimal shape of the Express/NestJS HTTP request used by guards,
 * interceptors and param decorators, restricted to the fields actually
 * consumed by SGA middleware.
 *
 * NestJS' `ExecutionContext.switchToHttp().getRequest()` returns `any` at
 * the type level unless `@nestjs/platform-express` types are imported. We
 * avoid coupling common/ to Express here by declaring only the surface we
 * use — this is a structural type that is satisfied at runtime by the real
 * request object.
 *
 * Field conventions:
 *  - `headers`: lowercased case-insensitive HTTP header map.
 *  - `method`/`url`: set by Node's IncomingMessage; `path` alias is supported
 *    for Nest platform adapters.
 *  - `user`:      set by `JwtAuthGuard` after token verification.
 *  - `correlationId`: set by `CorrelationIdInterceptor`.
 *  - `user` may be undefined before the JWT guard runs.
 */
export interface AuthenticatedRequest extends Partial<IncomingMessage> {
  headers: Record<string, string | string[] | undefined>;
  method?: string;
  url?: string;
  /** Nest/Fastify reporting path; falls back to `url`. */
  path?: string;
  statusCode?: number;
  user?: AuthenticatedUser;
  correlationId?: string;
}

/**
 * Companion response surface used by interceptors that call `setHeader`.
 * Mirrors the minimal subset of Express.Response we touch.
 */
export interface AuthenticatedResponse {
  statusCode: number;
  setHeader(name: string, value: string | readonly string[]): void;
}
