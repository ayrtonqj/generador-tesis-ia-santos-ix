import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { AiAnalysisService } from './ai-analysis.service';

@Processor('ai-analysis')
export class AiAnalysisWorker extends WorkerHost {
  private readonly logger = new Logger(AiAnalysisWorker.name);

  constructor(private readonly aiAnalysisService: AiAnalysisService) {
    super();
  }

  async process(job: Job<{ advanceId: string }>) {
    this.logger.log(`Processing AI analysis for advance ${job.data.advanceId}...`);
    try {
      await this.aiAnalysisService.analyzeAdvance(job.data.advanceId);
      this.logger.log(`Completed AI analysis for advance ${job.data.advanceId}`);
    } catch (error) {
      this.logger.error(`Failed AI analysis for advance ${job.data.advanceId}`, error);
      throw error;
    }
  }
}
