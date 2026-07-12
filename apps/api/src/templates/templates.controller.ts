import {
  Controller, Get, Post, Put, Patch, Delete, Param, Body, Query,
  UseGuards, UseInterceptors, UploadedFile, Req
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { TemplatesService } from './templates.service';

@ApiTags('templates')
@ApiBearerAuth()
@Controller('templates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TemplatesController {
  constructor(private templatesService: TemplatesService) {}

  @Get()
  @Roles('COORDINATOR', 'ADMIN', 'ADVISOR', 'STUDENT')
  findAll(
    @Req() req: any,
    @Query('programId') programId?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    const user = req.user;
    const filterProgram = user.role === 'ADMIN' ? programId : user.programId;
    return this.templatesService.findAll(filterProgram, includeInactive === 'true');
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.templatesService.findById(id);
  }

  @Get(':id/file-url')
  @Roles('COORDINATOR', 'ADMIN', 'ADVISOR', 'STUDENT')
  getFileUrl(@Param('id') id: string) {
    return this.templatesService.getFileUrl(id);
  }

  @Post('upload')
  @Roles('COORDINATOR', 'ADMIN')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { programId: string; name: string; version: string; citationStyle?: string },
  ) {
    return this.templatesService.upload(file, body);
  }

  @Put(':id')
  @Roles('COORDINATOR', 'ADMIN')
  update(@Param('id') id: string, @Body() body: { name?: string; version?: string }) {
    return this.templatesService.update(id, body);
  }

  @Put(':id/rubric')
  @Roles('COORDINATOR', 'ADMIN')
  updateRubric(@Param('id') id: string, @Body() body: { rubric: any }) {
    return this.templatesService.updateRubric(id, body.rubric);
  }

  @Patch(':id/toggle')
  @Roles('ADMIN')
  toggleActive(@Param('id') id: string) {
    return this.templatesService.toggleActive(id);
  }

  @Delete(':id')
  @Roles('ADMIN')
  deactivate(@Param('id') id: string) {
    return this.templatesService.deactivate(id);
  }
}
