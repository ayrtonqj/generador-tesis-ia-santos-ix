import { Module } from '@nestjs/common';
import { AiAnalysisController } from './ai-analysis.controller';
import { AiAnalysisService } from './ai-analysis.service';
import { AiAnalysisWorker } from './ai-analysis.worker';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'ai-analysis',
    }),
    BullModule.registerQueue({
      name: 'plagiarism',
    }),
    BullModule.registerQueue({
      name: 'references',
    }),
    NotificationsModule,
  ],
  controllers: [AiAnalysisController],
  providers: [AiAnalysisService, AiAnalysisWorker],
  exports: [AiAnalysisService],
})
export class AiAnalysisModule {}

