import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AiAnalysisService } from '../ai-analysis/ai-analysis.service';
import { PlagiarismService } from '../plagiarism/plagiarism.service';
import { ReferencesService } from '../references/references.service';
import { randomUUID } from 'crypto';

@Injectable()
export class AdvancesService {
  private readonly logger = new Logger(AdvancesService.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private aiAnalysisService: AiAnalysisService,
    private plagiarismService: PlagiarismService,
    private referencesService: ReferencesService,
  ) {}

  async findAll(filters: {
    studentId?: string;
    programId?: string;
    status?: string;
    advisorId?: string;
    limit?: number;
  }) {
    const where: any = {};

    if (filters.studentId) where.studentId = filters.studentId;
    if (filters.programId) where.programId = filters.programId;
    if (filters.status) where.status = filters.status;
    if (filters.advisorId) {
      where.student = { advisorId: filters.advisorId };
    }

    return this.prisma.advance.findMany({
      where,
      take: filters.limit || 100,
      include: {
        student: { select: { id: true, name: true, email: true } },
        program: { select: { name: true } },
        template: { select: { name: true, version: true } },
        aiAnalysis: {
          select: {
            overallScore: true,
            gradeConverted: true,
            originalityScore: true,
            _count: { select: { findings: true } },
          },
        },
        plagiarismReports: {
          select: { overallScore: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        review: {
          select: { finalGrade: true, status: true, reviewer: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const advance = await this.prisma.advance.findUnique({
      where: { id },
      include: {
        student: { select: { id: true, name: true, email: true } },
        program: true,
        template: true,
        aiAnalysis: { include: { findings: { orderBy: { severity: 'asc' } } } },
        review: { include: { reviewer: { select: { name: true } } } },
        plagiarismReports: {
          include: { alerts: { orderBy: { similarity: 'desc' }, take: 10 } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        referenceAnalysis: {
          include: { references: { orderBy: { status: 'asc' } } },
        },
      },
    });

    if (!advance) throw new NotFoundException('Avance no encontrado');
    return advance;
  }

  async upload(
    file: Express.Multer.File,
    data: {
      studentId: string;
      programId: string;
      templateId: string;
      title: string;
      advanceType: string;
    },
  ) {
    const fileType = file.originalname.endsWith('.docx') ? 'docx' : 'pdf';
    const fileKey = `advances/${data.studentId}/${randomUUID()}.${fileType}`;

    // Subir a MinIO
    await this.storage.upload(fileKey, file.buffer, file.mimetype);

    // Determinar versión
    const existingVersions = await this.prisma.advance.count({
      where: {
        studentId: data.studentId,
        advanceType: data.advanceType,
      },
    });

    // Si programId no viene en el token (caso Admin), lo sacamos del template
    let programId = data.programId;
    if (!programId) {
      const template = await this.prisma.thesisTemplate.findUnique({
        where: { id: data.templateId },
        select: { programId: true },
      });
      programId = template?.programId || '';
    }

    // Crear avance
    const advance = await this.prisma.advance.create({
      data: {
        title: data.title,
        advanceType: data.advanceType,
        version: existingVersions + 1,
        fileKey,
        fileType,
        fileSizeBytes: file.size,
        status: 'PENDING',
        student: { connect: { id: data.studentId } },
        program: { connect: { id: programId } },
        template: { connect: { id: data.templateId } },
      },
    });

    this.logger.log(`Advance uploaded: ${advance.id} by student ${data.studentId}`);

    // Auditoría
    await this.prisma.auditLog.create({
      data: {
        userId: data.studentId,
        action: 'UPLOAD_ADVANCE',
        entity: 'Advance',
        entityId: advance.id,
        metadata: { title: data.title, advanceType: data.advanceType },
      },
    });

    // Encolar análisis IA (plagiarism y references se encolan desde el worker de AI después de crear embeddings)
    await this.aiAnalysisService.enqueueAnalyze(advance.id);

    return advance;
  }

  async bulkUpload(
    files: Express.Multer.File[],
    data: { templateId: string; advanceType: string; studentId?: string; studentIds?: string },
  ) {
    const template = await this.prisma.thesisTemplate.findUnique({
      where: { id: data.templateId },
      select: { programId: true },
    });
    if (!template) throw new NotFoundException('Template no encontrado');

    let studentIdsArray: string[] = [];
    if (data.studentIds) {
      try {
        studentIdsArray = JSON.parse(data.studentIds);
      } catch (e) {
        this.logger.error('Error parsing studentIds array in bulkUpload:', e);
      }
    }

    const results = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const targetStudentId = studentIdsArray[i] || data.studentId;
      if (!targetStudentId) {
        throw new BadRequestException(`No se especificó un estudiante para el archivo: ${file.originalname}`);
      }

      const fileType = file.originalname.endsWith('.docx') ? 'docx' : 'pdf';
      const fileKey = `advances/${targetStudentId}/${randomUUID()}.${fileType}`;
      const title = file.originalname.replace(/\.[^/.]+$/, '');

      await this.storage.upload(fileKey, file.buffer, file.mimetype);

      const existingVersions = await this.prisma.advance.count({
        where: { studentId: targetStudentId, advanceType: data.advanceType },
      });

      const advance = await this.prisma.advance.create({
        data: {
          title,
          advanceType: data.advanceType,
          version: existingVersions + 1,
          fileKey,
          fileType,
          fileSizeBytes: file.size,
          status: 'PENDING',
          student: { connect: { id: targetStudentId } },
          program: { connect: { id: template.programId } },
          template: { connect: { id: data.templateId } },
        },
      });

      // Solo encolar AI analysis; plagiarism y references se encolan desde el worker de AI después de crear embeddings
      await this.aiAnalysisService.enqueueAnalyze(advance.id);

      results.push(advance);
    }

    return results;
  }

  async getPreviewUrl(id: string) {
    const advance = await this.prisma.advance.findUnique({ where: { id } });
    if (!advance) throw new NotFoundException('Avance no encontrado');
    return this.storage.getPresignedUrl(advance.fileKey);
  }

  async getStudentAdvances(studentId: string) {
    const advances = await this.prisma.advance.findMany({
      where: { studentId },
      include: {
        aiAnalysis: {
          select: {
            overallScore: true,
            gradeConverted: true,
            _count: { select: { findings: true } },
          },
        },
        review: { select: { finalGrade: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const stats = {
      averageScore: 0,
      pendingCount: 0,
    };

    if (advances.length > 0) {
      const scoresArr = advances
        .filter((a: any) => a.aiAnalysis)
        .map((a: any) => a.aiAnalysis!.overallScore);
      stats.averageScore = scoresArr.length
        ? scoresArr.reduce((s: number, v: number) => s + v, 0) / scoresArr.length
        : 0;
      stats.pendingCount = advances.filter(
        (a: any) => a.status === 'PENDING' || a.status === 'AI_PROCESSING',
      ).length;
    }

    return { advances, stats };
  }
}
