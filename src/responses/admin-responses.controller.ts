import { Body, Controller, Delete, Get, Header, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../auth/auth.types.js';
import { DownloadSource } from '../generated/prisma/client.js';
import { ListResponsesQuery, ResponseFiltersQuery, VerifyQuery } from './dto/list-responses.query.js';
import { ApproveResponsesDto, RejectResponseDto } from './dto/review-responses.dto.js';
import { ResponsesService } from './responses.service.js';
import type { Paginated, ResponseDetail, ResponseSummary, ReviewResult, VerifyResult } from './responses.types.js';

/** Admin-only (global SessionAuthGuard). Static routes are declared before :certId. */
@Controller('admin/responses')
export class AdminResponsesController {
  constructor(private readonly responses: ResponsesService) {}

  @Get()
  list(@Query() query: ListResponsesQuery): Promise<Paginated<ResponseSummary>> {
    return this.responses.list(query);
  }

  @Get('export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="StableNet-Training-Responses.csv"')
  @Header('Cache-Control', 'no-store')
  exportCsv(@Query() filters: ResponseFiltersQuery): Promise<string> {
    return this.responses.exportCsv(filters);
  }

  /** Admins can look up any response, with its approval status. */
  @Get('verify')
  verify(@Query() { q }: VerifyQuery): Promise<VerifyResult> {
    return this.responses.verify(q, { includeUnapproved: true });
  }

  /** Numbers waiting for approval: responses and update requests (sidebar badge). */
  @Get('pending-count')
  pendingCount(): Promise<{ pending: number; updates: number }> {
    return this.responses.pendingCount();
  }

  /** Approve one or more responses. */
  @Post('approve')
  approve(@Body() { certIds }: ApproveResponsesDto, @CurrentUser() user: AuthUser): Promise<ReviewResult> {
    return this.responses.approve(certIds, user.id);
  }

  @Get(':certId')
  findOne(@Param('certId') certId: string): Promise<ResponseDetail> {
    return this.responses.findOne(certId);
  }

  @Delete(':certId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('certId') certId: string): Promise<void> {
    return this.responses.remove(certId);
  }

  @Post(':certId/approve')
  approveOne(@Param('certId') certId: string, @CurrentUser() user: AuthUser): Promise<ReviewResult> {
    return this.responses.approve([certId], user.id);
  }

  /** Reject a pending response, or revoke an approved certificate. */
  @Post(':certId/reject')
  reject(
    @Param('certId') certId: string,
    @Body() { reason }: RejectResponseDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ReviewResult> {
    return this.responses.reject(certId, reason, user.id);
  }

  /** Apply the participant's pending update request (certificate keeps its ID and code). */
  @Post(':certId/update/approve')
  approveUpdate(@Param('certId') certId: string, @CurrentUser() user: AuthUser): Promise<ReviewResult> {
    return this.responses.approveUpdate(certId, user.id);
  }

  /** Turn down the pending update request; the certificate stays as it is. */
  @Post(':certId/update/reject')
  rejectUpdate(
    @Param('certId') certId: string,
    @Body() { reason }: RejectResponseDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ReviewResult> {
    return this.responses.rejectUpdate(certId, reason, user.id);
  }

  @Post(':certId/downloads')
  @HttpCode(HttpStatus.NO_CONTENT)
  recordDownload(@Param('certId') certId: string, @CurrentUser() user: AuthUser): Promise<void> {
    return this.responses.recordDownload(certId, DownloadSource.admin, user.id);
  }
}
