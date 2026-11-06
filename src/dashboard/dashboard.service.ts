import { Injectable } from '@nestjs/common';
import { QUESTIONS } from '../form-config/form-config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toSummary } from '../responses/responses.mapper.js';
import type { DashboardStats } from './dashboard.types.js';

const MAX_DAYS = 30;
const MIN_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

const isoDay = (date: Date): string => date.toISOString().slice(0, 10);
const startOfUtcDay = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(): Promise<DashboardStats> {
    const today = startOfUtcDay(new Date());
    const since = new Date(today.getTime() - (MAX_DAYS - 1) * DAY_MS);

    const [statusGroups, consented, certificatesDownloaded, downloadEvents, opcoGroups, recent, answerRows, dayRows, first] =
      await Promise.all([
        this.prisma.response.groupBy({ by: ['status'], _count: { _all: true } }),
        this.prisma.response.count({ where: { consent: 'Yes' } }),
        this.prisma.response.count({ where: { participantDownloads: { gt: 0 } } }),
        this.prisma.downloadEvent.count(),
        this.prisma.response.groupBy({ by: ['opco'], _count: { _all: true } }),
        this.prisma.response.findMany({ orderBy: { submittedAt: 'desc' }, take: 6 }),
        this.prisma.$queryRaw<{ question: string; option: string; count: number }[]>`
          SELECT key AS question, value AS option, COUNT(*)::int AS count
          FROM responses, jsonb_each_text(answers)
          GROUP BY key, value`,
        this.prisma.$queryRaw<{ day: string; count: number }[]>`
          SELECT to_char(submitted_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, COUNT(*)::int AS count
          FROM responses
          WHERE submitted_at >= ${since}
          GROUP BY 1`,
        this.prisma.response.aggregate({ _min: { submittedAt: true } }),
      ]);

    const byStatus = (status: 'pending' | 'approved' | 'rejected') =>
      statusGroups.find((g) => g.status === status)?._count._all ?? 0;
    const approved = byStatus('approved');
    const pending = byStatus('pending');
    const rejected = byStatus('rejected');
    const responses = approved + pending + rejected;
    const updateRequests = await this.prisma.responseUpdate.count({ where: { status: 'pending' } });

    return {
      totals: { responses, approved, pending, rejected, updateRequests, consented, certificatesDownloaded, downloadEvents },
      byDay: this.fillDays(dayRows, first._min.submittedAt, today),
      byOpco: opcoGroups
        .map((g) => ({ opco: g.opco, count: g._count._all }))
        .sort((a, b) => b.count - a.count || a.opco.localeCompare(b.opco)),
      questions: QUESTIONS.map((q) => {
        const counts = q.options.map((option) => ({
          option,
          count: answerRows.find((row) => row.question === q.id && row.option === option)?.count ?? 0,
        }));
        return {
          id: q.id,
          section: q.section,
          label: q.label,
          text: q.text,
          counts,
          answered: counts.reduce((sum, c) => sum + c.count, 0),
        };
      }),
      recent: recent.map(toSummary),
    };
  }

  /**
   * Zero-filled daily series from the first submission (or a week back,
   * whichever is earlier) to today, capped at MAX_DAYS.
   */
  private fillDays(rows: { day: string; count: number }[], firstSubmission: Date | null, today: Date) {
    const byDay = new Map(rows.map((r) => [r.day, r.count]));
    const earliest = firstSubmission ? startOfUtcDay(firstSubmission).getTime() : today.getTime();
    const span = Math.round((today.getTime() - earliest) / DAY_MS) + 1;
    const days = Math.min(MAX_DAYS, Math.max(MIN_DAYS, span));
    return Array.from({ length: days }, (_, i) => {
      const date = isoDay(new Date(today.getTime() - (days - 1 - i) * DAY_MS));
      return { date, count: byDay.get(date) ?? 0 };
    });
  }
}
