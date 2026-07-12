import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { DocumentTranslationService } from './document-translation.service';

@Processor('document-translation')
export class DocumentTranslationWorker extends WorkerHost {
  private readonly logger = new Logger(DocumentTranslationWorker.name);

  constructor(private readonly service: DocumentTranslationService) {
    super();
  }

  async process(job: Job<{ translationId: string }>) {
    this.logger.log(`Processing translation job ${job.data.translationId}...`);
    try {
      await this.service.translate(job.data.translationId);
      this.logger.log(`Completed translation job ${job.data.translationId}`);
    } catch (error) {
      this.logger.error(`Failed translation job ${job.data.translationId}`, error);
      throw error;
    }
  }
}
