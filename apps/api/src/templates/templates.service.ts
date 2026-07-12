import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AnalysisPipeline } from '@kimy/ai-engine';
import { randomUUID } from 'crypto';

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  async findAll(programId?: string, includeInactive?: boolean) {
    return this.prisma.thesisTemplate.findMany({
      where: {
        ...(programId && { programId }),
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        program: { select: { name: true } },
        _count: { select: { advances: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    return this.prisma.thesisTemplate.findUnique({
      where: { id },
      include: {
        program: true,
        chunks: { orderBy: { chunkIndex: 'asc' } },
      },
    });
  }

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

  private getAvailableProviders(): Record<string, boolean> {
    const hasKey = (key: string, placeholder?: string) => {
      const val = process.env[key];
      if (!val || val === '' || val === 'undefined') return false;
      if (placeholder && val.includes(placeholder)) return false;
      return true;
    };
    return {
      openai: hasKey('OPENAI_API_KEY', 'your-openai-key'),
      groq: hasKey('GROQ_API_KEY'),
      gemini: hasKey('GEMINI_API_KEY'),
      deepseek: hasKey('DEEPSEEK_API_KEY'),
      claude: hasKey('CLAUDE_API_KEY'),
      minimax: hasKey('MINIMAX_API_KEY'),
    };
  }

  async upload(
    file: Express.Multer.File,
    data: { programId: string; name: string; version: string; citationStyle?: string },
  ) {
    const fileType = file.originalname.endsWith('.docx') ? 'docx' : 'pdf';
    const fileKey = `templates/${data.programId}/${randomUUID()}.${fileType}`;

    await this.storage.upload(fileKey, file.buffer, file.mimetype);

    const activeConfig = await this.getActiveConfig();
    const available = this.getAvailableProviders();

    let extractedSchema: any = null;
    let text = '';
    let pipelineToUse: AnalysisPipeline | null = null;
    let usedModel = '';

    const hasOpenAI = available.openai;
    const hasDeepSeek = available.deepseek;
    const hasGemini = available.gemini;
    const hasGroq = available.groq;
    const hasClaude = available.claude;
    const hasMinimax = available.minimax;

    if (!hasOpenAI && !hasDeepSeek && !hasGemini && !hasGroq && !hasClaude && !hasMinimax) {
      this.logger.warn('No hay proveedores de IA disponibles para extracción de estructura');
    } else {
      const shortErr = (e: any) => {
        const m = e?.message || String(e);
        return m.length > 250 ? m.substring(0, 250) + '...' : m;
      };

      // ── 1. Proveedor configurado ────
      if (activeConfig.provider === 'deepseek' && hasDeepSeek) {
        try {
          this.logger.log(`Extracción con DeepSeek (model: ${activeConfig.model})...`);
          const pipeline = this.buildPipeline(activeConfig.model, 'deepseek');
          text = await pipeline.extractText(file.buffer, fileType as any);
          extractedSchema = await pipeline.extractStructure(text);
          pipelineToUse = pipeline;
          usedModel = `deepseek/${activeConfig.model}`;
        } catch (e: any) {
          this.logger.error(`DeepSeek template extraction failed: ${shortErr(e)}`);
        }
      } else if (activeConfig.provider === 'groq' && hasGroq) {
        try {
          this.logger.log(`Extracción con Groq (model: ${activeConfig.model})...`);
          const groqPipeline = new AnalysisPipeline({
            openaiKey: process.env.GROQ_API_KEY!,
            provider: 'groq',
            model: activeConfig.model,
            maxGrade: 20,
          });
          text = await groqPipeline.extractText(file.buffer, fileType as any);
          extractedSchema = await groqPipeline.extractStructure(text);
          pipelineToUse = groqPipeline;
          usedModel = `groq/${activeConfig.model}`;
        } catch (e: any) {
          this.logger.error(`Groq template extraction failed: ${shortErr(e)}`);
        }
      } else if (activeConfig.provider === 'claude' && hasClaude) {
        try {
          this.logger.log(`Extracción con Claude (model: ${activeConfig.model})...`);
          const claudePipeline = new AnalysisPipeline({
            openaiKey: '',
            claudeKey: process.env.CLAUDE_API_KEY!,
            provider: 'claude',
            model: activeConfig.model,
            maxGrade: 20,
          });
          text = await claudePipeline.extractText(file.buffer, fileType as any);
          extractedSchema = await claudePipeline.extractStructure(text);
          pipelineToUse = claudePipeline;
          usedModel = `claude/${activeConfig.model}`;
        } catch (e: any) {
          this.logger.error(`Claude template extraction failed: ${shortErr(e)}`);
        }
      } else if (activeConfig.provider === 'minimax' && hasMinimax) {
        try {
          this.logger.log(`Extracción con Minimax (model: ${activeConfig.model})...`);
          const minimaxPipeline = new AnalysisPipeline({
            openaiKey: '',
            minimaxKey: process.env.MINIMAX_API_KEY!,
            provider: 'minimax',
            model: activeConfig.model,
            maxGrade: 20,
          });
          text = await minimaxPipeline.extractText(file.buffer, fileType as any);
          extractedSchema = await minimaxPipeline.extractStructure(text);
          pipelineToUse = minimaxPipeline;
          usedModel = `minimax/${activeConfig.model}`;
        } catch (e: any) {
          this.logger.error(`Minimax template extraction failed: ${shortErr(e)}`);
        }
      } else if (activeConfig.provider === 'gemini' && hasGemini) {
        try {
          this.logger.log(`Extracción con Gemini (model: ${activeConfig.model})...`);
          const geminiPipeline = new AnalysisPipeline({
            openaiKey: '',
            geminiKey: process.env.GEMINI_API_KEY,
            provider: 'gemini',
            model: activeConfig.model,
            maxGrade: 20,
          });
          text = await geminiPipeline.extractText(file.buffer, fileType as any);
          extractedSchema = await geminiPipeline.extractStructure(text);
          pipelineToUse = geminiPipeline;
          usedModel = `gemini/${activeConfig.model}`;
        } catch (e: any) {
          this.logger.error(`Gemini template extraction failed: ${shortErr(e)}`);
        }
      } else if (hasOpenAI) {
        try {
          this.logger.log(`Extracción con OpenAI (model: ${activeConfig.model})...`);
          const pipeline = this.buildPipeline(activeConfig.model, 'openai');
          text = await pipeline.extractText(file.buffer, fileType as any);
          extractedSchema = await pipeline.extractStructure(text);
          pipelineToUse = pipeline;
          usedModel = `openai/${activeConfig.model}`;
        } catch (e: any) {
          this.logger.error(`OpenAI template extraction failed: ${shortErr(e)}`);
        }
      }

      // ── 2. Fallback: DeepSeek ────
      if (!extractedSchema && hasDeepSeek && activeConfig.provider !== 'deepseek') {
        this.logger.warn('Fallback a DeepSeek para extracción de estructura...');
        try {
          const dsPipeline = new AnalysisPipeline({
            openaiKey: '',
            deepseekKey: process.env.DEEPSEEK_API_KEY!,
            provider: 'deepseek',
            model: 'deepseek-chat',
            maxGrade: 20,
          });
          text = await dsPipeline.extractText(file.buffer, fileType as any);
          extractedSchema = await dsPipeline.extractStructure(text);
          pipelineToUse = dsPipeline;
          usedModel = 'deepseek/deepseek-chat';
        } catch (e: any) {
          this.logger.error(`DeepSeek fallback extraction failed: ${shortErr(e)}`);
        }
      }

      // ── 3. Fallback: OpenAI ────
      if (!extractedSchema && hasOpenAI && activeConfig.provider !== 'openai') {
        this.logger.warn('Fallback a OpenAI para extracción de estructura...');
        try {
          const pipeline = this.buildPipeline('gpt-4o-mini', 'openai');
          text = await pipeline.extractText(file.buffer, fileType as any);
          extractedSchema = await pipeline.extractStructure(text);
          pipelineToUse = pipeline;
          usedModel = 'openai/gpt-4o-mini';
        } catch (e: any) {
          this.logger.error(`OpenAI fallback extraction failed: ${shortErr(e)}`);
        }
      }

      // ── 4. Fallback: Groq ────
      if (!extractedSchema && hasGroq) {
        this.logger.warn('Fallback a Groq para extracción de estructura...');
        try {
          const groqPipeline = new AnalysisPipeline({
            openaiKey: process.env.GROQ_API_KEY!,
            provider: 'groq',
            model: 'llama-3.3-70b-versatile',
            maxGrade: 20,
          });
          text = await groqPipeline.extractText(file.buffer, fileType as any);
          extractedSchema = await groqPipeline.extractStructure(text);
          pipelineToUse = groqPipeline;
          usedModel = 'groq/llama-3.3-70b-versatile';
        } catch (e: any) {
          this.logger.error(`Groq fallback extraction failed: ${shortErr(e)}`);
        }
      }

      // ── 5. Fallback: Gemini ────
      if (!extractedSchema && hasGemini) {
        this.logger.warn('Fallback a Gemini para extracción de estructura...');
        try {
          const geminiPipeline = new AnalysisPipeline({
            openaiKey: '',
            geminiKey: process.env.GEMINI_API_KEY,
            provider: 'gemini',
            model: 'gemini-3.1-flash-lite',
            maxGrade: 20,
          });
          text = await geminiPipeline.extractText(file.buffer, fileType as any);
          extractedSchema = await geminiPipeline.extractStructure(text);
          pipelineToUse = geminiPipeline;
          usedModel = 'gemini/gemini-3.1-flash-lite';
        } catch (e: any) {
          this.logger.error(`Gemini fallback extraction failed: ${shortErr(e)}`);
        }
      }

      // ── 6. Fallback: Claude ────
      if (!extractedSchema && hasClaude && activeConfig.provider !== 'claude') {
        this.logger.warn('Fallback a Claude para extracción de estructura...');
        try {
          const claudePipeline = new AnalysisPipeline({
            openaiKey: '',
            claudeKey: process.env.CLAUDE_API_KEY!,
            provider: 'claude',
            model: 'claude-3-5-sonnet-20241022',
            maxGrade: 20,
          });
          text = await claudePipeline.extractText(file.buffer, fileType as any);
          extractedSchema = await claudePipeline.extractStructure(text);
          pipelineToUse = claudePipeline;
          usedModel = 'claude/claude-3-5-sonnet-20241022';
        } catch (e: any) {
          this.logger.error(`Claude fallback extraction failed: ${shortErr(e)}`);
        }
      }

      // ── 7. Fallback: Minimax ────
      if (!extractedSchema && hasMinimax && activeConfig.provider !== 'minimax') {
        this.logger.warn('Fallback a Minimax para extracción de estructura...');
        try {
          const minimaxPipeline = new AnalysisPipeline({
            openaiKey: '',
            minimaxKey: process.env.MINIMAX_API_KEY!,
            provider: 'minimax',
            model: 'MiniMax-Text-01',
            maxGrade: 20,
          });
          text = await minimaxPipeline.extractText(file.buffer, fileType as any);
          extractedSchema = await minimaxPipeline.extractStructure(text);
          pipelineToUse = minimaxPipeline;
          usedModel = 'minimax/MiniMax-Text-01';
        } catch (e: any) {
          this.logger.error(`Minimax fallback extraction failed: ${shortErr(e)}`);
        }
      }

      if (usedModel) {
        this.logger.log(`Extracción de estructura completada con: ${usedModel}`);
      }
    }

    try {
      const schemaResult = extractedSchema as any;
      const formatting = schemaResult?.formatting || null;

      const template = await this.prisma.thesisTemplate.create({
        data: {
          programId: data.programId,
          name: data.name,
          version: data.version,
          fileKey,
          fileType,
          extractedSchema: schemaResult?.sections ? schemaResult : extractedSchema,
          formatting,
          citationStyle: data.citationStyle || schemaResult?.citationStyle || 'APA',
        } as any,
      });

      if (pipelineToUse && text) {
        const chunks = await pipelineToUse.chunkDocument(text);
        const embeddings = await pipelineToUse.generateEmbeddings(chunks);

        for (let i = 0; i < chunks.length; i++) {
          if (!embeddings[i] || embeddings[i].length === 0) {
            this.logger.warn(`Skipping chunk ${i} due to empty embedding`);
            continue;
          }
          await this.prisma.$executeRawUnsafe(
            `INSERT INTO "TemplateChunk" (id, "templateId", "sectionName", content, embedding, "chunkIndex", "createdAt")
             VALUES ($1, $2, $3, $4, $5::vector, $6, NOW())`,
            randomUUID(), template.id, 'auto', chunks[i],
            `[${embeddings[i].join(',')}]`, i,
          );
        }
      }

      this.logger.log(`Template uploaded: ${template.id}`);
      return template;
    } catch (error) {
      this.logger.error('Error processing template:', error);
      return this.prisma.thesisTemplate.create({
        data: {
          programId: data.programId,
          name: data.name,
          version: data.version,
          fileKey,
          fileType,
          citationStyle: data.citationStyle || 'APA',
        },
      });
    }
  }

  async getFileUrl(id: string): Promise<{ url: string; fileType: string; name: string }> {
    const template = await this.prisma.thesisTemplate.findUnique({
      where: { id },
      select: { fileKey: true, fileType: true, name: true },
    });
    if (!template) throw new Error('Template no encontrado');
    const url = await this.storage.getPresignedUrl(template.fileKey, 3600);
    return { url, fileType: template.fileType, name: template.name };
  }

  async update(id: string, data: { name?: string; version?: string }) {
    return this.prisma.thesisTemplate.update({
      where: { id },
      data,
    });
  }

  async updateRubric(id: string, rubric: any) {
    return this.prisma.thesisTemplate.update({
      where: { id },
      data: { rubric },
    });
  }

  async toggleActive(id: string) {
    const template = await this.prisma.thesisTemplate.findUnique({
      where: { id },
      select: { isActive: true },
    });
    if (!template) throw new Error('Template no encontrado');
    return this.prisma.thesisTemplate.update({
      where: { id },
      data: { isActive: !template.isActive },
    });
  }

  async deactivate(id: string) {
    return this.prisma.thesisTemplate.update({
      where: { id },
      data: { isActive: false },
    });
  }
}