import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { FineTuningService } from './fine-tuning.service';

@ApiTags('fine-tuning')
@ApiBearerAuth()
@Controller('fine-tuning')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FineTuningController {
  constructor(private ftService: FineTuningService) {}

  @Get('stats')
  @Roles('COORDINATOR', 'ADMIN')
  getStats() {
    return this.ftService.getStats();
  }

  @Get('datasets')
  @Roles('ADMIN')
  getDatasets() {
    return this.ftService.getDatasets();
  }

  @Get('active-model')
  @Roles('COORDINATOR', 'ADMIN')
  getActiveModel() {
    return this.ftService.getActiveModel().then((model) => ({ model }));
  }

  @Post('export')
  @Roles('ADMIN')
  exportDataset() {
    return this.ftService.exportDataset();
  }

  /** Activar un modelo fine-tuneado para que sea usado en nuevos análisis */
  @Post('datasets/:id/activate')
  @Roles('ADMIN')
  activateModel(
    @Param('id') id: string,
    @Body() body: { modelId: string },
  ) {
    return this.ftService.activateModel(id, body.modelId);
  }

  /** Desactivar el modelo fine-tuneado y restaurar el modelo base */
  @Post('deactivate')
  @Roles('ADMIN')
  deactivateModel() {
    return this.ftService.deactivateModel();
  }

  /** Instrucciones para iniciar un job de fine-tuning en OpenAI */
  @Post('start-training')
  @Roles('ADMIN')
  startFineTuningJob(
    @Body() body: { datasetId: string; jsonl: string },
  ) {
    return this.ftService.startFineTuningJob(body.datasetId, body.jsonl);
  }
}
