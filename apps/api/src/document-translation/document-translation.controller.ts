import {
  Controller, Get, Post, Param, Body, Req, Res, UseGuards,
  UseInterceptors, UploadedFile, ParseFilePipe, MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DocumentTranslationService } from './document-translation.service';
import { UploadDto } from './dto/upload.dto';

@ApiTags('document-translation')
@ApiBearerAuth()
@Controller('document-translation')
@UseGuards(JwtAuthGuard)
export class DocumentTranslationController {
  constructor(private readonly service: DocumentTranslationService) {}

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 50 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /(pdf|document)$/ }),
        ],
        fileIsRequired: true,
      }),
    ) file: Express.Multer.File,
    @Body() dto: UploadDto,
    @Req() req: any,
  ) {
    return this.service.upload(file, req.user.sub, dto);
  }

  @Get('history')
  async getHistory(@Req() req: any) {
    return this.service.getHistory(req.user.sub);
  }

  @Get(':id')
  async getTranslation(@Param('id') id: string, @Req() req: any) {
    return this.service.getTranslation(id, req.user.sub);
  }

  @Post(':id/retry')
  async retry(@Param('id') id: string, @Req() req: any) {
    return this.service.retry(id, req.user.sub);
  }

  @Get(':id/docx')
  async downloadDocx(
    @Param('id') id: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const buffer = await this.service.generateDocx(id, req.user.sub);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=traduccion_${id.substring(0, 8)}.docx`);
    res.send(buffer);
  }

  @Get(':id/pdf')
  async downloadPdf(
    @Param('id') id: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const buffer = await this.service.generatePdf(id, req.user.sub);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=traduccion_${id.substring(0, 8)}.pdf`);
    res.send(buffer);
  }
}
