import { BadRequestException, Injectable } from '@nestjs/common';
import type { CertificateSettings } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { DesignVariant, UpdateCertificateSettingsDto } from './dto/update-certificate-settings.dto.js';

const SINGLETON_ID = 1;

export interface CertificateSettingsView {
  trainerName: string;
  legacyDates: string;
  startDate: string;
  endDate: string;
  signature: string;
  designVariant: DesignVariant;
  updatedAt: string | null;
}

const toView = (s: CertificateSettings | null): CertificateSettingsView => ({
  trainerName: s?.trainerName ?? '',
  legacyDates: s?.legacyDates ?? '',
  startDate: s?.startDate ?? '',
  endDate: s?.endDate ?? '',
  signature: s?.signature ?? '',
  designVariant: s?.designVariant === 'modern' ? 'modern' : 'classic',
  updatedAt: s?.updatedAt.toISOString() ?? null,
});

@Injectable()
export class CertificateSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<CertificateSettingsView> {
    return toView(await this.prisma.certificateSettings.findUnique({ where: { id: SINGLETON_ID } }));
  }

  async update(dto: UpdateCertificateSettingsDto, userId: string): Promise<CertificateSettingsView> {
    if (dto.startDate && dto.endDate && dto.endDate < dto.startDate) {
      throw new BadRequestException('Training end date must be on or after the start date.');
    }

    const data = {
      trainerName: dto.trainerName,
      startDate: dto.startDate ?? '',
      endDate: dto.endDate ?? '',
      signature: dto.signature,
      ...(dto.designVariant && { designVariant: dto.designVariant }),
      updatedById: userId,
    };
    const settings = await this.prisma.certificateSettings.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, ...data },
      update: data,
    });
    return toView(settings);
  }
}
