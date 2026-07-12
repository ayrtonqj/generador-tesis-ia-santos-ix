import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PushProvider } from './push.provider';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private push: PushProvider,
  ) {}

  async getUserNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async createNotification(data: {
    userId: string;
    title: string;
    body: string;
    type: string;
    data?: any;
  }) {
    const notification = await this.prisma.notification.create({ data });

    // Enviar push real si el usuario tiene tokens registrados
    await this.sendPushToUser(data.userId, data.title, data.body, {
      type: data.type,
      notificationId: notification.id,
      ...(data.data ?? {}),
    });

    return notification;
  }

  async markAsRead(id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { read: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }

  async getUnreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { userId, read: false },
    });
  }

  async registerPushToken(userId: string, token: string, platform: string) {
    // Upsert: si ya existe el token, actualiza; si no, crea
    return this.prisma.userPushToken.upsert({
      where: { token },
      update: { userId, platform, updatedAt: new Date() },
      create: { userId, token, platform },
    });
  }

  async removeInvalidToken(token: string) {
    await this.prisma.userPushToken.deleteMany({ where: { token } });
    this.logger.warn(`Removed invalid push token: ${token}`);
  }

  // ─── Notificar al estudiante que el análisis IA completó ───────────────────
  async notifyAnalysisComplete(advanceId: string) {
    const advance = await this.prisma.advance.findUniqueOrThrow({
      where: { id: advanceId },
      include: { aiAnalysis: { select: { overallScore: true, gradeConverted: true } } },
    });

    await this.createNotification({
      userId: advance.studentId,
      title: '🤖 Análisis IA completado',
      body: `Tu avance "${advance.title}" obtuvo ${advance.aiAnalysis?.overallScore?.toFixed(0) ?? 0}% de cumplimiento (${advance.aiAnalysis?.gradeConverted?.toFixed(2) ?? 0}/20 pts).`,
      type: 'AI_COMPLETE',
      data: { advanceId },
    });
  }

  // ─── Notificar al estudiante que el asesor dejó comentarios ───────────────
  async notifyReviewComplete(advanceId: string, advisorName: string) {
    const advance = await this.prisma.advance.findUniqueOrThrow({
      where: { id: advanceId },
    });

    await this.createNotification({
      userId: advance.studentId,
      title: '👨‍🏫 Revisión del asesor',
      body: `${advisorName} ha completado la revisión de "${advance.title}".`,
      type: 'REVIEW_COMPLETE',
      data: { advanceId },
    });
  }

  // ─── Notificar sobre deadline próximo (llamable desde un cron job) ─────────
  async notifyUpcomingDeadline(
    userId: string,
    periodName: string,
    daysLeft: number,
  ) {
    await this.createNotification({
      userId,
      title: '⏰ Fecha límite próxima',
      body: `Quedan ${daysLeft} día${daysLeft !== 1 ? 's' : ''} para la entrega: "${periodName}".`,
      type: 'DEADLINE_REMINDER',
      data: { periodName, daysLeft },
    });
  }

  // ─── Envío real de push a todos los tokens del usuario ────────────────────
  private async sendPushToUser(
    userId: string,
    title: string,
    body: string,
    data: Record<string, unknown>,
  ) {
    try {
      const pushTokens = await this.prisma.userPushToken.findMany({
        where: { userId },
        select: { token: true },
      });

      const tokens = pushTokens.map((pt) => pt.token);
      if (tokens.length === 0) return;

      await this.push.sendBatch(tokens, { title, body, data });
    } catch (error: any) {
      this.logger.error(`Failed to send push to user ${userId}: ${error?.message}`);
    }
  }
}
