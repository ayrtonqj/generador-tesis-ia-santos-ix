import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AnalysisPipeline } from '@kimy/ai-engine';
import { ChatOpenAI } from '@langchain/openai';
import { randomUUID } from 'crypto';
import { marked } from 'marked';
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, PageNumber, Footer,
  Table, TableRow, TableCell, WidthType, BorderStyle,
} from 'docx';
import puppeteer from 'puppeteer';

const SUPPORTED_LANGS: Record<string, string> = {
  es: 'Español',
  en: 'Inglés',
  pt: 'Portugués',
  fr: 'Francés',
  de: 'Alemán',
  it: 'Italiano',
};

@Injectable()
export class DocumentTranslationService {
  private readonly logger = new Logger(DocumentTranslationService.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    @InjectQueue('document-translation') private translationQueue: Queue,
  ) {}

  async upload(
    file: Express.Multer.File,
    userId: string,
    dto: { targetLang: string; sourceLang?: string; correctedSourceLang?: string },
  ) {
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    if (!ext || !['pdf', 'docx'].includes(ext)) {
      throw new BadRequestException('Solo se permiten archivos PDF o DOCX');
    }

    const fileKey = `translations/${userId}/${randomUUID()}.${ext}`;
    await this.storage.upload(fileKey, file.buffer, file.mimetype);

    const record = await this.prisma.documentTranslation.create({
      data: {
        userId,
        originalFileKey: fileKey,
        originalFileName: file.originalname,
        fileType: ext,
        sourceLang: dto.sourceLang || 'auto',
        targetLang: dto.targetLang,
        correctedLang: dto.correctedSourceLang || null,
        status: 'PENDING',
      },
    });

    await this.translationQueue.add('translate', { translationId: record.id }, {
      attempts: 2,
      backoff: { type: 'exponential', delay: 5000 },
    });

    return { id: record.id, status: 'PENDING' };
  }

  async getTranslation(translationId: string, userId: string) {
    const t = await this.prisma.documentTranslation.findUnique({
      where: { id: translationId },
    });
    if (!t) throw new NotFoundException('Traducción no encontrada');
    if (t.userId !== userId) throw new NotFoundException('Traducción no encontrada');

    return {
      id: t.id,
      originalFileName: t.originalFileName,
      fileType: t.fileType,
      sourceLang: t.sourceLang,
      detectedLang: t.detectedLang,
      correctedLang: t.correctedLang,
      targetLang: t.targetLang,
      status: t.status,
      chunkCount: t.chunkCount,
      completedChunks: t.completedChunks,
      translatedContent: t.status === 'COMPLETED' ? t.translatedContent : null,
      errorMessage: t.errorMessage,
      modelUsed: t.modelUsed,
      processingMs: t.processingMs,
      createdAt: t.createdAt,
    };
  }

  async retry(translationId: string, userId: string) {
    const t = await this.prisma.documentTranslation.findUnique({
      where: { id: translationId },
    });
    if (!t) throw new NotFoundException('Traducción no encontrada');
    if (t.userId !== userId) throw new NotFoundException('Traducción no encontrada');

    if (t.status !== 'FAILED') {
      throw new BadRequestException('Solo se pueden reintentar traducciones que fallaron');
    }

    const updated = await this.prisma.documentTranslation.update({
      where: { id: translationId },
      data: {
        status: 'PENDING',
        errorMessage: null,
        completedChunks: 0,
      },
    });

    await this.translationQueue.add('translate', { translationId: updated.id }, {
      attempts: 2,
      backoff: { type: 'exponential', delay: 5000 },
    });

    return { id: updated.id, status: 'PENDING' };
  }

