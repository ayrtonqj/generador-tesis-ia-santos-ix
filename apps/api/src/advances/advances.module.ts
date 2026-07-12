import { Module } from '@nestjs/common';
import { AdvancesController } from './advances.controller';
import { AdvancesService } from './advances.service';
import { AiAnalysisModule } from '../ai-analysis/ai-analysis.module';
import { PlagiarismModule } from '../plagiarism/plagiarism.module';
import { ReferencesModule } from '../references/references.module';

@Module({
  imports: [AiAnalysisModule, PlagiarismModule, ReferencesModule],
  controllers: [AdvancesController],
  providers: [AdvancesService],
  exports: [AdvancesService],
})
export class AdvancesModule {}
