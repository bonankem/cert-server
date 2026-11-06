import { Module } from '@nestjs/common';
import { CertificateSettingsController } from './certificate-settings.controller.js';
import { CertificateSettingsService } from './certificate-settings.service.js';

@Module({
  controllers: [CertificateSettingsController],
  providers: [CertificateSettingsService],
})
export class CertificateSettingsModule {}
