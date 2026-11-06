import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { AuthService } from './auth.service.js';
import type { AuthenticatedRequest, AuthUser } from './auth.types.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { clearSessionCookie, readSessionCookie, setSessionCookie } from './session-cookie.js';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

@Controller('auth')
export class AuthController {
  private readonly secureCookies: boolean;

  constructor(
    private readonly auth: AuthService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.secureCookies = config.get('COOKIE_SECURE', { infer: true });
  }

  /** Brute-force protection: 10 attempts per IP per 15 minutes. */
  @Public()
  @Throttle({ default: { limit: 10, ttl: FIFTEEN_MINUTES } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthUser> {
    const { user, token, expiresAt } = await this.auth.login(dto, { userAgent: req.get('user-agent'), ip: req.ip });
    setSessionCookie(res, token, expiresAt, this.secureCookies);
    return user;
  }

  /** Public so a stale cookie can always be cleared. */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response): Promise<void> {
    const token = readSessionCookie(req);
    if (token) await this.auth.logout(token);
    clearSessionCookie(res, this.secureCookies);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }

  @Throttle({ default: { limit: 10, ttl: FIFTEEN_MINUTES } })
  @Patch('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Req() req: AuthenticatedRequest,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.auth.changePassword(user.id, req.sessionToken!, dto);
  }
}
