import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { renderEmail, type EmailContent } from './mail.templates.js';

/**
 * Sends transactional email through Amazon SES.
 *
 * Sending never throws: a failed email is logged and the request that caused
 * it (a submission, an approval) still succeeds. Without AWS keys the service
 * is disabled and only logs what it would have sent — handy in development.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly client: SESv2Client | null;
  private readonly from: string;
  private readonly adminRecipients: string[];
  readonly appUrl: string;

  constructor(
    config: ConfigService<EnvironmentVariables, true>,
    private readonly prisma: PrismaService,
  ) {
    const region = config.get('AWS_REGION', { infer: true });
    const accessKeyId = config.get('AWS_ACCESS_KEY_ID', { infer: true });
    const secretAccessKey = config.get('AWS_SECRET_ACCESS_KEY', { infer: true });

    this.from = config.get('MAIL_FROM', { infer: true });
    this.appUrl = config.get('APP_URL', { infer: true }).replace(/\/+$/, '');
    this.adminRecipients = (config.get('ADMIN_NOTIFY_EMAILS', { infer: true }) ?? '')
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);
    this.client =
      region && accessKeyId && secretAccessKey
        ? new SESv2Client({ region, credentials: { accessKeyId, secretAccessKey } })
        : null;

    if (!this.client) this.logger.warn('Email is disabled: set AWS_REGION, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.');
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  /** Send one email; resolves to whether it was accepted by SES. */
  async send(to: string, content: EmailContent): Promise<boolean> {
    const { subject, html, text } = renderEmail(content);

    if (!this.client) {
      this.logger.log(`[email disabled] to=${to} subject="${subject}"`);
      return false;
    }

    try {
      await this.client.send(
        new SendEmailCommand({
          FromEmailAddress: this.from,
          Destination: { ToAddresses: [to] },
          Content: {
            Simple: {
              Subject: { Data: subject, Charset: 'UTF-8' },
              Body: { Html: { Data: html, Charset: 'UTF-8' }, Text: { Data: text, Charset: 'UTF-8' } },
            },
          },
        }),
      );
      return true;
    } catch (error) {
      this.logger.error(`Email to ${to} failed: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /** Fire-and-forget variant for request handlers. */
  sendInBackground(to: string | null | undefined, content: EmailContent): void {
    if (!to) return;
    void this.send(to, content);
  }

  /** Addresses from ADMIN_NOTIFY_EMAILS (used when none are set in the dashboard). */
  get fallbackAdminRecipients(): string[] {
    return this.adminRecipients;
  }

  /**
   * Who gets admin notifications: the list saved in Settings, or
   * ADMIN_NOTIFY_EMAILS when that list is empty.
   */
  async adminRecipientList(): Promise<string[]> {
    const settings = await this.prisma.certificateSettings.findUnique({
      where: { id: 1 },
      select: { notifyEmails: true },
    });
    return settings?.notifyEmails.length ? settings.notifyEmails : this.adminRecipients;
  }

  /** Tell the admins (fire-and-forget; no-op when nobody is set). */
  notifyAdmins(content: Extract<EmailContent, { kind: 'admin_request' }>): void {
    void this.adminRecipientList()
      .then((recipients) => recipients.forEach((to) => this.sendInBackground(to, content)))
      .catch((error: unknown) =>
        this.logger.error(`Admin notification failed: ${error instanceof Error ? error.message : String(error)}`),
      );
  }
}
