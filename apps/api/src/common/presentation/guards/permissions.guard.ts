import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedUser } from '../decorators/authenticated-user';
import type { AuthenticatedRequest } from '../decorators/authenticated-request';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { ForbiddenError } from '../../domain/errors/domain-error';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user: AuthenticatedUser | undefined = request.user;
    if (!user) throw new ForbiddenError();

    const hasAll = required.every((p) => user.permissions.includes(p));
    if (!hasAll) {
      throw new ForbiddenError(`Required permissions: ${required.join(', ')}`);
    }
    return true;
  }
}
