import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FineTuningService {
  private readonly logger = new Logger(FineTuningService.name);

  constructor(private prisma: PrismaService) {}

  async getStats() {
    const [totalPairs, byOutcome, byProgram, datasets, activeModel] =
      await Promise.all([
        this.prisma.fineTuningPair.count(),
        this.prisma.fineTuningPair.groupBy({
          by: ['outcomeType'],
          _count: { _all: true },
        }),
        this.prisma.fineTuningPair.groupBy({
          by: ['programId'],
          _count: { _all: true },
        }),
        this.prisma.fineTuningDataset.findMany({
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
        this.getActiveModel(),
      ]);

    return { totalPairs, byOutcome, byProgram, datasets, activeModel };
  }

  async getDatasets() {
    return this.prisma.fineTuningDataset.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async exportDataset() {
    const pairCount = await this.prisma.fineTuningPair.count({
      where: { datasetId: null },
    });

    if (pairCount < 500) {
      throw new BadRequestException(
        `Se requieren al menos 500 pares de fine-tuning validados. Actualmente hay ${pairCount}.`,
      );
    }

    const pairs = await this.prisma.fineTuningPair.findMany({
      where: { datasetId: null },
      take: 2000,
      include: {
        finding: {
          select: { sectionRef: true, severity: true, description: true },
        },
      },
    });

    // Generar JSONL para fine-tuning OpenAI
    const jsonlLines = pairs.map((pair: any) => {
      const original = pair.originalOutput as any;
      const correction = pair.humanCorrection as any;

      return JSON.stringify({
        messages: [
          {
            role: 'system',
            content:
              'Eres un evaluador académico experto. Analiza hallazgos de revisión de tesis y genera retroalimentación precisa.',
          },
          {
            role: 'user',
            content: `Evalúa este hallazgo (tipo avance: ${pair.advanceType}):\nSección: ${original.sectionRef}\nSeveridad: ${original.severity}\nDescripción: ${original.description}`,
          },
          {
            role: 'assistant',
            content: JSON.stringify(correction),
          },
        ],
      });
    });

    // Crear dataset en BD
    const dataset = await this.prisma.fineTuningDataset.create({
      data: {
        name: `Dataset-${new Date().toISOString().split('T')[0]}`,
        description: `Auto-generado: ${pairs.length} pares`,
        status: 'READY',
        pairCount: pairs.length,
      },
    });

    return {
      datasetId: dataset.id,
      pairCount: pairs.length,
      jsonl: jsonlLines.join('\n'),
    };
  }

  // ─── Activar modelo fine-tuneado ──────────────────────────────────────────
  async activateModel(datasetId: string, fineTunedModelId: string) {
    this.logger.log(`Activating fine-tuned model: ${fineTunedModelId} from dataset ${datasetId}`);

    // Guardar modelId en el dataset
    await this.prisma.fineTuningDataset.update({
      where: { id: datasetId },
      data: {
        modelId: fineTunedModelId,
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    // Actualizar configuración global del sistema
    await this.prisma.systemSettings.upsert({
      where: { id: 'default' },
      update: { aiModel: fineTunedModelId },
      create: {
        id: 'default',
        institutionName: 'Universidad Nacional',
        maxGrade: 20,
        aiModel: fineTunedModelId,
        rigorLevel: 'Alto',
      },
    });

    this.logger.log(`✅ Fine-tuned model activated: ${fineTunedModelId}`);
    return { message: 'Modelo activado correctamente', model: fineTunedModelId };
  }

  // ─── Desactivar modelo fine-tuneado (volver al base) ─────────────────────
  async deactivateModel() {
    const defaultModel = process.env.AI_MODEL || 'gpt-4o';

    await this.prisma.systemSettings.upsert({
      where: { id: 'default' },
      update: { aiModel: defaultModel },
      create: {
        id: 'default',
        institutionName: 'Universidad Nacional',
        maxGrade: 20,
        aiModel: defaultModel,
        rigorLevel: 'Alto',
      },
    });

    this.logger.log(`Fine-tuned model deactivated, reverted to: ${defaultModel}`);
    return { message: 'Modelo base restaurado', model: defaultModel };
  }

  // ─── Obtener modelo activo ────────────────────────────────────────────────
  async getActiveModel() {
    const settings = await this.prisma.systemSettings.findUnique({
      where: { id: 'default' },
    });
    return settings?.aiModel || process.env.AI_MODEL || 'gpt-4o';
  }

  // ─── Iniciar job de fine-tuning en OpenAI API ─────────────────────────────
  async startFineTuningJob(datasetId: string, jsonl: string) {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey || openaiKey.includes('your-openai-key')) {
      throw new BadRequestException('OPENAI_API_KEY no configurada.');
    }

    this.logger.log(`Starting OpenAI fine-tuning job for dataset: ${datasetId}`);

    // Nota: En producción real, aquí se subiría el JSONL a OpenAI Files API
    // y se lanzaría el job. Por ahora retorna instrucciones.
    return {
      instructions: [
        '1. Descarga el JSONL del endpoint de export',
        '2. Sube el archivo: openai files create --purpose fine-tune --file dataset.jsonl',
        '3. Crea el job: openai fine_tuning.jobs.create --training-file <file_id> --model gpt-4o-mini',
        '4. Espera la notificación de OpenAI y usa el endpoint activate con el model ID resultante',
      ],
      datasetId,
      exportEndpoint: '/api/fine-tuning/export',
      activateEndpoint: `/api/fine-tuning/datasets/${datasetId}/activate`,
    };
  }
}
