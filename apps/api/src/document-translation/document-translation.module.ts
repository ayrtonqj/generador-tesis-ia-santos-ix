import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DocumentTranslationController } from './document-translation.controller';
import { DocumentTranslationService } from './document-translation.service';
import { DocumentTranslationWorker } from './document-translation.worker';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'document-translation' }),
  ],
  controllers: [DocumentTranslationController],
  providers: [DocumentTranslationService, DocumentTranslationWorker],
})
export class DocumentTranslationModule {}
