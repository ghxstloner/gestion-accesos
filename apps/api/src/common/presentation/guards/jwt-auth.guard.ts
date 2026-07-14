import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AuthenticatedUser } from '../decorators/authenticated-user';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { UnauthorizedError } from '../../domain/errors/domain-error';

export interface JwtPayload {
  sub: string;
  email: string;
  companyId: string | null;
  roles: string[];
  permissions: string[];
}

@Injectable()
export class JwtAuthGuard {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'] as string | undefined;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid authorization header');
    }

    const token = authHeader.slice(7);
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(token);
    } catch {
      throw new UnauthorizedError('Invalid or expired access token');
    }

    const user: AuthenticatedUser = {
      userId: payload.sub,
      email: payload.email,
      companyId: payload.companyId,
      roles: payload.roles,
      permissions: payload.permissions,
      correlationId: request.correlationId,
    };
    request.user = user;

    return true;
  }
}
