import { Controller, Get, Post, Delete, Body, Param, Req, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ThesisGeneratorService } from './thesis-generator.service';
import { GenerateDto } from './dto/generate.dto';

@ApiTags('thesis-generator')
@ApiBearerAuth()
@Controller('thesis-generator')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ThesisGeneratorController {
  constructor(private readonly thesisGeneratorService: ThesisGeneratorService) {}

  @Post('generate')
  @Roles('ADMIN', 'COORDINATOR', 'ADVISOR', 'STUDENT')
  generate(@Body() dto: GenerateDto, @Req() req: any) {
    return this.thesisGeneratorService.generate(dto, req.user.sub);
  }

  @Get('history')
  @Roles('ADMIN', 'COORDINATOR', 'ADVISOR', 'STUDENT')
  getHistory(@Req() req: any) {
    return this.thesisGeneratorService.getHistory(req.user.sub);
  }

  @Get('history/:id')
  @Roles('ADMIN', 'COORDINATOR', 'ADVISOR', 'STUDENT')
  getGeneration(@Param('id') id: string, @Req() req: any) {
    return this.thesisGeneratorService.getGeneration(id, req.user.sub);
  }

  @Delete('history/:id')
  @Roles('ADMIN', 'COORDINATOR', 'ADVISOR', 'STUDENT')
  deleteGeneration(@Param('id') id: string, @Req() req: any) {
    return this.thesisGeneratorService.deleteGeneration(id, req.user.sub);
  }

  @Get('history/:id/pdf')
  @Roles('ADMIN', 'COORDINATOR', 'ADVISOR', 'STUDENT')
  async getThesisPDF(
    @Param('id') id: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.thesisGeneratorService.generateThesisPdf(id, req.user.sub);
    const generation = await this.thesisGeneratorService.getGeneration(id, req.user.sub);
    const safeTopic = generation.topic.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '').trim().replace(/\s+/g, '_');
    const fileName = `Tesis_${safeTopic}_${Date.now()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    res.send(pdfBuffer);
  }

  @Get('history/:id/docx')
  @Roles('ADMIN', 'COORDINATOR', 'ADVISOR', 'STUDENT')
  async getThesisDOCX(
    @Param('id') id: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const docxBuffer = await this.thesisGeneratorService.generateThesisDocx(id, req.user.sub);
    const generation = await this.thesisGeneratorService.getGeneration(id, req.user.sub);
    const safeTopic = generation.topic.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '').trim().replace(/\s+/g, '_');
    const fileName = `Tesis_${safeTopic}_${Date.now()}.docx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    res.send(docxBuffer);
  }

  @Get('templates/:id/sections')
  @Roles('ADMIN', 'COORDINATOR', 'ADVISOR', 'STUDENT')
  getTemplateSections(@Param('id') id: string) {
    return this.thesisGeneratorService.getTemplateSections(id);
  }
}
