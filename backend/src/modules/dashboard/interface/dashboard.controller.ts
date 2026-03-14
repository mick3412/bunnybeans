import { Controller, Get } from '@nestjs/common';
import { DashboardService } from '../application/dashboard.service';

@Controller('admin/dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('summary')
  summary() {
    return this.service.getSummary();
  }
}
