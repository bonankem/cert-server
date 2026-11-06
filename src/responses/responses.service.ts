import { Injectable, NotFoundException } from '@nestjs/common';
import { DownloadSource, Prisma, type Response } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { generateCertId, generateVerificationCode } from './certificate-codes.js';
import type { ListResponsesQuery, ResponseFiltersQuery } from './dto/list-responses.query.js';
import type { SubmitResponseDto } from './dto/submit-response.dto.js';
import { responsesToCsv } from './responses.csv.js';
import { toDetail, toSubmitted, toSummary } from './responses.mapper.js';
import type { Paginated, ResponseDetail, ResponseSummary, SubmittedResponse, VerifyResult } from './responses.types.js';

const MAX_CODE_ATTEMPTS = 5;

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

@Injectable()
export class ResponsesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Store a submission and issue its certificate ID + verification code. */
  async submit(dto: SubmitResponseDto): Promise<SubmittedResponse> {
    for (let attempt = 1; ; attempt++) {
      try {
        const response = await this.prisma.response.create({
          data: {
            name: dto.fullName,
            opco: dto.opco,
            consent: dto.consent,
            answers: dto.answers,
            certId: generateCertId(),
            verificationCode: generateVerificationCode(),
          },
        });
        return toSubmitted(response);
      } catch (error) {
        // A random code collided with an existing one — draw again.
        if (!isUniqueViolation(error) || attempt >= MAX_CODE_ATTEMPTS) throw error;
      }
    }
  }

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
        downloads: { orderBy: { downloadedAt: 'desc' }, include: { user: { select: { name: true } } } },
      },
    });
    if (!response) throw new NotFoundException(`No response with certificate ID “${certId}”.`);
    return toDetail(response);
  }

  async remove(certId: string): Promise<void> {
    await this.prisma.response.delete({ where: { certId } });
  }

  /** Look up by certificate ID or verification code (case-insensitive). */
  async verify(query: string): Promise<VerifyResult> {
    const needle = query.trim().toUpperCase();
    if (!needle) return { match: null };
    const response = await this.prisma.response.findFirst({
      where: { OR: [{ certId: needle }, { verificationCode: needle }] },
    });
    return {
      match: response && {
        certId: response.certId,
        name: response.name,
        opco: response.opco,
        submittedAt: response.submittedAt.toISOString(),
        verificationCode: response.verificationCode,
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
   * Log a certificate download. Participant downloads also bump the
   * counter cache used for "downloaded" filtering and sorting.
   */
  async recordDownload(certId: string, source: DownloadSource, userId?: string): Promise<void> {
    const response = await this.findResponseOrThrow(certId);
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

  private async findResponseOrThrow(certId: string): Promise<Response> {
    const response = await this.prisma.response.findUnique({ where: { certId } });
    if (!response) throw new NotFoundException(`No certificate with ID “${certId}”.`);
    return response;
  }

  private buildWhere({ search, opco, consent, status }: ResponseFiltersQuery): Prisma.ResponseWhereInput {
    const term = search?.trim();
    return {
      ...(term && {
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { certId: { contains: term, mode: 'insensitive' } },
          { opco: { contains: term, mode: 'insensitive' } },
        ],
      }),
      ...(opco?.length && { opco: { in: opco } }),
      ...(consent && { consent }),
      ...(status === 'downloaded' && { participantDownloads: { gt: 0 } }),
      ...(status === 'pending' && { participantDownloads: 0 }),
    };
  }
}
