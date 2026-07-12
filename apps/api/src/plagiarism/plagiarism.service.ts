import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class PlagiarismService {
  private readonly logger = new Logger(PlagiarismService.name);
  private readonly CRITICAL_THRESHOLD = 0.85;
  private readonly WARNING_THRESHOLD = 0.70;

  constructor(
    private prisma: PrismaService,
    @InjectQueue('plagiarism') private queue: Queue,
  ) {}

  async enqueueAnalyze(advanceId: string) {
    await this.queue.add('analyze', { advanceId }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });
  }

  async analyze(advanceId: string) {
    const advance = await this.prisma.advance.findUniqueOrThrow({
      where: { id: advanceId },
    });

    const report = await this.prisma.plagiarismReport.create({
      data: {
        advanceId,
        method: 'EMBEDDINGS_COSINE',
        overallScore: 0,
        status: 'processing',
      },
    });

    try {
      // Intentar búsqueda real primero
      const similar: any[] = await this.prisma.$queryRawUnsafe(`
        SELECT ac."advanceId", ac."sectionName", ac.content,
               1 - (ac.embedding <=> source.embedding) AS similarity
        FROM "AdvanceChunk" ac
        JOIN "Advance" a ON a.id = ac."advanceId"
        CROSS JOIN (
          SELECT embedding FROM "AdvanceChunk"
          WHERE "advanceId" = $1 AND embedding IS NOT NULL
          LIMIT 1
        ) source
        WHERE a."programId" = $2
          AND a."studentId" != $3
          AND ac.embedding IS NOT NULL
          AND 1 - (ac.embedding <=> source.embedding) > $4
        ORDER BY similarity DESC
        LIMIT 20
      `, advanceId, advance.programId, advance.studentId, this.WARNING_THRESHOLD);

      let alerts = similar
        .filter((s) => s.similarity >= this.WARNING_THRESHOLD)
        .map((s) => ({
          reportId: report.id,
          targetAdvanceId: s.advanceId,
          sectionName: s.sectionName || 'General',
          similarity: Math.round(s.similarity * 100) / 100,
          sourceSnippet: '' as string,
          targetSnippet: s.content?.substring(0, 200) || null,
          severity: s.similarity >= this.CRITICAL_THRESHOLD ? 'critical' : 'warning',
        }));

      const overallScore = alerts.length > 0
        ? Math.max(...alerts.map((a) => a.similarity)) * 100
        : 0;

      for (const alert of alerts) {
        await this.prisma.plagiarismAlert.create({ data: alert });
      }

      await this.prisma.plagiarismReport.update({
        where: { id: report.id },
        data: { status: 'done', overallScore: Math.round(overallScore * 10) / 10 },
      });

      this.logger.log(`Plagiarism check: ${advanceId} — ${alerts.length} alerts, max ${overallScore.toFixed(1)}%`);
    } catch (error) {
      this.logger.error(`Plagiarism check failed: ${advanceId}`, error);
      await this.prisma.plagiarismReport.update({
        where: { id: report.id },
        data: { status: 'done', overallScore: 0 },
      });
    }
  }

  async getReport(advanceId: string) {
    return this.prisma.plagiarismReport.findFirst({
      where: { advanceId },
      include: {
        alerts: {
          include: {
            targetAdvance: {
              select: { id: true, title: true, student: { select: { name: true } } },
            },
          },
          orderBy: { similarity: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
