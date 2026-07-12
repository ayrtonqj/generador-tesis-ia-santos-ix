import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ReferencesService } from './references.service';

@Processor('references')
export class ReferencesWorker extends WorkerHost {
  private readonly logger = new Logger(ReferencesWorker.name);

  constructor(private readonly referencesService: ReferencesService) {
    super();
  }

  async process(job: Job<{ advanceId: string }>) {
    this.logger.log(`Processing references analysis for advance ${job.data.advanceId}...`);
    try {
      await this.referencesService.analyze(job.data.advanceId);
      this.logger.log(`Completed references analysis for advance ${job.data.advanceId}`);
    } catch (error) {
      this.logger.error(`Failed references analysis for advance ${job.data.advanceId}`, error);
      throw error;
    }
  }
}
