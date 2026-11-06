import { randomBytes } from 'node:crypto';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ApprovalStatus, DownloadSource, Prisma, type Response } from '../generated/prisma/client.js';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RosterService } from '../roster/roster.service.js';
import { generateCertId, generateVerificationCode } from './certificate-codes.js';
import type { ListResponsesQuery, ResponseFiltersQuery } from './dto/list-responses.query.js';
import type { SubmitResponseDto } from './dto/submit-response.dto.js';
import { responsesToCsv } from './responses.csv.js';
import { toDetail, toSubmissionStatus, toSummary } from './responses.mapper.js';
import type {
  Paginated,
  ResponseDetail,
  ResponseSummary,
  ReviewResult,
  SubmissionStatus,
  SubmitResult,
  VerifyResult,
} from './responses.types.js';

const MAX_CODE_ATTEMPTS = 5;

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

/** Private token behind the participant's status link (~192 bits). */
const newAccessToken = (): string => randomBytes(24).toString('base64url');

/** Prisma `include` that counts a response's pending update requests (for list rows). */
const pendingUpdatesCount = {
  _count: { select: { updates: { where: { status: ApprovalStatus.pending } } } },
} as const;

@Injectable()
export class ResponsesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roster: RosterService,
    private readonly mail: MailService,
  ) {}

  // ---- participant -------------------------------------------------------------------------

  /**
   * One email = one response = one certificate.
   *  - New email: store the submission (approved straight away if on the participant list).
   *  - Known email, not yet approved: replace the earlier submission; it waits for approval again.
   *  - Known email, already approved: keep the certificate as it is and file the
   *    changes as an update request for an admin to approve.
   */
  async submit(dto: SubmitResponseDto): Promise<SubmitResult> {
    const existing = await this.prisma.response.findUnique({ where: { email: dto.email } });
    if (!existing) return { outcome: 'created', submission: await this.create(dto) };
    if (existing.status === ApprovalStatus.approved) return this.requestUpdate(existing, dto);
    return this.resubmit(existing, dto);
  }

  /** The participant's private status page. */
  async statusByToken(token: string): Promise<SubmissionStatus> {
    const response = token
      ? await this.prisma.response.findUnique({
          where: { accessToken: token },
          include: { updates: { orderBy: { requestedAt: 'desc' }, take: 1 } },
        })
      : null;
    if (!response) throw new NotFoundException('We couldn’t find this submission. Check the link and try again.');
    return toSubmissionStatus(withToken(response), response.updates[0] ?? null);
  }

  private async create(dto: SubmitResponseDto): Promise<SubmissionStatus> {
    const expected = await this.roster.isExpected(dto.email, dto.fullName);
    for (let attempt = 1; ; attempt++) {
      try {
        const response = await this.prisma.response.create({
          data: {
            name: dto.fullName,
            email: dto.email,
            opco: dto.opco,
            consent: dto.consent,
            answers: dto.answers,
            certId: generateCertId(),
            verificationCode: generateVerificationCode(),
            accessToken: newAccessToken(),
            status: expected ? ApprovalStatus.approved : ApprovalStatus.pending,
            autoApproved: expected,
            reviewedAt: expected ? new Date() : null,
          },
        });
        this.notify(response);
        if (!expected) this.notifyAdmins(response, 'new');
        return toSubmissionStatus(withToken(response));
      } catch (error) {
        if (!isUniqueViolation(error) || attempt >= MAX_CODE_ATTEMPTS) throw error;
        // Same email submitted twice at the same moment: treat the second one as a repeat.
        const raced = await this.prisma.response.findUnique({ where: { email: dto.email } });
        if (raced) throw new ConflictException('You have just submitted. Check your email for your link.');
        // Otherwise a random code collided — draw again.
      }
    }
  }

  /** Replace a pending or not-approved submission; it goes back to waiting for approval. */
  private async resubmit(existing: Response, dto: SubmitResponseDto): Promise<SubmitResult> {
    const response = await this.prisma.response.update({
      where: { id: existing.id },
      data: {
        name: dto.fullName,
        opco: dto.opco,
        consent: dto.consent,
        answers: dto.answers,
        submittedAt: new Date(),
        status: ApprovalStatus.pending,
        autoApproved: false,
        reviewedAt: null,
        reviewedById: null,
        rejectionReason: null,
        accessToken: existing.accessToken ?? newAccessToken(),
      },
    });
    this.notify(response, { resubmitted: true });
    this.notifyAdmins(response, 'resubmitted');
    return { outcome: 'resubmitted', submission: null };
  }

  /** File the changes as one pending update request (a newer request replaces an older one). */
  private async requestUpdate(existing: Response, dto: SubmitResponseDto): Promise<SubmitResult> {
    const changes = { name: dto.fullName, opco: dto.opco, consent: dto.consent, answers: dto.answers };
    const pending = await this.prisma.responseUpdate.findFirst({
      where: { responseId: existing.id, status: ApprovalStatus.pending },
    });
    if (pending) {
      await this.prisma.responseUpdate.update({ where: { id: pending.id }, data: { ...changes, requestedAt: new Date() } });
    } else {
      await this.prisma.responseUpdate.create({ data: { ...changes, responseId: existing.id } });
    }

    const response = existing.accessToken
      ? existing
      : await this.prisma.response.update({ where: { id: existing.id }, data: { accessToken: newAccessToken() } });
    this.mail.sendInBackground(response.email, {
      kind: 'update_received',
      name: dto.fullName,
      statusUrl: this.statusUrl(response),
    });
    this.notifyAdmins({ ...response, name: dto.fullName, opco: dto.opco }, 'update');
    return { outcome: 'update_requested', submission: null };
  }

  // ---- admin: review -----------------------------------------------------------------------

  /** Approve pending or rejected responses; already-approved ones are left alone. */
  async approve(certIds: string[], userId: string): Promise<ReviewResult> {
    const targets = await this.prisma.response.findMany({
      where: { certId: { in: certIds }, status: { not: ApprovalStatus.approved } },
    });
    return this.markApproved(targets, { userId });
  }

  /**
   * Reject a pending response, or revoke an approved one (its certificate then
   * stops verifying, and any pending update request is closed too).
   */
  async reject(certId: string, reason: string | undefined, userId: string): Promise<ReviewResult> {
    const response = await this.findResponseOrThrow(certId);
    if (response.status === ApprovalStatus.rejected) return { updated: 0 };

    const now = new Date();
    const [updated] = await this.prisma.$transaction([
      this.prisma.response.update({
        where: { id: response.id },
        data: {
          status: ApprovalStatus.rejected,
          reviewedAt: now,
          reviewedById: userId,
          autoApproved: false,
          rejectionReason: reason ?? null,
          accessToken: response.accessToken ?? newAccessToken(),
        },
      }),
      this.prisma.responseUpdate.updateMany({
        where: { responseId: response.id, status: ApprovalStatus.pending },
        data: { status: ApprovalStatus.rejected, reviewedAt: now, reviewedById: userId, rejectionReason: 'Certificate revoked' },
      }),
    ]);
    this.notify(updated);
    return { updated: 1 };
  }

  /** Apply a pending update request to the response. The certificate keeps its ID and code. */
  async approveUpdate(certId: string, userId: string): Promise<ReviewResult> {
    const response = await this.findResponseOrThrow(certId);
    const request = await this.findPendingUpdateOrThrow(response.id);
    const now = new Date();

    const [updated] = await this.prisma.$transaction([
      this.prisma.response.update({
        where: { id: response.id },
        data: {
          name: request.name,
          opco: request.opco,
          consent: request.consent,
          answers: request.answers ?? {},
          reviewedAt: now,
          reviewedById: userId,
          autoApproved: false,
        },
      }),
      this.prisma.responseUpdate.update({
        where: { id: request.id },
        data: { status: ApprovalStatus.approved, reviewedAt: now, reviewedById: userId },
      }),
    ]);
    this.mail.sendInBackground(updated.email, {
      kind: 'update_approved',
      name: updated.name,
      statusUrl: this.statusUrl(updated),
      certId: updated.certId,
    });
    return { updated: 1 };
  }

  /** Turn down a pending update request; the approved certificate stays as it is. */
  async rejectUpdate(certId: string, reason: string | undefined, userId: string): Promise<ReviewResult> {
    const response = await this.findResponseOrThrow(certId);
    const request = await this.findPendingUpdateOrThrow(response.id);
    await this.prisma.responseUpdate.update({
      where: { id: request.id },
      data: { status: ApprovalStatus.rejected, reviewedAt: new Date(), reviewedById: userId, rejectionReason: reason ?? null },
    });
    this.mail.sendInBackground(response.email, {
      kind: 'update_rejected',
      name: response.name,
      statusUrl: this.statusUrl(response),
      reason: reason ?? null,
    });
    return { updated: 1 };
  }

  /** After the participant list changes: approve pending submissions that now match it. */
  async approveRosterMatches(): Promise<ReviewResult> {
    const pending = await this.prisma.response.findMany({ where: { status: ApprovalStatus.pending } });
    const matches: Response[] = [];
    for (const response of pending) {
      if (await this.roster.isExpected(response.email, response.name)) matches.push(response);
    }
    return this.markApproved(matches, { auto: true });
  }

  /** Waiting for an admin: new or resubmitted responses, and update requests. */
  async pendingCount(): Promise<{ pending: number; updates: number }> {
    const [pending, updates] = await Promise.all([
      this.prisma.response.count({ where: { status: ApprovalStatus.pending } }),
      this.prisma.responseUpdate.count({ where: { status: ApprovalStatus.pending } }),
    ]);
    return { pending, updates };
  }

  // ---- admin: browse -----------------------------------------------------------------------

  async list(query: ListResponsesQuery): Promise<Paginated<ResponseSummary>> {
    const where = this.buildWhere(query);
    const direction = query.sortOrder === 'ascend' ? 'asc' : 'desc';
    const orderBy: Prisma.ResponseOrderByWithRelationInput[] = [
      query.sortField === 'lastDownloadedAt'
        ? { lastDownloadedAt: { sort: direction, nulls: 'last' } }
        : { [query.sortField]: direction },
      { submittedAt: 'desc' },
    ];

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.response.count({ where }),
      this.prisma.response.findMany({
        where,
        orderBy,
        include: pendingUpdatesCount,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { items: rows.map(toSummary), total, page: query.page, pageSize: query.pageSize };
  }

  async findOne(certId: string): Promise<ResponseDetail> {
    const response = await this.prisma.response.findUnique({
      where: { certId },
      include: {
        ...pendingUpdatesCount,
        reviewedBy: { select: { name: true } },
        updates: { where: { status: ApprovalStatus.pending }, orderBy: { requestedAt: 'desc' }, take: 1 },
        downloads: { orderBy: { downloadedAt: 'desc' }, include: { user: { select: { name: true } } } },
      },
    });
    if (!response) throw new NotFoundException(`No response with certificate ID “${certId}”.`);
    return toDetail(response);
  }

  async remove(certId: string): Promise<void> {
    await this.prisma.response.delete({ where: { certId } });
  }

  /**
   * Look up by certificate ID or verification code (case-insensitive).
   * The public page only ever matches approved certificates; admins see all.
   */
  async verify(query: string, { includeUnapproved = false } = {}): Promise<VerifyResult> {
    const needle = query.trim().toUpperCase();
    if (!needle) return { match: null };
    const response = await this.prisma.response.findFirst({
      where: {
        OR: [{ certId: needle }, { verificationCode: needle }],
        ...(!includeUnapproved && { status: ApprovalStatus.approved }),
      },
    });
    return {
      match: response && {
        certId: response.certId,
        name: response.name,
        opco: response.opco,
        submittedAt: response.submittedAt.toISOString(),
        verificationCode: response.verificationCode,
        status: response.status,
      },
    };
  }

  async exportCsv(filters: ResponseFiltersQuery): Promise<string> {
    const rows = await this.prisma.response.findMany({
      where: this.buildWhere(filters),
      orderBy: { submittedAt: 'desc' },
    });
    return responsesToCsv(rows);
  }

  /**
   * Log a certificate download (approved certificates only). Participant
   * downloads also bump the counter cache used for filtering and sorting.
   */
  async recordDownload(certId: string, source: DownloadSource, userId?: string): Promise<void> {
    const response = await this.findResponseOrThrow(certId);
    if (response.status !== ApprovalStatus.approved) {
      throw new ConflictException('This certificate has not been approved.');
    }
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.downloadEvent.create({
        data: { responseId: response.id, source, userId, downloadedAt: now },
      }),
      ...(source === DownloadSource.participant
        ? [
            this.prisma.response.update({
              where: { id: response.id },
              data: { participantDownloads: { increment: 1 }, lastDownloadedAt: now },
            }),
          ]
        : []),
    ]);
  }

  // ---- helpers -----------------------------------------------------------------------------

  private async markApproved(
    responses: Response[],
    { userId, auto = false }: { userId?: string; auto?: boolean },
  ): Promise<ReviewResult> {
    const now = new Date();
    for (const response of responses) {
      const updated = await this.prisma.response.update({
        where: { id: response.id },
        data: {
          status: ApprovalStatus.approved,
          reviewedAt: now,
          reviewedById: userId ?? null,
          autoApproved: auto,
          rejectionReason: null,
          accessToken: response.accessToken ?? newAccessToken(),
        },
      });
      this.notify(updated);
    }
    return { updated: responses.length };
  }

  private statusUrl(response: Response): string {
    return `${this.mail.appUrl}/certificate/${response.accessToken ?? ''}`;
  }

  /** Email the participant about their submission's current status. */
  private notify(response: Response, { resubmitted = false } = {}): void {
    if (!response.email || !response.accessToken) return;
    const statusUrl = this.statusUrl(response);

    switch (response.status) {
      case ApprovalStatus.pending:
        return this.mail.sendInBackground(response.email, { kind: 'received', name: response.name, statusUrl, resubmitted });
      case ApprovalStatus.approved:
        return this.mail.sendInBackground(response.email, {
          kind: 'approved',
          name: response.name,
          statusUrl,
          certId: response.certId,
        });
      case ApprovalStatus.rejected:
        return this.mail.sendInBackground(response.email, {
          kind: 'rejected',
          name: response.name,
          statusUrl,
          formUrl: `${this.mail.appUrl}/`,
          reason: response.rejectionReason,
        });
    }
  }

  /** Tell the admins something is waiting for them. */
  private notifyAdmins(response: Response, request: 'new' | 'resubmitted' | 'update'): void {
    this.mail.notifyAdmins({
      kind: 'admin_request',
      request,
      name: response.name,
      email: response.email,
      opco: response.opco,
      reviewUrl: `${this.mail.appUrl}/admin/responses/${encodeURIComponent(response.certId)}`,
    });
  }

  private async findResponseOrThrow(certId: string): Promise<Response> {
    const response = await this.prisma.response.findUnique({ where: { certId } });
    if (!response) throw new NotFoundException(`No certificate with ID “${certId}”.`);
    return response;
  }

  private async findPendingUpdateOrThrow(responseId: string) {
    const request = await this.prisma.responseUpdate.findFirst({
      where: { responseId, status: ApprovalStatus.pending },
      orderBy: { requestedAt: 'desc' },
    });
    if (!request) throw new NotFoundException('There is no pending update request for this response.');
    return request;
  }

  private buildWhere({ search, opco, consent, status, approval, updates }: ResponseFiltersQuery): Prisma.ResponseWhereInput {
    const term = search?.trim();
    return {
      ...(term && {
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { email: { contains: term, mode: 'insensitive' } },
          { certId: { contains: term, mode: 'insensitive' } },
          { opco: { contains: term, mode: 'insensitive' } },
        ],
      }),
      ...(opco?.length && { opco: { in: opco } }),
      ...(consent && { consent }),
      ...(approval && { status: approval }),
      ...(updates === 'pending' && { updates: { some: { status: ApprovalStatus.pending } } }),
      ...(status === 'downloaded' && { participantDownloads: { gt: 0 } }),
      ...(status === 'pending' && { participantDownloads: 0 }),
    };
  }
}

/** Narrow a response that is known to carry a token (all new submissions do). */
const withToken = <T extends Response>(r: T): T & { accessToken: string } => ({ ...r, accessToken: r.accessToken ?? '' });
