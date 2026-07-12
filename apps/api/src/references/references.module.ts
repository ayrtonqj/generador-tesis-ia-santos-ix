import { Module } from '@nestjs/common';
import { ReferencesController } from './references.controller';
import { ReferencesService } from './references.service';
import { ReferencesWorker } from './references.worker';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'references',
    }),
  ],
  controllers: [ReferencesController],
  providers: [ReferencesService, ReferencesWorker],
  exports: [ReferencesService],
})
export class ReferencesModule {}