  async getHistory(userId: string) {
    return this.prisma.documentTranslation.findMany({
      where: { userId },
      select: {
        id: true,
        originalFileName: true,
        fileType: true,
        sourceLang: true,
        targetLang: true,
        status: true,
        chunkCount: true,
        completedChunks: true,
        errorMessage: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async translate(translationId: string) {
    const record = await this.prisma.documentTranslation.findUnique({
      where: { id: translationId },
    });
    if (!record) {
      this.logger.error(`Translation record ${translationId} not found`);
      return;
    }

    const startTime = Date.now();

    try {
      // 1. Extraer texto
      const fileBuffer = await this.storage.download(record.originalFileKey);
      const pipeline = this.buildExtractionPipeline();
      const extractedText = await pipeline.extractText(
        fileBuffer,
        record.fileType as 'pdf' | 'docx',
      );

      if (!extractedText || extractedText.trim().length < 10) {
        throw new Error('El documento no contiene suficiente texto para traducir');
      }

      // 2. Detectar idioma origen si es 'auto'
      let sourceLang = record.sourceLang;
      if (sourceLang === 'auto') {
        await this.prisma.documentTranslation.update({
          where: { id: translationId },
          data: { status: 'DETECTING_LANG' },
        });

        const detected = await this.detectLanguage(extractedText.substring(0, 3000));
        sourceLang = detected;
        await this.prisma.documentTranslation.update({
          where: { id: translationId },
          data: { detectedLang: detected, sourceLang: detected },
        });
        this.logger.log(`Idioma detectado para ${translationId}: ${detected}`);
      }

      // Si usuario corrigió el idioma detectado, usar ese
      if (record.correctedLang) {
        sourceLang = record.correctedLang;
      }

      if (sourceLang === record.targetLang) {
        await this.prisma.documentTranslation.update({
          where: { id: translationId },
          data: {
            status: 'COMPLETED',
            translatedContent: extractedText,
            processingMs: Date.now() - startTime,
            modelUsed: 'none',
          },
        });
        return;
      }

      // 3. Chunkear el texto sin overlap (0) para evitar duplicidad de bloques traducidos
      const chunks = await pipeline.chunkDocument(extractedText, 0);
      const totalChunks = chunks.length;

      const activeConfig = await this.getActiveConfig();

      await this.prisma.documentTranslation.update({
        where: { id: translationId },
        data: {
          status: 'TRANSLATING',
          content: extractedText.substring(0, 250000),
          chunkCount: totalChunks,
          completedChunks: 0,
          modelUsed: `${activeConfig.provider}/${activeConfig.model}`,
        },
      });

      // 4. Traducir cada chunk secuencialmente
      const translatedChunks: string[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const translatedChunk = await this.translateChunk(
          chunks[i],
          sourceLang,
          record.targetLang,
          activeConfig,
        );
        translatedChunks.push(translatedChunk);

        await this.prisma.documentTranslation.update({
          where: { id: translationId },
          data: { completedChunks: i + 1 },
        });
      }

      const fullTranslation = translatedChunks.join('\n\n');
      const ms = Date.now() - startTime;

      await this.prisma.documentTranslation.update({
        where: { id: translationId },
        data: {
          status: 'COMPLETED',
          translatedContent: fullTranslation,
          processingMs: ms,
          modelUsed: `${activeConfig.provider}/${activeConfig.model}`,
        },
      });

      this.logger.log(`Traducción completada ${translationId}: ${totalChunks} chunks, ${ms}ms`);
    } catch (error: any) {
      this.logger.error(`Error traduciendo ${translationId}: ${error.message}`);
      await this.prisma.documentTranslation.update({
        where: { id: translationId },
        data: {
          status: 'FAILED',
          errorMessage: error.message.substring(0, 500),
          processingMs: Date.now() - startTime,
        },
      }).catch(() => {});
    }
  }

  private buildExtractionPipeline(): AnalysisPipeline {
    return new AnalysisPipeline({
      openaiKey: process.env.OPENAI_API_KEY || '',
      provider: 'openai',
      maxGrade: 20,
    });
  }

  private async detectLanguage(text: string): Promise<string> {
    const config = await this.getActiveConfig();
    const systemPrompt = 'Eres un detector de idiomas preciso. Responde solo con el código ISO de 2 letras.';
    const userPrompt = `Detecta el idioma del siguiente texto académico. Responde ÚNICAMENTE con el código ISO de 2 letras del idioma (es, en, pt, fr, de, it). No añadas explicaciones ni puntuación extra.\n\nTexto:\n${text.substring(0, 2000)}`;

    try {
      const result = await this.invokeAi(systemPrompt, userPrompt, config);
      const clean = result.trim().toLowerCase();
      const match = clean.match(/\b(es|en|pt|fr|de|it)\b/);
      if (match && SUPPORTED_LANGS[match[1]]) return match[1];
    } catch (err: any) {
      this.logger.warn(`Error detectando idioma: ${err.message}`);
    }
    return 'es';
  }

  private async translateChunk(
    chunk: string,
    sourceLang: string,
    targetLang: string,
    config: { provider: string; model: string },
  ): Promise<string> {
    const sourceName = SUPPORTED_LANGS[sourceLang] || sourceLang;
    const targetName = SUPPORTED_LANGS[targetLang] || targetLang;

    const systemPrompt = `Eres un traductor académico experto.

Idioma origen: ${sourceName}
Idioma destino: ${targetName}

REGLAS ESTRICTAS:
- Traduce SOLO el texto proporcionado, sin agregar ni omitir nada.
- Re-fluye el texto eliminando los saltos de línea huérfanos generados por la extracción de PDF. Los párrafos deben ser continuos y los saltos de línea solo deben usarse para separar párrafos reales, títulos o elementos de lista.
- Mantén el formato y la estructura general del texto original (títulos, listas, tablas).
- Si encuentras información tabular (como listas de datos con columnas alineadas, tablas o filas numeradas con características), estructúrala SIEMPRE como una tabla Markdown (usando caracteres pipe '|' y guiones para la fila de separación, p. ej. | Col1 | Col2 |). Asegúrate de alinear las columnas correspondientes. Incluso si la tabla tiene una sola fila de datos o parece estar incompleta por un salto de página, mantén su estructura de tabla.
- NO traduzcas nombres propios (autores, instituciones, marcas).
- NO traduzcas referencias bibliográficas ni citas.
- NO traduzcas términos técnicos especializados cuando sea inapropiado.
- Usa un tono académico y formal.
- Preserva números, ecuaciones, fórmulas y código.
- Responde ÚNICAMENTE con el texto traducido, sin explicaciones ni introducciones.`;

    try {
      const result = await this.invokeAi(systemPrompt, chunk, config);
      return this.cleanTranslation(result);
    } catch (err: any) {
      this.logger.error(`Error traduciendo chunk: ${err.message}`);
      throw err;
    }
  }

  private async invokeAi(
    systemPrompt: string,
    userMessage: string,
    config: { provider: string; model: string },
  ): Promise<string> {
    const provider = config.provider;
    const model = config.model;

    if (provider === 'gemini') {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

      const modelsToTry = [
        model || 'gemini-3.1-flash-lite',
        'gemini-3.5-flash',
        'gemini-3-flash',
        'gemini-3.1-flash-lite',
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite',
      ].filter((v, i, a) => a.indexOf(v) === i);

      let lastError: any;
      for (const modelName of modelsToTry) {
        this.logger.log(`Intentando traducir con Gemini modelo: ${modelName}`);
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const genModel = client.getGenerativeModel(
              { model: modelName },
              { apiVersion: 'v1beta' }
            );
            const res = await genModel.generateContent([{ text: systemPrompt }, { text: userMessage }]);
            this.logger.log(`Traducción exitosa con Gemini modelo: ${modelName}`);
            return res.response.text();
          } catch (e: any) {
            lastError = e;
            this.logger.warn(`Falló intento ${attempt + 1}/2 con Gemini ${modelName}: ${e.message}`);
            if (e.message?.includes('prepaid credits are depleted') || e.message?.includes('403')) {
              throw e;
            }
          }
        }
      }
      throw lastError || new Error('No se pudo invocar a Gemini en ningún modelo.');
    }

    if (provider === 'claude') {
      const Anthropic = await import('@anthropic-ai/sdk');
      const anthropic = new Anthropic.default({ apiKey: process.env.CLAUDE_API_KEY || '' });
      const res = await anthropic.messages.create({
        model: model || 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      });
      return (res.content[0] as any).text;
    }

    const openaiKey = provider === 'groq'
      ? (process.env.GROQ_API_KEY || '')
      : provider === 'deepseek'
        ? (process.env.DEEPSEEK_API_KEY || '')
        : provider === 'minimax'
          ? (process.env.MINIMAX_API_KEY || '')
          : (process.env.OPENAI_API_KEY || '');

    const baseURL = provider === 'groq'
      ? 'https://api.groq.com/openai/v1'
      : provider === 'deepseek'
        ? 'https://api.deepseek.com/v1'
        : provider === 'minimax'
          ? 'https://api.minimax.chat/v1'
          : undefined;

    const llm = new ChatOpenAI({
      apiKey: openaiKey,
      model: model || 'gpt-4o',
      temperature: 0.1,
      maxTokens: 4096,
      ...(baseURL ? { configuration: { baseURL } } : {}),
    });

    const res = await llm.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ]);
    return typeof res.content === 'string' ? res.content : String(res.content);
  }

