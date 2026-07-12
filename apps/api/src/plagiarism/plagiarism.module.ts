import { Module } from '@nestjs/common';
import { PlagiarismController } from './plagiarism.controller';
import { PlagiarismService } from './plagiarism.service';
import { PlagiarismWorker } from './plagiarism.worker';
import { CopyleaksProvider } from './copyleaks.provider';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'plagiarism',
    }),
  ],
  controllers: [PlagiarismController],
  providers: [PlagiarismService, PlagiarismWorker, CopyleaksProvider],
  exports: [PlagiarismService, CopyleaksProvider],
})
export class PlagiarismModule {}

