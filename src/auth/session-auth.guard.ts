import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator.js';
import { Role } from '../generated/prisma/client.js';
import { toAuthUser } from '../users/users.service.js';
import type { AuthenticatedRequest } from './auth.types.js';
import { readSessionCookie } from './session-cookie.js';
import { SessionsService } from './sessions.service.js';

/**
 * Global guard: every route requires a signed-in admin unless marked @Public().
 * (ADMIN is the only role today; the check keeps future roles out by default.)
 */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = readSessionCookie(request);
    const user = token ? await this.sessions.validate(token) : null;
    if (!token || !user) throw new UnauthorizedException('Please sign in.');
    if (user.role !== Role.ADMIN) throw new ForbiddenException('Admins only.');

    request.user = toAuthUser(user);
    request.sessionToken = token;
    return true;
  }
}
