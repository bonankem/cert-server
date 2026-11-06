import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module.js';
import { SessionAuthGuard } from './auth/session-auth.guard.js';
import { CertificateSettingsModule } from './certificate-settings/certificate-settings.module.js';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter.js';
import { CsrfGuard } from './common/guards/csrf.guard.js';
import { validateEnv } from './config/env.validation.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { FormConfigModule } from './form-config/form-config.module.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ResponsesModule } from './responses/responses.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
    // Default: 120 requests/minute per IP; sensitive routes set stricter limits.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuthModule,
    FormConfigModule,
    ResponsesModule,
    CertificateSettingsModule,
    DashboardModule,
    HealthModule,
  ],
  providers: [
    // Guards run in this order: rate limit → CSRF header → session/admin.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useExisting: SessionAuthGuard },
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
  ],
})
export class AppModule {}
