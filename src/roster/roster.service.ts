import { Injectable } from '@nestjs/common';
import type { RosterEntry } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { normalizeEmail } from '../users/users.service.js';
import type { RosterEntryInput } from './dto/add-roster-entries.dto.js';

export interface RosterEntryView {
  id: string;
  name: string;
  email: string | null;
  createdAt: string;
}

/**
 * Match key for names: lower-case, accents removed, punctuation dropped and
 * words sorted, so "DOE, John" and "John Doé" both become "doe john".
 */
export const nameKey = (name: string): string =>
  name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ');

const toView = (e: RosterEntry): RosterEntryView => ({
  id: e.id,
  name: e.name,
  email: e.email,
  createdAt: e.createdAt.toISOString(),
});

@Injectable()
export class RosterService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<RosterEntryView[]> {
    const rows = await this.prisma.rosterEntry.findMany({ orderBy: [{ name: 'asc' }, { email: 'asc' }] });
    return rows.map(toView);
  }

  /** Add entries, skipping duplicates (same email, or same name when no email is given). */
  async add(entries: RosterEntryInput[], userId: string): Promise<{ added: number; skipped: number }> {
    let added = 0;
    const seenEmails = new Set<string>();
    const seenNames = new Set<string>();

    for (const entry of entries) {
      const name = entry.name?.replace(/\s+/g, ' ').trim() ?? '';
      const email = entry.email ? normalizeEmail(entry.email) : null;
      const key = nameKey(name);
      if (!email && !key) continue;

      if (email) {
        if (seenEmails.has(email)) continue;
        seenEmails.add(email);
        const existing = await this.prisma.rosterEntry.findUnique({ where: { email } });
        if (existing) {
          // Fill in a missing name, but never count it as new.
          if (!existing.name && name) {
            await this.prisma.rosterEntry.update({ where: { id: existing.id }, data: { name, nameKey: key } });
          }
          continue;
        }
      } else {
        if (seenNames.has(key)) continue;
        seenNames.add(key);
        if (await this.prisma.rosterEntry.findFirst({ where: { nameKey: key } })) continue;
      }

      await this.prisma.rosterEntry.create({ data: { name, email, nameKey: key, createdById: userId } });
      added++;
    }

    return { added, skipped: entries.length - added };
  }

  async remove(id: string): Promise<void> {
    await this.prisma.rosterEntry.delete({ where: { id } });
  }

  async clear(): Promise<number> {
    const { count } = await this.prisma.rosterEntry.deleteMany();
    return count;
  }

  /** Is this participant on the list? Email is checked first, then the name. */
  async isExpected(email: string | null | undefined, name: string): Promise<boolean> {
    if (email) {
      const byEmail = await this.prisma.rosterEntry.findUnique({ where: { email: normalizeEmail(email) } });
      if (byEmail) return true;
    }
    const key = nameKey(name);
    if (!key) return false;
    return (await this.prisma.rosterEntry.count({ where: { nameKey: key } })) > 0;
  }
}
