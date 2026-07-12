import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('kpis')
  getKPIs(@Query('programId') programId?: string) {
    return this.dashboardService.getKPIs(programId);
  }

  @Get('stats-by-program')
  getStatsByProgram() {
    return this.dashboardService.getStatsByProgram();
  }
}
