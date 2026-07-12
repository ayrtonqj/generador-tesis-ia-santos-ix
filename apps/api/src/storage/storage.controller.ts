import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { StorageService } from './storage.service';
import * as path from 'path';
import * as fs from 'fs';

@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Get('file/:key')
  async getFile(@Param('key') key: string, @Res() res: Response) {
    if (this.storageService.getIsLocal()) {
      const filePath = path.join(this.storageService.getLocalDir(), key);
      if (!fs.existsSync(filePath)) {
        throw new NotFoundException('File not found in local storage');
      }
      res.sendFile(filePath);
    } else {
      const url = await this.storageService.getPresignedUrl(key);
      res.redirect(url);
    }
  }
}
