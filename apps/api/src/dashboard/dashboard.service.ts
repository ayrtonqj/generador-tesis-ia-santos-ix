import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getKPIs(programId?: string) {
    const where = programId ? { programId } : {};

    const [
      totalAdvances,
      byStatus,
      avgAIScore,
      avgHumanGrade,
      recentActivity,
      plagiarismAlerts,
      byOutcome,
    ] = await Promise.all([
      this.prisma.advance.count({ where }),
      this.prisma.advance.groupBy({ by: ['status'], where, _count: { _all: true } }),
      this.prisma.aIAnalysis.aggregate({
        _avg: { overallScore: true, gradeConverted: true },
        where: { advance: where },
      }),
      this.prisma.review.aggregate({
        _avg: { finalGrade: true },
        where: { advance: where },
      }),
      this.prisma.auditLog.findMany({
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true, role: true } } },
      }),
      this.prisma.plagiarismAlert.count({
        where: { severity: 'critical', report: { advance: where } },
      }),
      this.prisma.fineTuningPair.groupBy({
        by: ['outcomeType'],
        _count: { _all: true },
        where: where.programId ? { programId: where.programId } : {},
      }),
    ]);

    const statusMap = Object.fromEntries(
      byStatus.map((s: any) => [s.status, s._count._all]),
    );

    const totalPairs = byOutcome.reduce((sum: number, o: any) => sum + o._count._all, 0);
    const acceptedPairs = byOutcome.find((o: any) => o.outcomeType === 'ACCEPTED')?._count._all || 0;
    const aiHumanConcordance = totalPairs > 0 ? Math.round((acceptedPairs / totalPairs) * 100) : 0;

    return {
      totalAdvances,
      pendingAdvances: (statusMap['PENDING'] || 0) + (statusMap['AI_PROCESSING'] || 0),
      reviewedAdvances: statusMap['APPROVED'] || 0,
      rejectedAdvances: statusMap['REJECTED'] || 0,
      observedAdvances: statusMap['OBSERVED'] || 0,
      inReviewAdvances: statusMap['HUMAN_REVIEW'] || 0,
      avgAIScore: Math.round((avgAIScore._avg.overallScore || 0) * 10) / 10,
      avgAIGrade: Math.round((avgAIScore._avg.gradeConverted || 0) * 10) / 10,
      avgHumanGrade: Math.round((avgHumanGrade._avg.finalGrade || 0) * 10) / 10,
      aiHumanConcordance,
      plagiarismAlerts,
      recentActivity: recentActivity.map((log: any) => ({
        id: log.id,
        type: log.action,
        message: `${log.user.name} — ${log.action}`,
        userName: log.user.name,
        entityId: log.entityId,
        createdAt: log.createdAt,
      })),
    };
  }

  async getStatsByProgram() {
    return this.prisma.program.findMany({
      where: { isActive: true },
      include: {
        _count: { select: { users: true, advances: true } },
        advances: {
          select: {
            aiAnalysis: {
              select: {
                overallScore: true,
                structureScore: true,
                contentScore: true,
                formScore: true,
                originalityScore: true,
              },
            },
            review: { select: { finalGrade: true } },
          },
        },
      },
    });
  }
}
