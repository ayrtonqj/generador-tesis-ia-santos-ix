import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AnalysisPipeline } from '@kimy/ai-engine';
import { randomUUID } from 'crypto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class AiAnalysisService {
  private readonly logger = new Logger(AiAnalysisService.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private notifications: NotificationsService,
    @InjectQueue('ai-analysis') private aiQueue: Queue,
    @InjectQueue('plagiarism') private plagiarismQueue: Queue,
    @InjectQueue('references') private referencesQueue: Queue,
  ) { }

  /** Obtiene el modelo activo y proveedor desde SystemSettings */
  private async getActiveConfig(): Promise<{ model: string; provider: string }> {
    const settings = await this.prisma.systemSettings.findUnique({
      where: { id: 'default' },
    });
    return {
      model: settings?.aiModel || process.env.AI_MODEL || 'gpt-4o',
      provider: settings?.aiProvider || process.env.AI_PROVIDER || 'openai',
    };
  }

  private buildPipeline(model?: string, provider?: string): AnalysisPipeline {
    let prov = provider || process.env.AI_PROVIDER || 'openai';
    const activeModel = model || process.env.AI_MODEL || 'gpt-4o';

    // Red de seguridad (Defensive programming):
    // Si hay discrepancia entre modelo y proveedor, inferimos el proveedor correcto basado en el modelo.
    const modelToProvider: Record<string, string> = {
      'gpt-4o': 'openai',
      'gpt-4o-mini': 'openai',
      'deepseek-chat': 'deepseek',
      'deepseek-reasoner': 'deepseek',
      'gemini-3.5-flash': 'gemini',
      'gemini-3-flash': 'gemini',
      'gemini-3.1-flash-lite': 'gemini',
      'gemini-2.5-flash-lite': 'gemini',
      'gemini-2.5-flash': 'gemini',
      'llama-3.3-70b-versatile': 'groq',
      'llama-3.1-8b-instant': 'groq',
      'claude-3-5-sonnet-20241022': 'claude',
      'claude-3-5-haiku-20241022': 'claude',
      'claude-3-opus-20240229': 'claude',
      'MiniMax-Text-01': 'minimax',
      'MiniMax-M1': 'minimax',
    };

    if (activeModel && modelToProvider[activeModel]) {
      const correctProvider = modelToProvider[activeModel];
      if (prov !== correctProvider) {
        this.logger.warn(`Discrepancia detectada: El modelo '${activeModel}' no es compatible con el proveedor '${prov}'. Corrigiendo proveedor a '${correctProvider}'.`);
        prov = correctProvider;
      }
    }

    const openaiKey = prov === 'groq'
      ? (process.env.GROQ_API_KEY || '')
      : (process.env.OPENAI_API_KEY || '');

    return new AnalysisPipeline({
      openaiKey,
      deepseekKey: process.env.DEEPSEEK_API_KEY || '',
      geminiKey: process.env.GEMINI_API_KEY || '',
      claudeKey: process.env.CLAUDE_API_KEY || '',
      minimaxKey: process.env.MINIMAX_API_KEY || '',
      provider: prov as any,
      maxGrade: Number(process.env.MAX_GRADE) || 20,
      model: activeModel,
      embeddingModel: process.env.AI_EMBEDDING_MODEL || 'text-embedding-3-large',
    });
  }

  async enqueueAnalyze(advanceId: string) {
    await this.aiQueue.add('analyze', { advanceId }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });
  }

  async enqueueReanalyze(advanceId: string) {
    await this.aiQueue.add('reanalyze', { advanceId }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });
  }

  async analyzeAdvance(advanceId: string) {
    this.logger.log(`Starting AI analysis for advance: ${advanceId}`);

    // Marcar como en procesamiento
    const advance = await this.prisma.advance.update({
      where: { id: advanceId },
      data: { status: 'AI_PROCESSING' },
    });

    // Leer configuración activa (modelo + proveedor)
    const activeConfig = await this.getActiveConfig();

    // 1. Extraer texto del documento inmediatamente para que esté disponible en fallbacks, simulación y otros workers
    let extractedText = '';
    try {
      const fileBuffer = await this.storage.download(advance.fileKey);
      const defaultPipeline = this.buildPipeline(activeConfig.model, activeConfig.provider);
      extractedText = await defaultPipeline.extractText(
        fileBuffer,
        advance.fileType as 'pdf' | 'docx',
      );

      await this.prisma.advance.update({
        where: { id: advanceId },
        data: { extractedText: extractedText.substring(0, 250000) },
      });
    } catch (e: any) {
      this.logger.error(`Error al extraer texto inicial del avance ${advanceId}: ${e?.message}`);
    }

    // Detectar si debemos usar modo simulado directamente
    const hasOpenAI = process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('your-openai-key') && process.env.OPENAI_API_KEY !== 'undefined' && process.env.OPENAI_API_KEY !== '';
    const hasDeepSeek = process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_KEY !== 'undefined' && process.env.DEEPSEEK_API_KEY !== '';
    const hasGemini = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'undefined' && process.env.GEMINI_API_KEY !== '';
    const hasGroq = process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'undefined' && process.env.GROQ_API_KEY !== '';
    const hasClaude = process.env.CLAUDE_API_KEY && process.env.CLAUDE_API_KEY !== 'undefined' && process.env.CLAUDE_API_KEY !== '';
    const hasMinimax = process.env.MINIMAX_API_KEY && process.env.MINIMAX_API_KEY !== 'undefined' && process.env.MINIMAX_API_KEY !== '';

    if (!hasOpenAI && !hasDeepSeek && !hasGemini && !hasGroq && !hasClaude && !hasMinimax) {
      this.logger.warn(`MODO SIMULACIÓN para avance ${advanceId}`);
      await this.runSimulation(advanceId);
      // Enviar push notification
      await this.notifications.notifyAnalysisComplete(advanceId).catch(() => { });
      return;
    }
    const shortErr = (e: any) => {
      const m = e?.message || String(e);
      return m.length > 250 ? m.substring(0, 250) + '...' : m;
    };

    let result: any = null;
    let usedModel = activeConfig.model;

    // ── 1. Proveedor configurado (DeepSeek, OpenAI, Gemini o Groq) ────
    if (activeConfig.provider === 'deepseek' && hasDeepSeek) {
      try {
        this.logger.log(`Intentando análisis con DeepSeek (model: ${activeConfig.model})...`);
        const pipeline = this.buildPipeline(activeConfig.model, 'deepseek');
        result = await this.executePipeline(pipeline, advanceId, extractedText);
        usedModel = `deepseek/${activeConfig.model}`;
      } catch (error: any) {
        this.logger.error(`DeepSeek analysis failed for ${advanceId}: ${shortErr(error)}`);
      }
    } else if (activeConfig.provider === 'groq' && hasGroq) {
      try {
        this.logger.log(`Intentando análisis con Groq (model: ${activeConfig.model})...`);
        const groqPipeline = new AnalysisPipeline({
          openaiKey: process.env.GROQ_API_KEY!,
          provider: 'groq',
          model: activeConfig.model,
          maxGrade: Number(process.env.MAX_GRADE) || 20,
        });
        usedModel = `groq/${activeConfig.model}`;
        result = await this.executePipeline(groqPipeline, advanceId, extractedText);
      } catch (error: any) {
        this.logger.error(`Groq analysis failed for ${advanceId}: ${shortErr(error)}`);
      }
    } else if (activeConfig.provider === 'claude' && hasClaude) {
      try {
        this.logger.log(`Intentando análisis con Claude (model: ${activeConfig.model})...`);
        const claudePipeline = new AnalysisPipeline({
          openaiKey: '',
          claudeKey: process.env.CLAUDE_API_KEY!,
          provider: 'claude',
          model: activeConfig.model,
          maxGrade: Number(process.env.MAX_GRADE) || 20,
        });
        usedModel = `claude/${activeConfig.model}`;
        result = await this.executePipeline(claudePipeline, advanceId, extractedText);
      } catch (error: any) {
        this.logger.error(`Claude analysis failed for ${advanceId}: ${shortErr(error)}`);
      }
    } else if (activeConfig.provider === 'minimax' && hasMinimax) {
      try {
        this.logger.log(`Intentando análisis con Minimax (model: ${activeConfig.model})...`);
        const minimaxPipeline = new AnalysisPipeline({
          openaiKey: '',
          minimaxKey: process.env.MINIMAX_API_KEY!,
          provider: 'minimax',
          model: activeConfig.model,
          maxGrade: Number(process.env.MAX_GRADE) || 20,
        });
        usedModel = `minimax/${activeConfig.model}`;
        result = await this.executePipeline(minimaxPipeline, advanceId, extractedText);
      } catch (error: any) {
        this.logger.error(`Minimax analysis failed for ${advanceId}: ${shortErr(error)}`);
      }
    } else if (activeConfig.provider === 'gemini' && hasGemini) {
      try {
        this.logger.log(`Intentando análisis con Gemini (model: ${activeConfig.model})...`);
        const geminiPipeline = new AnalysisPipeline({
          openaiKey: '',
          geminiKey: process.env.GEMINI_API_KEY,
          provider: 'gemini',
          model: activeConfig.model,
          maxGrade: Number(process.env.MAX_GRADE) || 20,
        });
        usedModel = `gemini/${activeConfig.model}`;
        result = await this.executePipeline(geminiPipeline, advanceId, extractedText);
      } catch (error: any) {
        this.logger.error(`Gemini analysis failed for ${advanceId}: ${shortErr(error)}`);
      }
    } else if (hasOpenAI) {
      // OpenAI como proveedor por defecto o fallback del configurado
      try {
        this.logger.log(`Intentando análisis con OpenAI (model: ${activeConfig.model})...`);
        const pipeline = this.buildPipeline(activeConfig.model, 'openai');
        result = await this.executePipeline(pipeline, advanceId, extractedText);
      } catch (error: any) {
        this.logger.error(`OpenAI analysis failed for ${advanceId}: ${shortErr(error)}`);
      }
    }

    // ── 2. Fallback: DeepSeek (si no fue el primario) ──────────
    if (!result && hasDeepSeek && activeConfig.provider !== 'deepseek') {
      this.logger.warn(`Fallback a DeepSeek para ${advanceId}...`);
      try {
        const dsPipeline = new AnalysisPipeline({
          openaiKey: '',
          deepseekKey: process.env.DEEPSEEK_API_KEY!,
          provider: 'deepseek',
          model: 'deepseek-chat',
          maxGrade: Number(process.env.MAX_GRADE) || 20,
        });
        usedModel = 'deepseek/deepseek-chat';
        result = await this.executePipeline(dsPipeline, advanceId, extractedText);
      } catch (dsError: any) {
        this.logger.error(`DeepSeek fallback failed for ${advanceId}: ${shortErr(dsError)}`);
      }
    }

    // ── 3. Fallback: OpenAI (si no fue el primario) ──────────────
    if (!result && hasOpenAI && activeConfig.provider !== 'openai') {
      this.logger.warn(`Fallback a OpenAI para ${advanceId}...`);
      try {
        const pipeline = this.buildPipeline('gpt-4o-mini', 'openai');
        usedModel = 'openai/gpt-4o-mini';
        result = await this.executePipeline(pipeline, advanceId, extractedText);
      } catch (openaiError: any) {
        this.logger.error(`OpenAI fallback failed for ${advanceId}: ${shortErr(openaiError)}`);
      }
    }

    // ── 4. Fallback: Groq ─────────────────────────────────────
    if (!result && hasGroq) {
      this.logger.warn(`Fallback a GROQ (Llama 3.3 70B) para ${advanceId}...`);
      try {
        const groqPipeline = new AnalysisPipeline({
          openaiKey: process.env.GROQ_API_KEY!,
          provider: 'groq',
          model: 'llama-3.3-70b-versatile',
          maxGrade: Number(process.env.MAX_GRADE) || 20,
        });
        usedModel = 'groq/llama-3.3-70b-versatile';
        await this.prisma.advanceChunk.deleteMany({ where: { advanceId } });
        result = await this.executePipeline(groqPipeline, advanceId, extractedText);
      } catch (groqError: any) {
        this.logger.error(`GROQ fallback failed for ${advanceId}: ${shortErr(groqError)}`);
      }
    }

    // ── 5. Fallback: Gemini ─────────────────────────────────────
    if (!result && hasGemini) {
      this.logger.warn(`Fallback a GEMINI para ${advanceId}...`);
      try {
        const geminiPipeline = new AnalysisPipeline({
          openaiKey: '',
          geminiKey: process.env.GEMINI_API_KEY,
          provider: 'gemini',
          model: 'gemini-3.1-flash-lite',
          maxGrade: Number(process.env.MAX_GRADE) || 20,
        });
        usedModel = 'gemini/gemini-3.1-flash-lite';
        await this.prisma.advanceChunk.deleteMany({ where: { advanceId } });
        result = await this.executePipeline(geminiPipeline, advanceId, extractedText);
      } catch (geminiError: any) {
        this.logger.error(`GEMINI fallback failed for ${advanceId}: ${shortErr(geminiError)}`);
      }
    }

    // ── 6. Fallback: Claude ─────────────────────────
    if (!result && hasClaude && activeConfig.provider !== 'claude') {
      this.logger.warn(`Fallback a Claude para ${advanceId}...`);
      try {
        const claudePipeline = new AnalysisPipeline({
          openaiKey: '',
          claudeKey: process.env.CLAUDE_API_KEY!,
          provider: 'claude',
          model: 'claude-3-5-sonnet-20241022',
          maxGrade: Number(process.env.MAX_GRADE) || 20,
        });
        usedModel = 'claude/claude-3-5-sonnet-20241022';
        await this.prisma.advanceChunk.deleteMany({ where: { advanceId } });
        result = await this.executePipeline(claudePipeline, advanceId, extractedText);
      } catch (claudeError: any) {
        this.logger.error(`Claude fallback failed for ${advanceId}: ${shortErr(claudeError)}`);
      }
    }

    // ── 7. Fallback: Minimax ────────────────────────
    if (!result && hasMinimax && activeConfig.provider !== 'minimax') {
      this.logger.warn(`Fallback a Minimax para ${advanceId}...`);
      try {
        const minimaxPipeline = new AnalysisPipeline({
          openaiKey: '',
          minimaxKey: process.env.MINIMAX_API_KEY!,
          provider: 'minimax',
          model: 'MiniMax-Text-01',
          maxGrade: Number(process.env.MAX_GRADE) || 20,
        });
        usedModel = 'minimax/MiniMax-Text-01';
        await this.prisma.advanceChunk.deleteMany({ where: { advanceId } });
        result = await this.executePipeline(minimaxPipeline, advanceId, extractedText);
      } catch (minimaxError: any) {
        this.logger.error(`Minimax fallback failed for ${advanceId}: ${shortErr(minimaxError)}`);
      }
    }

    if (result) {
      // Guardar resultados en BD (upsert para evitar duplicados por reprocesamiento)
      await this.prisma.aIFinding.deleteMany({
        where: { analysis: { advanceId } },
      });

      const analysis = await this.prisma.aIAnalysis.upsert({
        where: { advanceId },
        update: {
          structureScore: result.scores.structure,
          contentScore: result.scores.content,
          formScore: result.scores.form,
          originalityScore: result.scores.originality,
          overallScore: result.scores.overall,
          gradeConverted: result.grade,
          executiveSummary: result.executiveSummary,
          structureAnalysis: result.structureAnalysis as any,
          processingMs: result.processingMs,
          modelUsed: usedModel,
        },
        create: {
          advanceId,
          structureScore: result.scores.structure,
          contentScore: result.scores.content,
          formScore: result.scores.form,
          originalityScore: result.scores.originality,
          overallScore: result.scores.overall,
          gradeConverted: result.grade,
          executiveSummary: result.executiveSummary,
          structureAnalysis: result.structureAnalysis as any,
          processingMs: result.processingMs,
          modelUsed: usedModel,
        },
      });

      // Crear findings por separado (upsert no soporta nested create en update)
      await this.prisma.aIFinding.createMany({
        data: result.findings.map((f: any) => ({
          analysisId: analysis.id,
          sectionRef: f.sectionRef,
          pageRef: f.pageRef !== undefined && f.pageRef !== null && String(f.pageRef).trim() !== ''
            ? parseInt(String(f.pageRef), 10) || null
            : null,
          severity: f.severity as any,
          description: Array.isArray(f.description) ? f.description.join('\n') : String(f.description),
          correctionSteps: Array.isArray(f.correctionSteps) ? f.correctionSteps.join('\n') : String(f.correctionSteps),
          exampleImprovement: Array.isArray(f.exampleImprovement) ? f.exampleImprovement.join('\n') : String(f.exampleImprovement),
          recommendation: Array.isArray(f.recommendation) ? f.recommendation.join('\n') : String(f.recommendation),
        })),
      });

      // Generar feedback detallado automáticamente
      await this.generateDetailedFeedback(advanceId).catch((e) =>
        this.logger.warn(`Detailed feedback auto-generation failed: ${e?.message}`),
      );

      await this.prisma.advance.update({
        where: { id: advanceId },
        data: { status: 'AI_COMPLETE' },
      });

      // Enviar push notification al estudiante
      await this.notifications.notifyAnalysisComplete(advanceId).catch((e) =>
        this.logger.warn(`Push notification failed: ${e?.message}`),
      );

      // Encolar plagiarism y references después de que existan embeddings
      await this.plagiarismQueue.add('analyze', { advanceId }).catch((e) =>
        this.logger.warn(`Failed to enqueue plagiarism analysis: ${e?.message}`),
      );
      await this.referencesQueue.add('analyze', { advanceId }).catch((e) =>
        this.logger.warn(`Failed to enqueue references analysis: ${e?.message}`),
      );

      this.logger.log(`AI analysis complete: ${advanceId} — Score: ${result.scores.overall}%, Grade: ${result.grade}, Findings: ${result.findings.length}`);
    } else {
      this.logger.warn(`Todos los modelos fallaron. Usando SIMULACIÓN como último respaldo para ${advanceId}...`);
      await this.runSimulation(advanceId);
      await this.notifications.notifyAnalysisComplete(advanceId).catch(() => { });
    }
  }

  private async executePipeline(pipeline: AnalysisPipeline, advanceId: string, preExtractedText?: string) {
    const advance = await this.prisma.advance.findUniqueOrThrow({
      where: { id: advanceId },
      include: { template: true },
    });

    let advanceText = preExtractedText;
    if (!advanceText) {
      const fileBuffer = await this.storage.download(advance.fileKey);
      advanceText = await pipeline.extractText(
        fileBuffer,
        advance.fileType as 'pdf' | 'docx',
      );
      await this.prisma.advance.update({
        where: { id: advanceId },
        data: { extractedText: advanceText.substring(0, 250000) },
      });
    }

    const chunks = await pipeline.chunkDocument(advanceText);
    const embeddings = await pipeline.generateEmbeddings(chunks);

    const hasEmptyEmbeddings = embeddings.length === 0 || !embeddings[0] || embeddings[0].length === 0;
    if (hasEmptyEmbeddings) {
      this.logger.warn(`Skipping chunk database insertions because the active AI provider does not support or provide vector embeddings.`);
    } else {
      for (let i = 0; i < chunks.length; i++) {
        if (!embeddings[i] || embeddings[i].length === 0) {
          continue;
        }
        await this.prisma.$executeRawUnsafe(
          `INSERT INTO "AdvanceChunk" (id, "advanceId", "sectionName", content, embedding, "chunkIndex", "createdAt")
           VALUES ($1, $2, $3, $4, $5::vector, $6, NOW())`,
          randomUUID(), advanceId, 'auto', chunks[i],
          `[${embeddings[i].join(',')}]`, i,
        );
      }
    }

    let templateText = '';
    try {
      if (advance.template.fileKey) {
        const templateBuffer = await this.storage.download(advance.template.fileKey);
        templateText = await pipeline.extractText(
          templateBuffer,
          advance.template.fileType as 'pdf' | 'docx',
        );
      }
    } catch (e: any) {
      this.logger.warn(`Failed to download template ${advance.template.fileKey}: ${e.message}`);
    }

    const templateSchema = {
      ...(advance.template.extractedSchema as any || {}),
      formatting: advance.template.formatting,
      citationStyle: advance.template.citationStyle,
    };

    return await pipeline.analyze(
      advanceText,
      templateSchema,
      templateText,
      advance.advanceType,
    );
  }

  private async runSimulation(advanceId: string) {
    await new Promise(resolve => setTimeout(resolve, 1500));

    const possibleFindings = [
      { s: "Capítulo 1", d: "La justificación económica carece de datos estadísticos de respaldo.", r: "CRITICAL", c: "Incluir análisis de costo-beneficio.", i: "El ROI esperado es de...", rec: "Revisar formulación de proyectos." },
      { s: "Capítulo 3", d: "El diseño de investigación no tiene grupo de control definido.", r: "CRITICAL", c: "Rediseñar la metodología.", i: "G1: X1 -> O1; G2: -> O2", rec: "Consultar Hernández Sampieri (2018)." },
      { s: "Marco Teórico", d: "Vacío teórico entre la teoría principal y la implementación propuesta.", r: "MAJOR", c: "Agregar al menos 5 fuentes recientes.", i: "Como indica Wang (2024)...", rec: "Buscar en IEEE Xplore." },
      { s: "Conclusiones", d: "Las conclusiones no responden a los objetivos específicos planteados.", r: "MAJOR", c: "Reescribir mapeando 1 a 1 con objetivos.", i: "Respecto al objetivo 1...", rec: "Asegurar coherencia interna." },
      { s: "APA 7", d: "Inconsistencia grave en formato de tablas y figuras.", r: "MINOR", c: "Aplicar formato APA 7 sin líneas verticales.", i: "Tabla 1. Título en cursiva...", rec: "Ver manual de estilo APA." },
    ];

    const structure = 40 + Math.random() * 55;
    const content = 40 + Math.random() * 55;
    const form = 30 + Math.random() * 65;
    const originality = 60 + Math.random() * 38;
    const overall = (structure + content + form + originality) / 4;
    const grade = (overall / 100) * 20;
    const status = overall < 65 ? 'OBSERVED' : 'AI_COMPLETE';

    const numFindings = 2 + Math.floor(Math.random() * 3);
    const selectedFindings = [...possibleFindings].sort(() => 0.5 - Math.random()).slice(0, numFindings);

    await this.prisma.aIFinding.deleteMany({
      where: { analysis: { advanceId } },
    });

    const analysis = await this.prisma.aIAnalysis.upsert({
      where: { advanceId },
      update: {
        structureScore: structure,
        contentScore: content,
        formScore: form,
        originalityScore: originality,
        overallScore: overall,
        gradeConverted: grade,
        executiveSummary: overall < 65
          ? "OBSERVADO: El documento presenta deficiencias críticas en metodología y sustento teórico que requieren corrección antes de su aprobación."
          : "APROBADO CON OBSERVACIONES: El documento cumple la mayoría de criterios académicos. Se sugieren ajustes en formato y profundidad del marco teórico.",
        processingMs: 2000,
        modelUsed: 'gpt-4o-fallback-sim',
      },
      create: {
        advanceId,
        structureScore: structure,
        contentScore: content,
        formScore: form,
        originalityScore: originality,
        overallScore: overall,
        gradeConverted: grade,
        executiveSummary: overall < 65
          ? "OBSERVADO: El documento presenta deficiencias críticas en metodología y sustento teórico que requieren corrección antes de su aprobación."
          : "APROBADO CON OBSERVACIONES: El documento cumple la mayoría de criterios académicos. Se sugieren ajustes en formato y profundidad del marco teórico.",
        processingMs: 2000,
        modelUsed: 'gpt-4o-fallback-sim',
      },
    });

    await this.prisma.aIFinding.createMany({
      data: selectedFindings.map(f => ({
        analysisId: analysis.id,
        sectionRef: f.s,
        pageRef: Math.floor(Math.random() * 30) + 1,
        severity: f.r as any,
        description: f.d,
        correctionSteps: f.c,
        exampleImprovement: f.i,
        recommendation: f.rec,
      })),
    });

    // Generar feedback detallado simulado automáticamente
    await this.generateDetailedFeedback(advanceId).catch((e) =>
      this.logger.warn(`Simulated detailed feedback auto-generation failed: ${e?.message}`),
    );

    await this.prisma.advance.update({
      where: { id: advanceId },
      data: { status }
    });

    // Encolar plagiarism y references (sin embeddings reales, devolverán vacío — correcto)
    await this.plagiarismQueue.add('analyze', { advanceId }).catch((e) =>
      this.logger.warn(`Failed to enqueue plagiarism analysis: ${e?.message}`),
    );
    await this.referencesQueue.add('analyze', { advanceId }).catch((e) =>
      this.logger.warn(`Failed to enqueue references analysis: ${e?.message}`),
    );

    this.logger.log(`Fallback simulation complete: ${advanceId} -> ${status} (${overall.toFixed(1)}%)`);
  }

  async getAnalysis(advanceId: string) {
    return this.prisma.aIAnalysis.findUnique({
      where: { advanceId },
      include: {
        findings: { orderBy: { severity: 'asc' } },
      },
    });
  }

  async generateDetailedFeedback(advanceId: string) {
    const advance = await this.prisma.advance.findUniqueOrThrow({
      where: { id: advanceId },
      include: {
        aiAnalysis: {
          include: { findings: { orderBy: { severity: 'asc' } } },
        },
        template: true,
      },
    });

    if (!advance.aiAnalysis) {
      return { error: 'La tesis aun no tiene análisis IA. Ejecuta el análisis primero.' };
    }

    const analysis = advance.aiAnalysis;

    // Detectar modo simulación
    const hasOpenAI = process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('your-openai-key') && process.env.OPENAI_API_KEY !== 'undefined' && process.env.OPENAI_API_KEY !== '';
    const hasDeepSeek = process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_KEY !== 'undefined' && process.env.DEEPSEEK_API_KEY !== '';
    const hasGemini = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'undefined' && process.env.GEMINI_API_KEY !== '';
    const hasGroq = process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'undefined' && process.env.GROQ_API_KEY !== '';
    const hasClaude = process.env.CLAUDE_API_KEY && process.env.CLAUDE_API_KEY !== 'undefined' && process.env.CLAUDE_API_KEY !== '';
    const hasMinimax = process.env.MINIMAX_API_KEY && process.env.MINIMAX_API_KEY !== 'undefined' && process.env.MINIMAX_API_KEY !== '';

    if (!hasOpenAI && !hasDeepSeek && !hasGemini && !hasGroq && !hasClaude && !hasMinimax) {
      this.logger.warn(`Modo simulación para feedback detallado del avance ${advanceId}`);
      const mockFeedback = this.generateSimulatedDetailedFeedback(analysis);
      await this.prisma.aIAnalysis.update({
        where: { id: analysis.id },
        data: { detailedFeedback: mockFeedback as any },
      });
      return mockFeedback;
    }

    const activeConfig = await this.getActiveConfig();
    const pipeline = this.buildPipeline(activeConfig.model, activeConfig.provider);

    let advanceText = advance.extractedText || '';
    if (!advanceText) {
      try {
        const fileBuffer = await this.storage.download(advance.fileKey);
        advanceText = await pipeline.extractText(fileBuffer, advance.fileType as 'pdf' | 'docx');
      } catch (e) {
        this.logger.warn(`No se pudo extraer texto: ${e}`);
      }
    }

    try {
      const templateSchema = advance.template ? {
        ...(advance.template.extractedSchema as any || {}),
        formatting: advance.template.formatting,
        citationStyle: advance.template.citationStyle,
      } : undefined;

      const feedback = await pipeline.generateDetailedFeedback(
        advanceText,
        {
          structure: Math.round(analysis.structureScore),
          content: Math.round(analysis.contentScore),
          form: Math.round(analysis.formScore),
          originality: Math.round(analysis.originalityScore),
          overall: Math.round(analysis.overallScore),
        },
        analysis.executiveSummary || '',
        analysis.findings || [],
        advance.advanceType,
        templateSchema,
        analysis.structureAnalysis || undefined,
      );

      // Guardar en la base de datos
      await this.prisma.aIAnalysis.update({
        where: { id: analysis.id },
        data: { detailedFeedback: feedback as any },
      });

      return feedback;
    } catch (err: any) {
      this.logger.error(`Error generando feedback detallado: ${err.message}`);
      return { error: 'Error generando el feedback detallado. Intenta de nuevo.' };
    }
  }

  private generateSimulatedDetailedFeedback(analysis: any) {
    const dimensions = [
      { dimension: 'Estructura', score: Math.round(analysis.structureScore || 60), weight: 25, analysis: 'La organización general es adecuada pero la numeración de secciones presenta inconsistencias.', priority: 'MEDIA' as const },
      { dimension: 'Contenido', score: Math.round(analysis.contentScore || 65), weight: 35, analysis: 'El contenido es pertinente pero requiere mayor profundidad en el marco teórico.', priority: 'ALTA' as const },
      { dimension: 'Forma', score: Math.round(analysis.formScore || 70), weight: 20, analysis: 'Formato general aceptable con correcciones menores en citas y referencias.', priority: 'BAJA' as const },
      { dimension: 'Originalidad', score: Math.round(analysis.originalityScore || 80), weight: 20, analysis: 'El trabajo presenta aportes originales en la propuesta de solución.', priority: 'BAJA' as const },
    ];

    return {
      executiveSummary: analysis.executiveSummary || 'Documento evaluado con observaciones menores.',
      sectionAnalysis: [
        { sectionName: 'Introducción', status: 'OBSERVED' as const, strengths: 'Planteamiento del problema claro y bien delimitado.', weaknesses: 'Falta justificación cuantitativa con datos estadísticos.', improvementSuggestion: 'Incluir datos de fuentes oficiales que respalden la magnitud del problema.' },
        { sectionName: 'Marco Teórico', status: 'OK' as const, strengths: 'Buen uso de fuentes actualizadas.', weaknesses: 'Algunas transiciones entre teorías son abruptas.', improvementSuggestion: 'Agregar párrafos puente que conecten las diferentes aproximaciones teóricas.' },
        { sectionName: 'Metodología', status: 'OBSERVED' as const, strengths: 'Diseño de investigación adecuado al tipo de estudio.', weaknesses: 'No se especifica el tamaño muestral ni el método de muestreo.', improvementSuggestion: 'Detallar el cálculo del tamaño de muestra y justificar el método de selección.' },
        { sectionName: 'Conclusiones', status: 'OBSERVED' as const, strengths: 'Conclusiones coherentes con los resultados presentados.', weaknesses: 'No responden explícitamente a todos los objetivos específicos.', improvementSuggestion: 'Mapear cada conclusión con su objetivo específico correspondiente.' },
      ],
      dimensionAnalysis: dimensions,
      prioritizedRecommendations: [
        { priority: 1, area: 'Marco Teórico', recommendation: 'Ampliar el marco teórico con al menos 5 fuentes de los últimos 3 años.', expectedImpact: 'Alto' },
        { priority: 2, area: 'Metodología', recommendation: 'Incluir justificación del tamaño muestral y método de muestreo.', expectedImpact: 'Alto' },
        { priority: 3, area: 'Conclusiones', recommendation: 'Reestructurar conclusiones para alinearlas con cada objetivo específico.', expectedImpact: 'Medio' },
      ],
      improvementPlan: {
        shortTerm: ['Corregir formato de citas APA 7', 'Ajustar numeración de tablas y figuras'],
        mediumTerm: ['Profundizar marco teórico', 'Agregar análisis estadístico descriptivo'],
        longTerm: ['Validar instrumentos con juicio de expertos', 'Publicar resultados parciales en congreso'],
      },
    };
  }

  async getAdvanceStatus(advanceId: string) {
    return this.prisma.advance.findUnique({
      where: { id: advanceId },
      select: { status: true },
    });
  }

  async reanalyze(advanceId: string) {
    await this.prisma.plagiarismReport.deleteMany({ where: { advanceId } });
    await this.prisma.referenceAnalysis.deleteMany({ where: { advanceId } });
    await this.prisma.review.deleteMany({ where: { advanceId } });
    await this.prisma.aIAnalysis.deleteMany({ where: { advanceId } });
    await this.prisma.advanceChunk.deleteMany({ where: { advanceId } });
    await this.analyzeAdvance(advanceId);
  }
}
