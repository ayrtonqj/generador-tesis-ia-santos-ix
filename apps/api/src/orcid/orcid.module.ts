import { Module } from '@nestjs/common';
import { OrcidController } from './orcid.controller';
import { OrcidService } from './orcid.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [OrcidController],
  providers: [OrcidService],
  exports: [OrcidService],
})
export class OrcidModule {}
