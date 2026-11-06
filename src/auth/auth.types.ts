import type { Request } from 'express';
import type { Role } from '../generated/prisma/client.js';

/** Public shape of a user (never includes the password hash). */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  lastLoginAt: string | null;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  sessionToken?: string;
}

export interface SessionMeta {
  userAgent?: string;
  ip?: string;
}
