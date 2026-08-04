import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * SgaThrottlerGuard extends the standard {@link ThrottlerGuard} so we can
 * deterministically exempt health/readiness probes from rate limiting in
 * addition to the @SkipThrottle() decorator.
 *
 * Container orchestrators (k8s liveness/readiness probes, Docker
 * healthchecks, uptime robots) routinely poll these endpoints every second
 * or faster. If they shared buckets with API traffic they would burn through
 * the throttler quota and falsely start returning 429s, which causes
 * orchestrators to mark the pod as unhealthy and recycle it. This guard
 * guarantees that any path beginning with the configured global API prefix
 * plus `/health` (e.g. `/api/v1/health`, `/api/v1/health/ready`) is never
 * throttled regardless of decorator state.
 */
@Injectable()
export class SgaThrottlerGuard extends ThrottlerGuard {
  protected shouldSkip(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return Promise.resolve(true);
    }
    const req = context.switchToHttp().getRequest<{
      path?: string;
      url?: string;
    }>();
    const url: string = req?.path ?? req?.url ?? '';
    // Match `/health` and any sub-path under it (e.g. `/health/ready`),
    // tolerating both the routed `/api/v1/health` form and a bare `/health`.
    return Promise.resolve(/(^|\/)health(\/|$)/.test(url));
  }
}
