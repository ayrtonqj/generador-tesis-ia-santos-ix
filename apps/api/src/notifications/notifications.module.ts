import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PushProvider } from './push.provider';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, PushProvider],
  exports: [NotificationsService, PushProvider],
})
export class NotificationsModule {}
