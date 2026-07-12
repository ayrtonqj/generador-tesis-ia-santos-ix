import { Module } from '@nestjs/common';
import { ThesisGeneratorController } from './thesis-generator.controller';
import { ThesisGeneratorService } from './thesis-generator.service';
import { DiagramGeneratorModule } from '../diagram-generator/diagram-generator.module';

@Module({
  imports: [DiagramGeneratorModule],
  controllers: [ThesisGeneratorController],
  providers: [ThesisGeneratorService],
})
export class ThesisGeneratorModule {}
