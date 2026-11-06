import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
export const CSRF_HEADER = 'x-requested-with';
export const CSRF_HEADER_VALUE = 'XMLHttpRequest';

/**
 * CSRF defence in depth (on top of SameSite=Lax cookies): state-changing
 * requests must carry a custom header. Browsers only allow a cross-site page
 * to set custom headers after a CORS preflight, which this API doesn't grant.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method)) return true;
    if (request.get(CSRF_HEADER) === CSRF_HEADER_VALUE) return true;
    throw new ForbiddenException('Missing CSRF header.');
  }
}
