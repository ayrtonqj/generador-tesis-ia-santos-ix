import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ReferencesService } from './references.service';

@ApiTags('references')
@ApiBearerAuth()
@Controller('references')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReferencesController {
  constructor(private referencesService: ReferencesService) {}

  @Post('analyze/:advanceId')
  @Roles('ADVISOR', 'COORDINATOR', 'ADMIN')
  async analyze(@Param('advanceId') advanceId: string) {
    await this.referencesService.enqueueAnalyze(advanceId);
    return { message: 'Análisis de referencias encolado', advanceId };
  }

  @Get('all')
  findAll() {
    return this.referencesService.findAll();
  }

  @Get('report/:advanceId')
  getReport(@Param('advanceId') advanceId: string) {
    return this.referencesService.getReport(advanceId);
  }
}
