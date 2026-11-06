import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import type { EnvironmentVariables } from '../config/env.validation.js';
import type { User } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { SessionMeta } from './auth.types.js';

/** Only update last_seen_at this often, to avoid a write on every request. */
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

const hashToken = (token: string): string => createHash('sha256').update(token).digest('base64url');

@Injectable()
export class SessionsService {
  private readonly ttlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.ttlMs = config.get('SESSION_TTL_HOURS', { infer: true }) * 60 * 60 * 1000;
  }

  /** Create a session; returns the raw token for the cookie (only its hash is stored). */
  async create(userId: string, meta: SessionMeta): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.ttlMs);
    await this.prisma.$transaction([
      this.prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
      this.prisma.session.create({
        data: {
          id: hashToken(token),
          userId,
          expiresAt,
          userAgent: meta.userAgent?.slice(0, 255),
          ip: meta.ip,
        },
      }),
    ]);
    return { token, expiresAt };
  }

  /** The user for a valid, unexpired session token, or null. */
  async validate(token: string): Promise<User | null> {
    const session = await this.prisma.session.findUnique({
      where: { id: hashToken(token) },
      include: { user: true },
    });
    if (!session) return null;

    const now = Date.now();
    if (session.expiresAt.getTime() <= now) {
      await this.prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
      return null;
    }
    if (now - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
      await this.prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date(now) } });
    }
    return session.user;
  }

  async revoke(token: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { id: hashToken(token) } });
  }

  /** Sign the user out everywhere, optionally keeping the current session. */
  async revokeAllForUser(userId: string, keepToken?: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { userId, ...(keepToken && { id: { not: hashToken(keepToken) } }) },
    });
  }
}
