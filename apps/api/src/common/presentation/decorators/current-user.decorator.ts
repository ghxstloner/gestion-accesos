import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { AuthenticatedUser } from './authenticated-user';
import type { AuthenticatedRequest } from './authenticated-request';

export const CurrentUser = createParamDecorator(
  (
    data: keyof AuthenticatedUser | undefined,
    ctx: ExecutionContext,
  ):
    | AuthenticatedUser
    | AuthenticatedUser[keyof AuthenticatedUser]
    | undefined => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
