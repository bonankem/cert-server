/** Participant emails. Plain, table-based HTML so it renders in Outlook and Gmail alike. */

const BRAND_BLUE = '#0072ce';
const INK = '#0b1f4b';
const MUTED = '#4a5878';
const COURSE = 'StableNet® Training';

export type EmailContent =
  /** `resubmitted`: an earlier, not-yet-approved submission was replaced. */
  | { kind: 'received'; name: string; statusUrl: string; resubmitted?: boolean }
  | { kind: 'approved'; name: string; statusUrl: string; certId: string }
  | { kind: 'rejected'; name: string; statusUrl: string; formUrl: string; reason: string | null }
  | { kind: 'update_received'; name: string; statusUrl: string }
  | { kind: 'update_approved'; name: string; statusUrl: string; certId: string }
  | { kind: 'update_rejected'; name: string; statusUrl: string; reason: string | null }
  | {
      kind: 'admin_request';
      request: 'new' | 'resubmitted' | 'update';
      name: string;
      email: string;
      opco: string;
      reviewUrl: string;
    }
  | { kind: 'admin_test'; dashboardUrl: string };

interface Rendered {
  subject: string;
  html: string;
  text: string;
}

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? name;

function layout(heading: string, paragraphs: string[], button: { label: string; url: string } | null): string {
  const body = paragraphs
    .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${MUTED};">${p}</p>`)
    .join('');
  const cta = button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 8px;"><tr><td style="border-radius:8px;background:${BRAND_BLUE};">
         <a href="${escapeHtml(button.url)}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(button.label)}</a>
       </td></tr></table>
       <p style="margin:12px 0 0;font-size:12px;line-height:1.5;color:${MUTED};">Or copy this link: <a href="${escapeHtml(button.url)}" style="color:${BRAND_BLUE};word-break:break-all;">${escapeHtml(button.url)}</a></p>`
    : '';

  return `<!doctype html><html><body style="margin:0;padding:0;background:#eef3fb;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef3fb;padding:28px 12px;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #dbe5f4;">
    <tr><td style="background:#0a347a;padding:18px 28px;font-size:13px;font-weight:700;letter-spacing:.06em;color:#9fd8ff;text-transform:uppercase;">Zoracom · ${COURSE}</td></tr>
    <tr><td style="padding:28px;">
      <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:${INK};">${heading}</h1>
      ${body}${cta}
    </td></tr>
    <tr><td style="padding:16px 28px;border-top:1px solid #e6edf7;font-size:12px;color:${MUTED};">
      Sent by Zoracom for the ${COURSE}. This mailbox is not monitored.
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}

