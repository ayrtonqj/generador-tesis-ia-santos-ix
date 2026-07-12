import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  getMyNotifications(@Request() req: any) {
    return this.notificationsService.getUserNotifications(req.user.sub);
  }

  @Get('unread-count')
  getUnreadCount(@Request() req: any) {
    return this.notificationsService.getUnreadCount(req.user.sub);
  }

  @Patch(':id/read')
  markAsRead(@Param('id') id: string) {
    return this.notificationsService.markAsRead(id);
  }

  @Patch('mark-all-read')
  markAllAsRead(@Request() req: any) {
    return this.notificationsService.markAllAsRead(req.user.sub);
  }

  /** Registrar token de push notification del dispositivo móvil */
  @Post('push-token')
  registerPushToken(
    @Request() req: any,
    @Body() body: { token: string; platform: string },
  ) {
    return this.notificationsService.registerPushToken(
      req.user.sub,
      body.token,
      body.platform,
    );
  }
}