  private cleanTranslation(text: string): string {
    let cleaned = text.trim();
    cleaned = cleaned.replace(/^```markdown\n?/i, '');
    cleaned = cleaned.replace(/^```\n?/, '');
    cleaned = cleaned.replace(/\n?```$/i, '');
    return cleaned.trim();
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

  async generateDocx(translationId: string, userId: string): Promise<Buffer> {
    const t = await this.prisma.documentTranslation.findUnique({
      where: { id: translationId },
    });
    if (!t || t.userId !== userId) throw new NotFoundException('Traducción no encontrada');
    if (t.status !== 'COMPLETED' || !t.translatedContent) {
      throw new BadRequestException('La traducción aún no está completa');
    }

    const fontFamily = 'Arial Narrow';
    const fontSize = 24;

    const tokens = marked.lexer(t.translatedContent);
    const children = this.convertTokensToDocx(tokens, { fontFamily, fontSize });

    const doc = new Document({
      styles: {
        default: {
          document: {
            run: { font: fontFamily, size: fontSize },
            paragraph: {
              spacing: { line: 480 },
              alignment: AlignmentType.JUSTIFIED,
            },
          },
        },
      },
      sections: [{
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1418, bottom: 1418, left: 1701, right: 1418 },
          },
        },
        children,
        footers: {
          default: new Footer({
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ children: [PageNumber.CURRENT], font: fontFamily, size: 18 })],
            })],
          }),
        },
      }],
    });

    return Buffer.from(await Packer.toBuffer(doc));
  }

  async generatePdf(translationId: string, userId: string): Promise<Buffer> {
    const t = await this.prisma.documentTranslation.findUnique({
      where: { id: translationId },
    });
    if (!t || t.userId !== userId) throw new NotFoundException('Traducción no encontrada');
    if (t.status !== 'COMPLETED' || !t.translatedContent) {
      throw new BadRequestException('La traducción aún no está completa');
    }

    const htmlContent = await marked.parse(t.translatedContent);

    const fullHtml = `<!DOCTYPE html>
<html lang="${t.targetLang}">
<head><meta charset="UTF-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Arial Narrow',Arial,sans-serif; font-size:12pt; line-height:2; text-align:justify; color:#000; padding:0; }
  h1 { font-size:18pt; font-weight:bold; text-align:center; margin:36pt 0 24pt; page-break-before:always; }
  h1:first-of-type { page-break-before:avoid; }
  h2 { font-size:16pt; font-weight:bold; text-align:left; margin:24pt 0 16pt; page-break-after:avoid; }
  h3 { font-size:14pt; font-weight:bold; text-align:left; margin:20pt 0 12pt; page-break-after:avoid; }
  p { margin:0 0 18pt; text-indent:1.27cm; orphans:3; widows:3; }
  h1+p, h2+p, h3+p { text-indent:0; }
  table { width:100%; border-collapse:collapse; margin:24pt 0; font-size:11pt; }
  th, td { border:1px solid #000; padding:8px 12px; text-align:left; }
  th { font-weight:bold; }
  ul, ol { margin:0 0 18pt; padding-left:24pt; }
  li { margin-bottom:8pt; }
</style></head>
<body>${htmlContent}</body></html>`;

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(fullHtml, { waitUntil: 'networkidle0', timeout: 30000 });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '2.5cm', bottom: '2.5cm', left: '3cm', right: '2.5cm' },
      });

      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  }

  private convertTokensToDocx(tokens: any[], opts: any): any[] {
    const result: any[] = [];
    for (const tok of tokens) {
      switch (tok.type) {
        case 'heading': {
          const depth = Math.min(tok.depth, 4);
          const size = [24, 22, 20][depth - 1] || opts.fontSize;
          result.push(new Paragraph({
            heading: HeadingLevel[`HEADING_${depth}` as keyof typeof HeadingLevel],
            alignment: depth === 1 ? AlignmentType.CENTER : AlignmentType.LEFT,
            spacing: { before: depth === 1 ? 480 : 320, after: depth === 1 ? 320 : 200 },
            children: tok.tokens?.length
              ? this.inlineToTextRuns(tok.tokens, opts.fontFamily, size)
              : [new TextRun({ text: tok.text || '', font: opts.fontFamily, size, bold: true })],
          }));
          break;
        }
        case 'paragraph': {
          result.push(new Paragraph({
            spacing: { after: 360, line: 480 },
            indent: { firstLine: 720 },
            alignment: AlignmentType.JUSTIFIED,
            children: tok.tokens?.length
              ? this.inlineToTextRuns(tok.tokens, opts.fontFamily, opts.fontSize)
              : tok.text ? [new TextRun({ text: tok.text, font: opts.fontFamily, size: opts.fontSize })] : [],
          }));
          break;
        }
        case 'list': {
          for (const item of tok.items || []) {
            const itemTokens = item.tokens || [];
            const paraTokens = itemTokens.filter((t: any) => t.type === 'paragraph' || t.type === 'text');
            if (paraTokens.length === 0) {
              result.push(new Paragraph({
                spacing: { after: 120, line: 480 },
                bullet: tok.ordered ? undefined : { level: 0 },
                numbering: tok.ordered ? { reference: 'ordered-list', level: 0 } : undefined,
                children: item.text ? [new TextRun({ text: item.text, font: opts.fontFamily, size: opts.fontSize })] : [],
              }));
            } else {
              for (let i = 0; i < paraTokens.length; i++) {
                const pt = paraTokens[i];
                result.push(new Paragraph({
                  spacing: { after: 80, line: 480 },
                  indent: i > 0 ? { left: 720 } : undefined,
                  bullet: i === 0 && !tok.ordered ? { level: 0 } : undefined,
                  numbering: i === 0 && tok.ordered ? { reference: 'ordered-list', level: 0 } : undefined,
                  children: pt.tokens?.length
                    ? this.inlineToTextRuns(pt.tokens, opts.fontFamily, opts.fontSize)
                    : pt.text ? [new TextRun({ text: pt.text, font: opts.fontFamily, size: opts.fontSize })] : [],
                }));
              }
            }
          }
          break;
        }
        case 'table': {
          const tableRows: TableRow[] = [];
          const colCount = tok.header?.length || 1;
          const cellWidth = Math.floor(100 / colCount);

          // 1. Header Row
          const headerCells: TableCell[] = [];
          for (const cell of tok.header || []) {
            headerCells.push(new TableCell({
              children: [new Paragraph({
                alignment: AlignmentType.LEFT,
                children: cell.tokens?.length
                  ? this.inlineToTextRuns(cell.tokens, opts.fontFamily, opts.fontSize)
                  : [new TextRun({ text: cell.text || '', font: opts.fontFamily, size: opts.fontSize, bold: true })],
              })],
              shading: { fill: 'F2F2F2' },
              width: { size: cellWidth, type: WidthType.PERCENTAGE },
              margins: { top: 120, bottom: 120, left: 150, right: 150 },
            }));
          }
          if (headerCells.length > 0) {
            tableRows.push(new TableRow({ children: headerCells }));
          }

          // 2. Data Rows
          for (const row of tok.rows || []) {
            const dataCells: TableCell[] = [];
            for (const cell of row || []) {
              dataCells.push(new TableCell({
                children: [new Paragraph({
                  alignment: AlignmentType.LEFT,
                  children: cell.tokens?.length
                    ? this.inlineToTextRuns(cell.tokens, opts.fontFamily, opts.fontSize)
                    : [new TextRun({ text: cell.text || '', font: opts.fontFamily, size: opts.fontSize })],
                })],
                width: { size: cellWidth, type: WidthType.PERCENTAGE },
                margins: { top: 120, bottom: 120, left: 150, right: 150 },
              }));
            }
            if (dataCells.length > 0) {
              tableRows.push(new TableRow({ children: dataCells }));
            }
          }

          if (tableRows.length > 0) {
            result.push(new Table({
              rows: tableRows,
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
                bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
                left: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
                right: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
                insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'E5E5E5' },
                insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'E5E5E5' },
              },
            }));
          }
          break;
        }
        case 'code': {
          result.push(new Paragraph({
            spacing: { before: 200, after: 200 },
            indent: { left: 360 },
            children: [new TextRun({ text: tok.text || '', font: 'Courier New', size: opts.fontSize - 2 })],
          }));
          break;
        }
        case 'space': break;
        default: {
          if (tok.text) {
            result.push(new Paragraph({
              spacing: { after: 360, line: 480 },
              indent: { firstLine: 720 },
              children: [new TextRun({ text: tok.text, font: opts.fontFamily, size: opts.fontSize })],
            }));
          }
        }
      }
    }
    return result;
  }

  private inlineToTextRuns(tokens: any[], fontFamily: string, size: number): TextRun[] {
    const result: TextRun[] = [];
    for (const tok of tokens || []) {
      switch (tok.type) {
        case 'text':
          if (tok.tokens?.length) {
            result.push(...this.inlineToTextRuns(tok.tokens, fontFamily, size));
          } else {
            result.push(new TextRun({ text: tok.text || '', font: fontFamily, size }));
          }
          break;
        case 'strong':
          result.push(new TextRun({ text: this.collectText(tok), font: fontFamily, size, bold: true }));
          break;
        case 'em':
          result.push(new TextRun({ text: this.collectText(tok), font: fontFamily, size, italics: true }));
          break;
        case 'codespan':
          result.push(new TextRun({ text: tok.text || '', font: 'Courier New', size }));
          break;
        case 'link':
          result.push(new TextRun({ text: tok.text || tok.href || '', font: fontFamily, size }));
          break;
        case 'br':
          result.push(new TextRun({ text: '\n', font: fontFamily, size }));
          break;
        default:
          if (tok.text) {
            result.push(new TextRun({ text: tok.text, font: fontFamily, size }));
          }
      }
    }
    return result;
  }

  private collectText(tok: any): string {
    if (tok.text) return tok.text;
    if (tok.tokens) return tok.tokens.map((t: any) => this.collectText(t)).join('');
    return '';
  }
}
