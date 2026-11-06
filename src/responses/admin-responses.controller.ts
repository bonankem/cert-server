import { Controller, Delete, Get, Header, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../auth/auth.types.js';
import { DownloadSource } from '../generated/prisma/client.js';
import { ListResponsesQuery, ResponseFiltersQuery, VerifyQuery } from './dto/list-responses.query.js';
import { ResponsesService } from './responses.service.js';
import type { Paginated, ResponseDetail, ResponseSummary, VerifyResult } from './responses.types.js';

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

  @Get('verify')
  verify(@Query() { q }: VerifyQuery): Promise<VerifyResult> {
    return this.responses.verify(q);
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

  @Post(':certId/downloads')
  @HttpCode(HttpStatus.NO_CONTENT)
  recordDownload(@Param('certId') certId: string, @CurrentUser() user: AuthUser): Promise<void> {
    return this.responses.recordDownload(certId, DownloadSource.admin, user.id);
  }
}
