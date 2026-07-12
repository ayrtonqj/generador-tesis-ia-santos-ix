import {
  Controller, Get, Post, Param, Query, Body,
  UseGuards, UseInterceptors, UploadedFile, UploadedFiles, Request,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdvancesService } from './advances.service';

@ApiTags('advances')
@ApiBearerAuth()
@Controller('advances')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdvancesController {
  constructor(private advancesService: AdvancesService) {}

  @Get()
  findAll(
    @Request() req: any,
    @Query('programId') programId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    const user = req.user;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    const statusFilter = status && status !== 'all' ? status : undefined;
    if (user.role === 'STUDENT') {
      return this.advancesService.findAll({ studentId: user.sub, limit: limitNum });
    }
    if (user.role === 'ADVISOR') {
      return this.advancesService.findAll({ advisorId: user.sub, programId, status: statusFilter, limit: limitNum });
    }
    return this.advancesService.findAll({ programId, status: statusFilter, limit: limitNum });
  }

  @Get('student/me')
  getMyAdvances(@Request() req: any) {
    return this.advancesService.getStudentAdvances(req.user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.advancesService.findById(id);
  }

  @Get(':id/preview')
  getPreview(@Param('id') id: string) {
    return this.advancesService.getPreviewUrl(id);
  }

  @Post('upload')
  @Roles('STUDENT', 'ADMIN', 'COORDINATOR')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  upload(
    @Request() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { templateId: string; title: string; advanceType: string; studentId?: string },
  ) {
    const targetStudentId = body.studentId || req.user.sub;
    return this.advancesService.upload(file, {
      studentId: targetStudentId,
      programId: req.user.programId,
      templateId: body.templateId,
      title: body.title,
      advanceType: body.advanceType,
    });
  }

  @Post('bulk-upload')
  @Roles('COORDINATOR', 'ADMIN')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files', 20, { limits: { fileSize: 50 * 1024 * 1024 } }))
  bulkUpload(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: { templateId: string; advanceType: string; studentId: string },
  ) {
    return this.advancesService.bulkUpload(files, body);
  }
}
