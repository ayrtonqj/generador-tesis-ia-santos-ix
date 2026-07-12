import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReviewService {
  constructor(private prisma: PrismaService) {}

  async createOrUpdate(data: {
    advanceId: string;
    reviewerId: string;
    finalGrade?: number;
    humanComment?: string;
    rubricAnswers?: any;
    status: string;
  }) {
    const existing = await this.prisma.review.findUnique({
      where: { advanceId: data.advanceId },
    });

    const aiAnalysis = await this.prisma.aIAnalysis.findUnique({
      where: { advanceId: data.advanceId },
      select: { gradeConverted: true },
    });

    const reviewData = {
      reviewerId: data.reviewerId,
      finalGrade: data.finalGrade,
      aiGrade: aiAnalysis?.gradeConverted,
      humanComment: data.humanComment,
      rubricAnswers: data.rubricAnswers,
      status: data.status as any,
      reviewedAt: new Date(),
    };

    const review = existing
      ? await this.prisma.review.update({
          where: { advanceId: data.advanceId },
          data: reviewData,
        })
      : await this.prisma.review.create({
          data: { advanceId: data.advanceId, ...reviewData },
        });

    // Actualizar estado del avance
    await this.prisma.advance.update({
      where: { id: data.advanceId },
      data: { status: data.status as any },
    });

    // Auditoría
    await this.prisma.auditLog.create({
      data: {
        userId: data.reviewerId,
        action: 'REVIEW_ADVANCE',
        entity: 'Review',
        entityId: review.id,
        metadata: { status: data.status, grade: data.finalGrade },
      },
    });

    return review;
  }

  async submitFindingFeedback(data: {
    findingId: string;
    reviewerId: string;
    action: string;
    humanComment?: string;
    adjustedSeverity?: string;
    adjustedDescription?: string;
  }) {
    const finding = await this.prisma.aIFinding.update({
      where: { id: data.findingId },
      data: {
        humanAction: data.action as any,
        humanComment: data.humanComment,
        adjustedSeverity: data.adjustedSeverity as any,
        adjustedDescription: data.adjustedDescription,
        reviewedAt: new Date(),
      },
      include: {
        analysis: {
          include: {
            advance: { select: { advanceType: true, programId: true } },
          },
        },
      },
    });

    // Crear par de fine-tuning — siempre (ACCEPTED es señal positiva igual de valiosa)
    const originalOutput = {
      sectionRef: finding.sectionRef,
      severity: finding.severity,
      description: finding.description,
      correctionSteps: finding.correctionSteps,
    };

    const humanCorrection = {
      ...originalOutput,
      ...(data.adjustedSeverity && { severity: data.adjustedSeverity }),
      ...(data.adjustedDescription && { description: data.adjustedDescription }),
      humanComment: data.humanComment,
      action: data.action,
    };

    const outcomeType =
      data.action === 'ACCEPTED' ? 'ACCEPTED' :
      data.action === 'MODIFIED' ? 'ACCEPTED_WITH_EDIT' : 'DISCARDED';

    await this.prisma.fineTuningPair.create({
      data: {
        findingId: data.findingId,
        originalOutput,
        humanCorrection,
        outcomeType,
        reviewerId: data.reviewerId,
        advanceType: finding.analysis.advance.advanceType,
        programId: finding.analysis.advance.programId,
      },
    });

    return finding;
  }

  async getReview(advanceId: string) {
    return this.prisma.review.findUnique({
      where: { advanceId },
      include: { reviewer: { select: { name: true, email: true } } },
    });
  }
}
