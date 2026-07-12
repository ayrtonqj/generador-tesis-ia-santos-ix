import { Controller, Get, Post, Param, Body, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('advance/:advanceId')
  async getAdvanceReport(@Param('advanceId') advanceId: string) {
    return this.reportsService.generateAdvanceReport(advanceId);
  }

  @Get('advance/:advanceId/html')
  async getAdvanceReportHTML(
    @Param('advanceId') advanceId: string,
    @Res() res: Response,
  ) {
    const report = await this.reportsService.generateAdvanceReport(advanceId);
    res.setHeader('Content-Type', 'text/html');
    res.send(report.html);
  }

  @Get('advance/:advanceId/pdf')
  async getAdvanceReportPDF(
    @Param('advanceId') advanceId: string,
    @Res() res: Response,
  ) {
    const [pdfBuffer, fileName] = await Promise.all([
      this.reportsService.generateAdvancePdf(advanceId),
      this.reportsService.getFileName(advanceId),
    ]);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    res.send(pdfBuffer);
  }

  @Get('advance/:advanceId/filename')
  async getFileName(@Param('advanceId') advanceId: string) {
    const name = await this.reportsService.getFileName(advanceId);
    return { fileName: name };
  }

  @Post('advance/:advanceId/send-email')
  async sendAdvanceReportEmail(
    @Param('advanceId') advanceId: string,
  ) {
    const result = await this.reportsService.sendAdvanceReportEmail(advanceId);
    return result;
  }

  @Post('batch-pdf')
  @UseGuards(RolesGuard)
  @Roles('COORDINATOR', 'ADMIN')
  async getBatchPdf(
    @Body() body: { advanceIds: string[] },
    @Res() res: Response,
  ) {
    const zipBuffer = await this.reportsService.generateBatchPdf(body.advanceIds);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=reportes_lote_${Date.now()}.zip`);
    res.send(zipBuffer);
  }

  @Post('batch-send-email')
  @UseGuards(RolesGuard)
  @Roles('COORDINATOR', 'ADMIN')
  async sendBatchEmail(
    @Body() body: { advanceIds: string[] },
  ) {
    return this.reportsService.sendBatchEmail(body.advanceIds);
  }
}
