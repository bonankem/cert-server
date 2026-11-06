import { Body, Controller, Get, Put } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { CertificateSettingsService, type CertificateSettingsView } from './certificate-settings.service.js';
import { UpdateCertificateSettingsDto } from './dto/update-certificate-settings.dto.js';

@Controller()
export class CertificateSettingsController {
  constructor(private readonly settings: CertificateSettingsService) {}

  /** Public: participants' browsers need it to draw their certificate. */
  @Public()
  @Get('certificate-settings')
  get(): Promise<CertificateSettingsView> {
    return this.settings.get();
  }

  @Put('admin/certificate-settings')
  update(
    @Body() dto: UpdateCertificateSettingsDto,
    @CurrentUser() user: AuthUser,
  ): Promise<CertificateSettingsView> {
    return this.settings.update(dto, user.id);
  }
}
