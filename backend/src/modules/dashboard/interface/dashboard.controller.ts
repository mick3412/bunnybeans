import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminApiKeyGuard } from '../../../shared/guards/admin-api-key.guard';
import { DashboardService } from '../application/dashboard.service';

@Controller('admin/dashboard')
@UseGuards(AdminApiKeyGuard)
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('summary')
  summary() {
    return this.service.getSummary();
  }
}
