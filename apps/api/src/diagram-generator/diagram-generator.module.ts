import { Module } from '@nestjs/common';
import { DiagramGeneratorService } from './diagram-generator.service';
import { DiagramRendererService } from './diagram-renderer.service';

@Module({
  providers: [DiagramGeneratorService, DiagramRendererService],
  exports: [DiagramGeneratorService, DiagramRendererService],
})
export class DiagramGeneratorModule {}
