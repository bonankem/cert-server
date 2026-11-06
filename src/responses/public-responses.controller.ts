import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator.js';
import { DownloadSource } from '../generated/prisma/client.js';
import { SubmitResponseDto } from './dto/submit-response.dto.js';
import { ResponsesService } from './responses.service.js';
import type { SubmissionStatus, SubmitResult, VerifyResult } from './responses.types.js';

const ONE_HOUR = 60 * 60 * 1000;

/** Endpoints participants use (no login). */
@Public()
@Controller()
export class PublicResponsesController {
  constructor(private readonly responses: ResponsesService) {}

  @Throttle({ default: { limit: 20, ttl: ONE_HOUR } })
  @Post('responses')
  submit(@Body() dto: SubmitResponseDto): Promise<SubmitResult> {
    return this.responses.submit(dto);
  }

  /** The participant's private status link: pending, approved (with certificate) or rejected. */
  @Throttle({ default: { limit: 120, ttl: ONE_HOUR } })
  @Get('certificates/status/:token')
  status(@Param('token') token: string): Promise<SubmissionStatus> {
    return this.responses.statusByToken(token.slice(0, 64));
  }

  /**
   * Public verification — the QR code on every certificate links here
   * (via the client's /verify/:code page). Accepts a verification code or certificate ID.
   */
  @Throttle({ default: { limit: 60, ttl: ONE_HOUR } })
  @Get('certificates/verify/:code')
  verify(@Param('code') code: string): Promise<VerifyResult> {
    return this.responses.verify(code.slice(0, 40));
  }

  @Throttle({ default: { limit: 30, ttl: ONE_HOUR } })
  @Post('certificates/:certId/downloads')
  @HttpCode(HttpStatus.NO_CONTENT)
  recordDownload(@Param('certId') certId: string): Promise<void> {
    return this.responses.recordDownload(certId, DownloadSource.participant);
  }
}
