import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationEmailsDto } from './dto/notification-emails.dto.js';

const SINGLETON_ID = 1;

export interface NotificationEmailsView {
  /** Saved in the dashboard. */
  emails: string[];
  /** From ADMIN_NOTIFY_EMAILS, used only while `emails` is empty. */
  fallback: string[];
  /** False when the server has no email (AWS) keys, so nothing is sent. */
  emailEnabled: boolean;
}

/** Admin-only (global SessionAuthGuard): who is emailed about new submissions and update requests. */
@Controller('admin/notification-emails')
export class NotificationEmailsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  @Get()
  async get(): Promise<NotificationEmailsView> {
    const settings = await this.prisma.certificateSettings.findUnique({
      where: { id: SINGLETON_ID },
      select: { notifyEmails: true },
    });
    return this.view(settings?.notifyEmails ?? []);
  }

  @Put()
  async update(@Body() { emails }: NotificationEmailsDto): Promise<NotificationEmailsView> {
    const saved = await this.prisma.certificateSettings.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, notifyEmails: emails },
      update: { notifyEmails: emails },
      select: { notifyEmails: true },
    });
    return this.view(saved.notifyEmails);
  }

  /** Send a test email to everyone who currently gets notifications. */
  @Throttle({ default: { limit: 5, ttl: 15 * 60 * 1000 } })
  @Post('test')
  async test(): Promise<{ sent: string[]; failed: string[] }> {
    const recipients = await this.mail.adminRecipientList();
    const results = await Promise.all(
      recipients.map(async (to) => ({
        to,
        ok: await this.mail.send(to, { kind: 'admin_test', dashboardUrl: `${this.mail.appUrl}/admin` }),
      })),
    );
    return { sent: results.filter((r) => r.ok).map((r) => r.to), failed: results.filter((r) => !r.ok).map((r) => r.to) };
  }

  private view(emails: string[]): NotificationEmailsView {
    return { emails, fallback: this.mail.fallbackAdminRecipients, emailEnabled: this.mail.enabled };
  }
}