export function renderEmail(content: EmailContent): Rendered {
  if (content.kind === 'admin_test') {
    return {
      subject: '[StableNet admin] Test notification',
      html: layout(
        'Admin notifications are working',
        [
          'This address is on the notification list for the StableNet Training certificates dashboard.',
          'You will get an email here whenever a certificate is waiting for approval or a participant asks to update an approved one.',
        ],
        { label: 'Open the dashboard', url: content.dashboardUrl },
      ),
      text: `Admin notifications are working.\n\nYou will get an email here whenever a certificate is waiting for approval or a participant asks to update an approved one.\n\nDashboard: ${content.dashboardUrl}\n`,
    };
  }

  const name = escapeHtml(firstName(content.name));

  switch (content.kind) {
    case 'received':
      return {
        subject: content.resubmitted ? `We received your updated ${COURSE} feedback` : `We received your ${COURSE} feedback`,
        html: layout(
          `Thank you, ${name}`,
          [
            content.resubmitted
              ? 'Your updated feedback has replaced your earlier submission. Your certificate is now waiting for approval by the training team.'
              : 'Your feedback has been received. Your certificate is now waiting for approval by the training team.',
            'We will email you again as soon as it is approved. You can also check its status at any time with your private link below.',
          ],
          { label: 'Check my certificate status', url: content.statusUrl },
        ),
        text: `Thank you, ${firstName(content.name)}.\n\nYour feedback has been received. Your certificate is waiting for approval by the training team. We will email you when it is approved.\n\nCheck its status: ${content.statusUrl}\n`,
      };

    case 'approved':
      return {
        subject: `Your ${COURSE} certificate is ready`,
        html: layout(
          `Your certificate is ready, ${name}`,
          [
            `Your ${COURSE} certificate has been approved.`,
            `Certificate ID: <strong style="color:${INK};font-family:Consolas,monospace;">${escapeHtml(content.certId)}</strong>`,
            'Open your private link to view and download it as a PDF.',
          ],
          { label: 'Download my certificate', url: content.statusUrl },
        ),
        text: `Your certificate is ready, ${firstName(content.name)}.\n\nYour ${COURSE} certificate has been approved (certificate ID ${content.certId}).\n\nDownload it: ${content.statusUrl}\n`,
      };

    case 'rejected': {
      const reason = content.reason ? escapeHtml(content.reason) : null;
      return {
        subject: `Your ${COURSE} certificate was not approved`,
        html: layout(
          `About your certificate, ${name}`,
          [
            'The training team could not approve your certificate request.',
            ...(reason ? [`Reason: <strong style="color:${INK};">${reason}</strong>`] : []),
            'If this was a mistake, for example a misspelled name, you can submit the form again.',
          ],
          { label: 'Submit the form again', url: content.formUrl },
        ),
        text: `About your certificate, ${firstName(content.name)}.\n\nThe training team could not approve your certificate request.${content.reason ? `\nReason: ${content.reason}` : ''}\n\nYou can submit the form again: ${content.formUrl}\n`,
      };
    }

    case 'update_received':
      return {
        subject: `We received your ${COURSE} update request`,
        html: layout(
          `Update request received, ${name}`,
          [
            'You already have a certificate, so the changes you just submitted were sent to the training team for approval. No second certificate is created.',
            'Your current certificate stays valid until the update is approved. We will email you when it has been reviewed.',
          ],
          { label: 'Check my certificate', url: content.statusUrl },
        ),
        text: `Update request received, ${firstName(content.name)}.\n\nYou already have a certificate, so your changes were sent to the training team for approval. Your current certificate stays valid until then.\n\nCheck its status: ${content.statusUrl}\n`,
      };

    case 'update_approved':
      return {
        subject: `Your ${COURSE} certificate has been updated`,
        html: layout(
          `Your certificate has been updated, ${name}`,
          [
            'The training team approved your update request. Your certificate now shows the new details.',
            `Certificate ID (unchanged): <strong style="color:${INK};font-family:Consolas,monospace;">${escapeHtml(content.certId)}</strong>`,
          ],
          { label: 'Download my updated certificate', url: content.statusUrl },
        ),
        text: `Your certificate has been updated, ${firstName(content.name)}.\n\nYour update request was approved (certificate ID ${content.certId}, unchanged).\n\nDownload it: ${content.statusUrl}\n`,
      };

    case 'update_rejected': {
      const reason = content.reason ? escapeHtml(content.reason) : null;
      return {
        subject: `Your ${COURSE} update request was not approved`,
        html: layout(
          `About your update request, ${name}`,
          [
            'The training team did not approve the changes you asked for.',
            ...(reason ? [`Reason: <strong style="color:${INK};">${reason}</strong>`] : []),
            'Your existing certificate is unchanged and still valid.',
          ],
          { label: 'View my certificate', url: content.statusUrl },
        ),
        text: `About your update request, ${firstName(content.name)}.\n\nThe training team did not approve your changes.${content.reason ? `\nReason: ${content.reason}` : ''}\nYour existing certificate is unchanged and still valid.\n\nView it: ${content.statusUrl}\n`,
      };
    }

    case 'admin_request': {
      const what = {
        new: 'A new certificate is waiting for approval',
        resubmitted: 'A participant resubmitted and is waiting for approval',
        update: 'A participant asked to update their approved certificate',
      }[content.request];
      const who = `${escapeHtml(content.name)} (${escapeHtml(content.opco)}, ${escapeHtml(content.email)})`;
      return {
        subject: `[StableNet admin] ${what}: ${content.name}`,
        html: layout(what, [`Participant: <strong style="color:${INK};">${who}</strong>`, 'Open the admin dashboard to review it.'], {
          label: 'Review in the dashboard',
          url: content.reviewUrl,
        }),
        text: `${what}.\n\nParticipant: ${content.name} (${content.opco}, ${content.email})\n\nReview it: ${content.reviewUrl}\n`,
      };
    }
  }
}
