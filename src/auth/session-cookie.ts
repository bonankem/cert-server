import type { CookieOptions, Request, Response } from 'express';

export const SESSION_COOKIE = 'stablenet_sid';

const baseOptions = (secure: boolean): CookieOptions => ({
  httpOnly: true, // not readable from JS
  sameSite: 'lax', // not sent on cross-site POSTs
  secure,
  path: '/',
});

export function setSessionCookie(res: Response, token: string, expiresAt: Date, secure: boolean): void {
  res.cookie(SESSION_COOKIE, token, { ...baseOptions(secure), expires: expiresAt });
}

export function clearSessionCookie(res: Response, secure: boolean): void {
  res.clearCookie(SESSION_COOKIE, baseOptions(secure));
}

export function readSessionCookie(req: Request): string | undefined {
  const value: unknown = req.cookies?.[SESSION_COOKIE];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
