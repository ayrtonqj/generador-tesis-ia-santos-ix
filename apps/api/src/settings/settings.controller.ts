import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get()
  getSettings() {
    return this.settingsService.getSettings();
  }

  @Get('providers')
  getAvailableProviders() {
    return this.settingsService.getAvailableProviders();
  }

  @Put()
  @Roles('ADMIN', 'COORDINATOR')
  updateSettings(@Body() body: {
    institutionName?: string;
    maxGrade?: number;
    aiModel?: string;
    aiProvider?: string;
    approvalThreshold?: number;
    rigorLevel?: string;
  }) {
    return this.settingsService.updateSettings(body);
  }
}
