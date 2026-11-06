import { Module } from '@nestjs/common';
import { CertificateSettingsController } from './certificate-settings.controller.js';
import { CertificateSettingsService } from './certificate-settings.service.js';
import { NotificationEmailsController } from './notification-emails.controller.js';

@Module({
  controllers: [CertificateSettingsController, NotificationEmailsController],
  providers: [CertificateSettingsService],
})
export class CertificateSettingsModule {}
