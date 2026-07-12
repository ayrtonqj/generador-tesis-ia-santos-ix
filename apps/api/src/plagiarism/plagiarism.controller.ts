import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PlagiarismService } from './plagiarism.service';

@ApiTags('plagiarism')
@ApiBearerAuth()
@Controller('plagiarism')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PlagiarismController {
  constructor(private plagiarismService: PlagiarismService) {}

  @Post('analyze/:advanceId')
  @Roles('ADVISOR', 'COORDINATOR', 'ADMIN')
  async analyze(@Param('advanceId') advanceId: string) {
    await this.plagiarismService.enqueueAnalyze(advanceId);
    return { message: 'Análisis de plagio encolado', advanceId };
  }

  @Get('report/:advanceId')
  @Roles('ADVISOR', 'COORDINATOR', 'ADMIN')
  getReport(@Param('advanceId') advanceId: string) {
    return this.plagiarismService.getReport(advanceId);
  }
}
