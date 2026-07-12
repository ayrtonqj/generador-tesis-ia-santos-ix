import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenAIEmbeddings } from '@langchain/openai';
import { NotificationsService } from '../notifications/notifications.service';
import * as crypto from 'crypto';

@Injectable()
export class OrcidService {
  private readonly logger = new Logger(OrcidService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  getAuthorizationUrl(userId: string): string {
    const state = `${userId}:${crypto.randomBytes(16).toString('hex')}`;
    const params = new URLSearchParams({
      client_id: process.env.ORCID_CLIENT_ID || '',
      response_type: 'code',
      scope: '/authenticate /read-limited',
      redirect_uri: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/orcid/callback`,
      state,
    });
    return `https://orcid.org/oauth/authorize?${params.toString()}`;
  }

  async handleCallback(code: string, state: string) {
    const [userId] = state.split(':');

    const tokenRes = await fetch('https://orcid.org/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.ORCID_CLIENT_ID || '',
        client_secret: process.env.ORCID_CLIENT_SECRET || '',
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/orcid/callback`,
      }),
    });

    const tokenData = await tokenRes.json();

    // Fetch publications from ORCID Public API
    let publications = [];
    try {
      const pubRes = await fetch(`https://pub.orcid.org/v3.0/${tokenData.orcid}/works`, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      });
      if (pubRes.ok) {
        const pubData = await pubRes.json();
        const works = pubData?.group || [];
        publications = works.map((group: any) => {
          const workSummary = group['work-summary']?.[0];
          return {
            title: workSummary?.title?.title?.value || 'Título desconocido',
            year: workSummary?.['publication-date']?.year?.value || null,
            journal: workSummary?.['journal-title']?.value || null,
            doi: workSummary?.['external-ids']?.['external-id']?.find((id: any) => id['external-id-type'] === 'doi')?.['external-id-value'] || null,
            url: workSummary?.url?.value || null,
          };
        });
      }
    } catch (e) {
      this.logger.error('Error fetching ORCID publications', e);
    }

    await this.prisma.orcidProfile.upsert({
      where: { userId },
      create: {
        userId,
        orcidId: tokenData.orcid,
        accessToken: this.encrypt(tokenData.access_token),
        refreshToken: this.encrypt(tokenData.refresh_token || ''),
        tokenExpiry: new Date(Date.now() + (tokenData.expires_in || 3600) * 1000),
        displayName: tokenData.name,
      },
      update: {
        accessToken: this.encrypt(tokenData.access_token),
        refreshToken: this.encrypt(tokenData.refresh_token || ''),
        tokenExpiry: new Date(Date.now() + (tokenData.expires_in || 3600) * 1000),
      },
    });

    if (publications.length > 0) {
      // Clear existing to refresh
      await this.prisma.orcidPublication.deleteMany({ where: { profileId: tokenData.orcid } });
      await this.prisma.orcidPublication.createMany({
        data: publications.map((p: any) => ({
          profileId: tokenData.orcid,
          ...p,
        })),
        skipDuplicates: true,
      });
    }

    // Ejecutar validación cruzada semántica para todos los alumnos asignados
    const advisees = await this.prisma.user.findMany({
      where: { advisorId: userId },
      select: { id: true },
    });
    for (const student of advisees) {
      await this.validateAdvisorSuitability(student.id, userId).catch(err => {
        this.logger.error(`Error en validación automática ORCID para estudiante ${student.id}:`, err);
      });
    }

    return { success: true, orcidId: tokenData.orcid };
  }

  async getProfile(userId: string) {
    return this.prisma.orcidProfile.findUnique({
      where: { userId },
      include: { publications: { orderBy: { year: 'desc' }, take: 20 } },
    });
  }

  async validateAdvisorSuitability(studentId: string, advisorId: string): Promise<boolean> {
    this.logger.log(`Iniciando validación cruzada para estudiante: ${studentId} y asesor: ${advisorId}`);

    const latestAdvance = await this.prisma.advance.findFirst({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      select: { title: true },
    });

    if (!latestAdvance || !latestAdvance.title) {
      this.logger.warn(`Estudiante ${studentId} no tiene avances de tesis cargados para verificar su tema.`);
      return true;
    }

    const thesisTitle = latestAdvance.title;

    const advisorProfile = await this.prisma.orcidProfile.findUnique({
      where: { userId: advisorId },
      include: { publications: true },
    });

    if (!advisorProfile || advisorProfile.publications.length === 0) {
      this.logger.warn(`El asesor ${advisorId} no ha vinculado su cuenta ORCID o no tiene publicaciones.`);
      return true;
    }

    const publications = advisorProfile.publications;

    try {
      const embeddingsModel = new OpenAIEmbeddings({
        apiKey: process.env.OPENAI_API_KEY || '',
        model: process.env.AI_EMBEDDING_MODEL || 'text-embedding-3-large',
      });

      const [thesisVector] = await embeddingsModel.embedDocuments([thesisTitle]);

      const pubTitles = publications.map((p: any) => p.title);
      const pubVectors = await embeddingsModel.embedDocuments(pubTitles);

      let maxSimilarity = 0;
      let bestMatchTitle = '';

      for (let i = 0; i < pubVectors.length; i++) {
        const sim = this.cosineSimilarity(thesisVector, pubVectors[i]);
        if (sim > maxSimilarity) {
          maxSimilarity = sim;
          bestMatchTitle = pubTitles[i];
        }
      }

      this.logger.log(`Validación cruzada completada. Similitud máxima de coseno: ${maxSimilarity.toFixed(4)} con publicación: "${bestMatchTitle}"`);

      const threshold = 0.60;
      if (maxSimilarity < threshold) {
        this.logger.warn(`Alerta de idoneidad: Similitud temática de ${maxSimilarity.toFixed(2)} es inferior al umbral ${threshold}`);

        const coordinators = await this.prisma.user.findMany({
          where: { role: 'COORDINATOR' },
          select: { id: true },
        });

        const student = await this.prisma.user.findUnique({ where: { id: studentId }, select: { name: true } });
        const advisor = await this.prisma.user.findUnique({ where: { id: advisorId }, select: { name: true } });

        for (const coord of coordinators) {
          await this.notificationsService.createNotification({
            userId: coord.id,
            title: 'Alerta de Idoneidad Temática (ORCID)',
            body: `El asesor ${advisor?.name || 'designado'} no tiene publicaciones estrechamente relacionadas con el tema de tesis del estudiante ${student?.name || ''} (Similitud: ${(maxSimilarity * 100).toFixed(0)}%).`,
            type: 'ORCID_COMPATIBILITY_ALERT',
            data: {
              studentId,
              advisorId,
              thesisTitle,
              maxSimilarity,
              bestMatchTitle,
            },
          });
        }

        return false;
      }

      return true;
    } catch (err) {
      this.logger.error('Error durante la validación cruzada semántica de ORCID:', err);
      return true;
    }
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private encrypt(text: string): string {
    try {
      const iv = crypto.randomBytes(16);
      const key = Buffer.from(process.env.ENCRYPTION_KEY || '0'.repeat(64), 'hex');
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      return iv.toString('hex') + ':' + cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
    } catch {
      return text;
    }
  }
}
