import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TemplatesModule } from './templates/templates.module';
import { AdvancesModule } from './advances/advances.module';
import { AiAnalysisModule } from './ai-analysis/ai-analysis.module';
import { ReviewModule } from './review/review.module';
import { FineTuningModule } from './fine-tuning/fine-tuning.module';
import { PlagiarismModule } from './plagiarism/plagiarism.module';
import { ReferencesModule } from './references/references.module';
import { OrcidModule } from './orcid/orcid.module';
import { ReportsModule } from './reports/reports.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { NotificationsModule } from './notifications/notifications.module';
import { StorageModule } from './storage/storage.module';
import { SettingsModule } from './settings/settings.module';
import { ThesisGeneratorModule } from './thesis-generator/thesis-generator.module';
import { ChatModule } from './chat/chat.module';
import { DocumentTranslationModule } from './document-translation/document-translation.module';
import { ProgramsController } from './programs/programs.controller';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    TemplatesModule,
    AdvancesModule,
    AiAnalysisModule,
    ReviewModule,
    FineTuningModule,
    PlagiarismModule,
    ReferencesModule,
    OrcidModule,
    ReportsModule,
    DashboardModule,
    NotificationsModule,
    StorageModule,
    SettingsModule,
    ThesisGeneratorModule,
    ChatModule,
    DocumentTranslationModule,
  ],
  controllers: [ProgramsController],
})
export class AppModule {}
