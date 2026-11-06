import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service.js';
import type { DashboardStats } from './dashboard.types.js';

@Controller('admin/dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  getStats(): Promise<DashboardStats> {
    return this.dashboard.getStats();
  }
}
