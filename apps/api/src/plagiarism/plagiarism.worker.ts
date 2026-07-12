import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PlagiarismService } from './plagiarism.service';

@Processor('plagiarism')
export class PlagiarismWorker extends WorkerHost {
  private readonly logger = new Logger(PlagiarismWorker.name);

  constructor(private readonly plagiarismService: PlagiarismService) {
    super();
  }

  async process(job: Job<{ advanceId: string }>) {
    this.logger.log(`Processing plagiarism analysis for advance ${job.data.advanceId}...`);
    try {
      await this.plagiarismService.analyze(job.data.advanceId);
      this.logger.log(`Completed plagiarism analysis for advance ${job.data.advanceId}`);
    } catch (error) {
      this.logger.error(`Failed plagiarism analysis for advance ${job.data.advanceId}`, error);
      throw error;
    }
  }
}
