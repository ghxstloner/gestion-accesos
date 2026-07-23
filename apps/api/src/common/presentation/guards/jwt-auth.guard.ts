import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CanActivate } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthenticatedUser } from '../decorators/authenticated-user';
import type { AuthenticatedRequest } from '../decorators/authenticated-request';
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
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = this.getRequest(context);
    const rawAuthHeader = request.headers.authorization;
    const authHeader = Array.isArray(rawAuthHeader)
      ? rawAuthHeader[0]
      : rawAuthHeader;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid authorization header');
    }

    const token = authHeader.slice('Bearer '.length);
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

  private getRequest(context: ExecutionContext): AuthenticatedRequest {
    const http = context.switchToHttp();
    return http.getRequest<AuthenticatedRequest>();
  }
}
