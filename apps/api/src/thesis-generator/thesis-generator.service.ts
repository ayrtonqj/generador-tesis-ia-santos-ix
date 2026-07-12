import { Injectable, Logger, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AnalysisPipeline, ThesisGenResult } from '@kimy/ai-engine';
import { marked } from 'marked';
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell,
  AlignmentType, LevelFormat,
  Header, Footer, PageNumber,
  ImageRun,
} from 'docx';
import puppeteer from 'puppeteer';
import { DiagramGeneratorService } from '../diagram-generator/diagram-generator.service';
import { DiagramRendererService } from '../diagram-generator/diagram-renderer.service';
import sizeOf from 'image-size';

@Injectable()
export class ThesisGeneratorService {
  private readonly logger = new Logger(ThesisGeneratorService.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private diagramGenerator: DiagramGeneratorService,
    private diagramRenderer: DiagramRendererService,
  ) {}

  async generate(data: {
    templateId: string;
    topic: string;
    userPrompt?: string;
    sectionNames: string[];
    aiProvider?: string;
    aiModel?: string;
    targetPageRange?: 'menos-10' | '10-20' | '20-30' | '30-40' | '40-50' | '50-60' | '60-70' | '70-80' | '+80';
  }, userId: string): Promise<ThesisGenResult & { id: string }> {
    const template = await this.prisma.thesisTemplate.findUnique({
      where: { id: data.templateId },
    });
    if (!template) throw new NotFoundException('Template no encontrado');
    if (!template.extractedSchema) throw new BadRequestException('El template no tiene un esquema extraído');

    const schema = template.extractedSchema as any;
    const validSectionNames = (schema.sections || []).map((s: any) => s.name);
    const invalidSections = data.sectionNames.filter((n) => !validSectionNames.includes(n));
    if (invalidSections.length > 0) {
      throw new BadRequestException(`Secciones inválidas: ${invalidSections.join(', ')}`);
    }

    let templateText: string | undefined;
    try {
      const fileBuffer = await this.storage.download(template.fileKey);
      const pipeline = new AnalysisPipeline({
        openaiKey: process.env.OPENAI_API_KEY || '',
        provider: 'openai',
        maxGrade: 20,
      });
      templateText = await pipeline.extractText(fileBuffer, template.fileType as 'pdf' | 'docx');
    } catch (err) {
      this.logger.warn(`No se pudo extraer texto del template: ${err}`);
    }

    const { aiProvider, aiModel } = await this.resolveProvider(data.aiProvider, data.aiModel);
    const available = this.getAvailableProviders();

    // Ordered fallback cascade: primary → Groq → DeepSeek → OpenAI → Claude → Minimax
    const fallbackOrder = [
      { provider: aiProvider, model: aiModel },
      { provider: 'groq', model: 'llama-3.3-70b-versatile' },
      { provider: 'deepseek', model: 'deepseek-chat' },
      { provider: 'openai', model: 'gpt-4o' },
      { provider: 'claude', model: 'claude-3-5-sonnet-20241022' },
      { provider: 'minimax', model: 'MiniMax-Text-01' },
    ].filter((entry, idx, arr) =>
      available[entry.provider] &&
      arr.findIndex(e => e.provider === entry.provider) === idx
    );

    let content: string | null = null;
    let usedProvider = aiProvider;
    let usedModel = aiModel;
    let status = 'COMPLETED';

    for (const { provider: prov, model: mod } of fallbackOrder) {
      this.logger.log(`\x1b[35m[AI ENGINE - BACKEND]\x1b[0m Intentando generación con Proveedor: \x1b[36m${prov}\x1b[0m, Modelo: \x1b[36m${mod}\x1b[0m`);
      try {
        const config = this.buildPipelineConfig(prov, mod);
        const genPipeline = new AnalysisPipeline(config);
        const result = await genPipeline.generateThesis({
          templateSchema: schema,
          templateText,
          topic: data.topic,
          userPrompt: data.userPrompt,
          sectionNames: data.sectionNames,
          targetPageRange: data.targetPageRange,
        });
        content = result.content;
        usedProvider = prov;
        usedModel = mod;
        this.logger.log(`\x1b[32m[AI ENGINE - BACKEND]\x1b[0m ¡Generación completada con Proveedor: \x1b[36m${prov}\x1b[0m, Modelo: \x1b[36m${mod}\x1b[0m!`);
        break;
      } catch (err: any) {
        this.logger.error(`\x1b[31m[AI ENGINE - BACKEND]\x1b[0m Falló con Proveedor: \x1b[36m${prov}\x1b[0m: ${err.message}`);
        if (prov !== fallbackOrder[fallbackOrder.length - 1].provider) {
          this.logger.warn(`\x1b[33m[AI ENGINE - BACKEND]\x1b[0m Intentando siguiente proveedor en la cascada de fallbacks...`);
        }
      }
    }

    if (content === null) {
      this.logger.error(`[AI ENGINE - BACKEND] Todos los proveedores fallaron para la generación de tesis`);
      content = `Error: Todos los proveedores de IA disponibles fallaron. Por favor, verifica tu configuración de API keys.`;
      status = 'FAILED';
    }

    const record = await this.prisma.thesisGeneration.create({
      data: {
        userId,
        templateId: data.templateId,
        templateName: template.name,
        topic: data.topic,
        userPrompt: data.userPrompt,
        sectionNames: data.sectionNames,
        aiProvider: usedProvider,
        content,
        status,
      },
    });

    return { id: record.id, content, sections: data.sectionNames };
  }

  async getHistory(userId: string) {
    return this.prisma.thesisGeneration.findMany({
      where: { userId },
      select: {
        id: true,
        templateName: true,
        topic: true,
        sectionNames: true,
        aiProvider: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getGeneration(id: string, userId: string) {
    const gen = await this.prisma.thesisGeneration.findUnique({ where: { id } });
    if (!gen) throw new NotFoundException('Generación no encontrada');
    if (gen.userId !== userId) throw new ForbiddenException('No tienes acceso a esta generación');
    return gen;
  }

  async deleteGeneration(id: string, userId: string) {
    const gen = await this.prisma.thesisGeneration.findUnique({ where: { id } });
    if (!gen) throw new NotFoundException('Generación no encontrada');
    if (gen.userId !== userId) throw new ForbiddenException('No tienes acceso a esta generación');
    await this.prisma.thesisGeneration.delete({ where: { id } });
  }

  private sanitizeMarkdownForHtml(md: string): string {
    let cleaned = md;
    cleaned = cleaned.replace(/\$\$(.+?)\$\$/gs, '<span class="math-tex">$$$1$$</span>');
    cleaned = cleaned.replace(/\\\((.+?)\\\)/gs, '<span class="math-inline">\\($1\\)</span>');
    cleaned = cleaned.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');
    cleaned = cleaned.replace(/`([^`]+)`/g, '<code>$1</code>');
    return cleaned;
  }

  async generateThesisPdf(id: string, userId: string): Promise<Buffer> {
    const gen = await this.prisma.thesisGeneration.findUnique({
      where: { id },
    });
    if (!gen) throw new NotFoundException('Generación no encontrada');
    if (gen.userId !== userId) throw new ForbiddenException('No tienes acceso a esta generación');

    if (!gen.content || gen.content.startsWith('Error:')) {
      throw new BadRequestException('El contenido de la tesis no es válido para generar PDF. Re-genera el contenido.');
    }

    const template = await this.prisma.thesisTemplate.findUnique({
      where: { id: gen.templateId },
    });

    const templateFormatting = ((template as any)?.formatting || {}) as any;
    const hasFormatting = templateFormatting && Object.keys(templateFormatting).length > 0;

    this.logger.log(`[PDF GENERATOR] Generando PDF para tesis ID: ${id}`);
    this.logger.log(`[PDF GENERATOR] Plantilla asociada: ID: ${gen.templateId}, Nombre: "${template?.name || 'Desconocida'}"`);
    this.logger.log(`[PDF GENERATOR] ¿Tiene formato en DB (formatting)?: ${hasFormatting}`);
    if (hasFormatting) {
      this.logger.log(`[PDF GENERATOR] Formato extraído de DB: ${JSON.stringify(templateFormatting, null, 2)}`);
    } else {
      this.logger.warn(`[PDF GENERATOR] Formato ausente. Usando valores predeterminados (Arial Narrow, 12, justified, etc.)`);
    }

    const formatting = hasFormatting ? templateFormatting : {
      fontFamily: 'Arial Narrow',
      fontSize: 12,
      lineSpacing: 2,
      alignment: 'justified',
      margins: { top: 2.5, bottom: 2.5, left: 3.0, right: 2.5 },
      pageNumbering: { enabled: true, position: 'bottom-right', excludeFirstPage: true },
      decimalSeparator: ',',
      figureNaming: 'figuras',
      tableNaming: 'tablas',
    };

    const margins = formatting.margins || { top: 2.5, left: 3, right: 2.5, bottom: 2.5 };
    const fontSize = formatting.fontSize || 12;
    const alignment = formatting.alignment || 'justified';
    const fontFamily = formatting.fontFamily || 'Arial Narrow';
    const lineSpacing = formatting.lineSpacing || 2;
    const pageNumbering = formatting.pageNumbering || { enabled: true, position: 'bottom-right', excludeFirstPage: true };
    const position = pageNumbering.position || 'bottom-right';
    const isTop = position.startsWith('top');
    const align = position.endsWith('left') ? 'left' : position.endsWith('right') ? 'right' : 'center';
    const indent = formatting.indent !== undefined ? formatting.indent : '1.27cm';
    const paragraphSpacing = formatting.paragraphSpacing || '18pt';
    const headingSizeH1 = Math.round(fontSize * 1.33) + 'pt';
    const headingSizeH2 = Math.round(fontSize * 1.17) + 'pt';
    const headingSizeH3 = fontSize + 'pt';
    const headingSizeH4 = fontSize + 'pt';
    const tableFontSize = Math.max(fontSize - 1, 9) + 'pt';

    this.logger.log(`[PDF GENERATOR] Valores de formato resueltos:
      - Margen Superior: ${margins.top}cm
      - Margen Inferior: ${margins.bottom}cm
      - Margen Izquierdo: ${margins.left}cm
      - Margen Derecho: ${margins.right}cm
      - Fuente: "${fontFamily}"
      - Tamaño: ${fontSize}pt
      - Interlineado: ${lineSpacing}
      - Alineación: "${alignment}"
      - Sangría: "${indent}"
      - Espaciado Párrafos: "${paragraphSpacing}"
      - Heading H1: ${headingSizeH1}
      - Heading H2: ${headingSizeH2}
      - Heading H3: ${headingSizeH3}
      - Heading H4: ${headingSizeH4}
      - Tabla font-size: ${tableFontSize}
      - Numeración página: ${position}, excluir primera: ${pageNumbering.excludeFirstPage}`);

    let htmlContent: string;
    try {
      let markdownContent = gen.content;
      // Procesar bloques Mermaid: renderizar a PNG y reemplazar con <img>
      const processed = await this.diagramRenderer.renderMultipleToPng(
        this.extractMermaidDefinitions(markdownContent),
      );
      for (const [key, png] of Object.entries(processed)) {
        if (png) {
          const base64 = png.toString('base64');
          const imgTag = `<img src="data:image/png;base64,${base64}" class="diagram-img" alt="Diagrama" />`;
          markdownContent = markdownContent.replace(key, imgTag);
        }
      }
      const sanitizedMd = this.sanitizeMarkdownForHtml(markdownContent);
      htmlContent = await marked.parse(sanitizedMd);
      htmlContent = htmlContent.replace(/<!--PAGE_BREAK-->/g, '');
    } catch (err: any) {
      this.logger.error(`[PDF GENERATOR] Error al convertir markdown a HTML: ${err.message}`);
      throw new BadRequestException('Error al convertir el contenido markdown a HTML. Verifica que el contenido generado sea válido.');
    }

    const padLeft = align === 'left' || align === 'center'
      ? `${margins.left || 3}cm` : '0';
    const padRight = align === 'right' || align === 'center'
      ? `${margins.right || 2.5}cm` : '0';

    const fullHtml = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>${gen.topic}</title>
        <style>
          @page {
            size: A4;
          }

          * {
            box-sizing: border-box;
            word-wrap: break-word;
            overflow-wrap: break-word;
          }

          html {
            -webkit-print-color-adjust: exact;
          }

          body {
            font-family: "${fontFamily}", "Arial Narrow", Arial, sans-serif;
            font-size: ${fontSize}pt;
            line-height: ${lineSpacing};
            text-align: ${alignment === 'justified' ? 'justify' : alignment};
            color: #000;
            margin: 0;
            padding: 0;
            text-rendering: optimizeLegibility;
            -webkit-font-smoothing: antialiased;
            word-wrap: break-word;
            overflow-wrap: break-word;
          }

          h1 {
            font-size: ${headingSizeH1};
            font-weight: bold;
            text-align: center;
            margin-top: 36pt;
            margin-bottom: 24pt;
            page-break-before: always;
          }
          h1:first-of-type {
            page-break-before: avoid;
          }

          h2 {
            font-size: ${headingSizeH2};
            font-weight: bold;
            text-align: left;
            margin-top: 24pt;
            margin-bottom: 16pt;
            page-break-after: avoid;
          }

          h3 {
            font-size: ${headingSizeH3};
            font-weight: bold;
            text-align: left;
            margin-top: 20pt;
            margin-bottom: 12pt;
            page-break-after: avoid;
          }

          h4 {
            font-size: ${headingSizeH4};
            font-weight: bold;
            font-style: italic;
            text-align: left;
            margin-top: 18pt;
            margin-bottom: 10pt;
            page-break-after: avoid;
          }

          p {
            margin-top: 0;
            margin-bottom: ${paragraphSpacing};
            text-indent: ${indent};
            orphans: 3;
            widows: 3;
          }

          .cover p, .no-indent p, h1 + p, h2 + p, h3 + p, h4 + p {
            text-indent: 0 !important;
          }

          table {
            width: 100%;
            max-width: 100%;
            table-layout: fixed;
            border-collapse: collapse;
            margin: 24pt 0;
            border-top: 2px solid #000;
            border-bottom: 2px solid #000;
            font-size: ${tableFontSize};
            page-break-inside: avoid;
            word-wrap: break-word;
            overflow-wrap: anywhere;
          }

          th {
            border-bottom: 1px solid #000;
            padding: 8px 12px;
            font-weight: bold;
            text-align: left;
          }

          td {
            padding: 8px 12px;
            text-align: left;
            word-wrap: break-word;
            overflow-wrap: anywhere;
            hyphens: auto;
          }

          tr {
            page-break-inside: avoid;
          }

          ul, ol {
            margin-top: 0;
            margin-bottom: 18pt;
            padding-left: 24pt;
          }

          li {
            margin-bottom: 8pt;
            orphans: 3;
            widows: 3;
            word-wrap: break-word;
            overflow-wrap: anywhere;
          }

          .diagram-img {
            display: block;
            width: 100%;
            max-width: 100%;
            height: auto;
            margin: 24pt auto;
            page-break-inside: avoid;
          }
          p > .diagram-img {
            text-indent: 0;
          }
        </style>
      </head>
      <body>
        <div class="thesis-content">
          ${htmlContent}
        </div>
      </body>
      </html>
    `;

    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    } catch (err: any) {
      this.logger.error(`[PDF GENERATOR] Error al iniciar Chromium: ${err.message}`);
      throw new BadRequestException('No se pudo iniciar Chromium para generar el PDF. Verifica que esté instalado correctamente.');
    }

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 794, height: 1123 });
      await page.setContent(fullHtml, { waitUntil: 'networkidle0', timeout: 30000 });

      let displayHeaderFooter = false;
      let headerTemplate = '<div></div>';
      let footerTemplate = '<div></div>';

      if (pageNumbering?.enabled) {
        displayHeaderFooter = true;
        const numTemplate = `
          <div style="font-size: 9pt; font-family: '${fontFamily}', Arial, sans-serif; text-align: ${align}; width: 100%; padding-left: ${padLeft}; padding-right: ${padRight}; box-sizing: border-box;">
            <span class="pageNumber" style="word-wrap: break-word; overflow-wrap: anywhere;"></span>
          </div>
        `;
        if (isTop) {
          headerTemplate = numTemplate;
        } else {
          footerTemplate = numTemplate;
        }
      }

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter,
        headerTemplate,
        footerTemplate,
        margin: {
          top: `${margins.top || 2.5}cm`,
          bottom: `${margins.bottom || 2.5}cm`,
          left: `${margins.left || 3}cm`,
          right: `${margins.right || 2.5}cm`,
        },
        scale: 1,
        timeout: 60000,
      });

      return Buffer.from(pdfBuffer);
    } catch (err: any) {
      this.logger.error(`[PDF GENERATOR] Error al generar PDF: ${err.message}`);
      throw new BadRequestException(`Error al generar el PDF: ${err.message}`);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  async generateThesisDocx(id: string, userId: string): Promise<Buffer> {
    const gen = await this.prisma.thesisGeneration.findUnique({ where: { id } });
    if (!gen) throw new NotFoundException('Generación no encontrada');
    if (gen.userId !== userId) throw new ForbiddenException('No tienes acceso a esta generación');
    if (!gen.content || gen.content.startsWith('Error:')) {
      throw new BadRequestException('El contenido de la tesis no es válido para generar DOCX. Re-genera el contenido.');
    }

    const template = await this.prisma.thesisTemplate.findUnique({ where: { id: gen.templateId } });
    const templateFormatting = ((template as any)?.formatting || {}) as any;
    const hasFormatting = templateFormatting && Object.keys(templateFormatting).length > 0;

    this.logger.log(`[DOCX GENERATOR] Generando DOCX para tesis ID: ${id}`);
    this.logger.log(`[DOCX GENERATOR] ¿Tiene formato en DB?: ${hasFormatting}`);
    if (hasFormatting) {
      this.logger.log(`[DOCX GENERATOR] Formato extraído: ${JSON.stringify(templateFormatting, null, 2)}`);
    }

    const fmt = hasFormatting ? templateFormatting : {
      fontFamily: 'Arial Narrow', fontSize: 12, lineSpacing: 2, alignment: 'justified',
      margins: { top: 2.5, bottom: 2.5, left: 3.0, right: 2.5 },
      pageNumbering: { enabled: true, position: 'bottom-right', excludeFirstPage: true },
    };

    const margins = {
      top: fmt.margins?.top ?? 2.5,
      bottom: fmt.margins?.bottom ?? 2.5,
      left: fmt.margins?.left ?? 3.0,
      right: fmt.margins?.right ?? 2.5,
    };
    const fontSize = fmt.fontSize ?? 12;
    const fontFamily = fmt.fontFamily ?? 'Arial Narrow';
    const lineSpacing = fmt.lineSpacing ?? 2;
    const alignment = fmt.alignment ?? 'justified';
    const pageNumbering = {
      enabled: fmt.pageNumbering?.enabled ?? true,
      position: fmt.pageNumbering?.position ?? 'bottom-right',
      excludeFirstPage: fmt.pageNumbering?.excludeFirstPage ?? true,
    };
    const indentCm = this.parseUnitValue(fmt.indent || '1.27cm');
    const spacingPt = this.parseUnitValue(fmt.paragraphSpacing || '18pt');

    const halfPoint = (pt: number) => Math.round(pt * 2);
    const twipFromCm = (cm: number) => Math.round(cm * 567);
    const twipFromPt = (pt: number) => Math.round(pt * 20);

    const a4WidthMm = 210;
    const marginLeftCm = margins.left ?? 3;
    const marginRightCm = margins.right ?? 2.5;
    const pageContentWidthPx = Math.round((a4WidthMm - (marginLeftCm + marginRightCm) * 10) / 25.4 * 96);

    try {
      // Extraer y renderizar bloques Mermaid para DOCX
      const mermaidDefs = this.extractMermaidDefinitions(gen.content);
      const mermaidPngs = await this.diagramRenderer.renderMultipleToPng(mermaidDefs);
      const mermaidImages = new Map<string, Buffer>();
      let docxContent = gen.content;
      let counter = 0;
      for (const [block, png] of Object.entries(mermaidPngs)) {
        if (png) {
          const placeholder = `<!--MERMAID_PNG:${counter}-->`;
          mermaidImages.set(placeholder, png);
          docxContent = docxContent.replace(block, placeholder);
          counter++;
        }
      }

      const tokens = marked.lexer(docxContent);
      const children = this.convertTokensToDocx(tokens, {
        mermaidImages,
        pageContentWidthPx,
        fontFamily, fontSize,
        lineSpacing, alignment,
        indentTwip: twipFromCm(indentCm),
        spacingAfterTwip: twipFromPt(spacingPt),
        headingSizes: {
          1: halfPoint(fontSize * 1.33),
          2: halfPoint(fontSize * 1.17),
          3: halfPoint(fontSize),
          4: halfPoint(fontSize),
        },
      });

      const numbering = {
        config: [{
          reference: 'ordered-list',
          levels: [{
            level: 0,
            format: LevelFormat.DECIMAL,
            text: '%1.',
          }],
        }],
      };

      const doc = new Document({
        numbering,
        styles: {
          default: {
            document: {
              run: { font: fontFamily, size: halfPoint(fontSize) },
              paragraph: { spacing: { line: Math.round(lineSpacing * 240) }, alignment: alignment === 'justified' ? AlignmentType.JUSTIFIED : AlignmentType.LEFT },
            },
          },
        },
        sections: [{
          properties: {
            page: {
              size: { width: 11906, height: 16838 },
              margin: {
                top: twipFromCm(margins.top),
                bottom: twipFromCm(margins.bottom),
                left: twipFromCm(margins.left),
                right: twipFromCm(margins.right),
              },
            },
          },
          children,
          ...this.buildPageHeaderFooter(pageNumbering, fontFamily),
        }],
      });

      return Buffer.from(await Packer.toBuffer(doc));
    } catch (err: any) {
      this.logger.error(`[DOCX GENERATOR] Error al generar DOCX: ${err.message}`);
      throw new BadRequestException(`Error al generar el DOCX: ${err.message}`);
    }
  }

  /** Extrae bloques ```mermaid, los renderiza a PNG y reemplaza con <img> base64 en el markdown */
  private async processMermaidBlocksToHtml(markdown: string): Promise<string> {
    const mermaidRegex = /```mermaid\n?([\s\S]*?)```/g;
    let match;
    let result = markdown;
    const replacements: { full: string; img: string }[] = [];

    while ((match = mermaidRegex.exec(markdown)) !== null) {
      const definition = match[1].trim();
      if (!definition) continue;
      try {
        const png = await this.diagramRenderer.renderMermaidToPng(definition);
        if (png) {
          const base64 = png.toString('base64');
          const img = `<img src="data:image/png;base64,${base64}" class="diagram-img" alt="Diagrama" />`;
          replacements.push({ full: match[0], img });
        }
      } catch {
        // Si falla el render, dejar el bloque original
      }
    }

    for (const r of replacements) {
      result = result.replace(r.full, r.img);
    }
    return result;
  }

  /** Extrae bloques ```mermaid y los renderiza a PNG para DOCX, reemplazando con placeholders */
  private async processMermaidBlocksForDocx(
    markdown: string,
  ): Promise<{ text: string; images: Map<string, Buffer> }> {
    const mermaidRegex = /```mermaid\n?([\s\S]*?)```/g;
    const images = new Map<string, Buffer>();
    let match;
    let result = markdown;
    let counter = 0;

    while ((match = mermaidRegex.exec(markdown)) !== null) {
      const definition = match[1].trim();
      if (!definition) continue;
      const placeholder = `<!--MERMAID_PNG:${counter}-->`;
      try {
        const png = await this.diagramRenderer.renderMermaidToPng(definition);
        if (png) {
          images.set(placeholder, png);
          result = result.replace(match[0], placeholder);
          counter++;
        }
      } catch {
        // Si falla, dejar el bloque original
      }
    }
    return { text: result, images };
  }

  /** Extrae definiciones Mermaid del markdown y retorna un mapa de {mermaid_block: definition} */
  private extractMermaidDefinitions(markdown: string): Record<string, string> {
    const regex = /```mermaid\s*([\s\S]*?)```/g;
    const result: Record<string, string> = {};
    let match;
    while ((match = regex.exec(markdown)) !== null) {
      const definition = match[1].trim();
      if (definition) {
        result[match[0]] = definition;
      }
    }
    return result;
  }

  private parseUnitValue(val: string): number {
    const m = val.match(/^([\d.]+)\s*(cm|mm|pt|in)?$/);
    if (!m) return 1.27;
    const v = parseFloat(m[1]);
    const u = m[2];
    if (u === 'pt') return v / 28.35;
    if (u === 'mm') return v / 10;
    if (u === 'in') return v * 2.54;
    return v;
  }

  private buildPageHeaderFooter(
    pageNumbering: any,
    fontFamily: string,
  ): { headers?: any; footers?: any } {
    if (!pageNumbering?.enabled) return {};

    const position = pageNumbering.position || 'bottom-right';
    const isTop = position.startsWith('top');
    const align = position.endsWith('right')
      ? AlignmentType.RIGHT
      : position.endsWith('left')
        ? AlignmentType.LEFT
        : AlignmentType.CENTER;

    const numParagraph = new Paragraph({
      alignment: align,
      children: [new TextRun({
        children: [PageNumber.CURRENT],
        font: fontFamily,
        size: 18,
      })],
    });

    const defaultContainer = isTop
      ? new Header({ children: [numParagraph] })
      : new Footer({ children: [numParagraph] });

    const container = pageNumbering.excludeFirstPage
      ? {
          default: defaultContainer,
          first: isTop
            ? new Header({ children: [new Paragraph({ children: [] })] })
            : new Footer({ children: [new Paragraph({ children: [] })] }),
        }
      : { default: defaultContainer };

    return isTop ? { headers: container } : { footers: container };
  }

  private convertTokensToDocx(tokens: any[], opts: any): any[] {
    const result: any[] = [];
    const mermaidImages: Map<string, Buffer> = opts.mermaidImages || new Map();
    for (const tok of tokens) {
      switch (tok.type) {
        case 'heading': {
          const depth = Math.min(tok.depth, 4);
          const size = opts.headingSizes[depth] || opts.fontSize * 2;
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
          const paraText = tok.text || (tok.tokens || []).map((t: any) => t.text || '').join('');
          const mermaidMatch = paraText.match(/<!--MERMAID_PNG:(\d+)-->/);
          if (mermaidMatch) {
            const placeholder = `<!--MERMAID_PNG:${mermaidMatch[1]}-->`;
            const pngBuffer = mermaidImages.get(placeholder);
            if (pngBuffer) {
              try {
                const dims = sizeOf(pngBuffer);
                const imgW = dims.width || 400;
                const imgH = dims.height || 300;
                const maxPx = opts.pageContentWidthPx || 600;
                let pxW: number, pxH: number;
                if (imgW > maxPx) {
                  const ratio = maxPx / imgW;
                  pxW = maxPx;
                  pxH = Math.round(imgH * ratio);
                } else {
                  pxW = imgW;
                  pxH = imgH;
                }
                result.push(new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 240, after: 240 },
                  children: [new ImageRun({
                    type: 'png',
                    data: pngBuffer,
                    transformation: { width: pxW, height: pxH },
                  })],
                }));
              } catch {
                result.push(new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 200, after: 200 },
                  children: [new TextRun({ text: '[Diagrama]', font: opts.fontFamily, size: opts.fontSize * 2, italics: true })],
                }));
              }
              break;
            }
          }
          result.push(new Paragraph({
            spacing: { after: opts.spacingAfterTwip, line: Math.round(opts.lineSpacing * 240) },
            indent: { firstLine: opts.indentTwip },
            alignment: opts.alignment === 'justified' ? AlignmentType.JUSTIFIED : AlignmentType.LEFT,
            children: tok.tokens?.length
              ? this.inlineToTextRuns(tok.tokens, opts.fontFamily, opts.fontSize * 2)
              : tok.text ? [new TextRun({ text: tok.text, font: opts.fontFamily, size: opts.fontSize * 2 })] : [],
          }));
          break;
        }
        case 'list': {
          for (const item of tok.items || []) {
            const itemTokens = item.tokens || [];
            const paraTokens = itemTokens.filter((t: any) => t.type === 'paragraph' || t.type === 'text');
            if (paraTokens.length === 0) {
              result.push(new Paragraph({
                spacing: { after: 120, line: Math.round(opts.lineSpacing * 240) },
                bullet: tok.ordered ? undefined : { level: 0 },
                numbering: tok.ordered ? { reference: 'ordered-list', level: 0 } : undefined,
                children: item.text ? [new TextRun({ text: item.text, font: opts.fontFamily, size: opts.fontSize * 2 })] : [],
              }));
            } else {
              for (let i = 0; i < paraTokens.length; i++) {
                const pt = paraTokens[i];
                result.push(new Paragraph({
                  spacing: { after: 80, line: Math.round(opts.lineSpacing * 240) },
                  indent: i > 0 ? { left: 720 } : undefined,
                  bullet: i === 0 && !tok.ordered ? { level: 0 } : undefined,
                  numbering: i === 0 && tok.ordered ? { reference: 'ordered-list', level: 0 } : undefined,
                  children: pt.tokens?.length
                    ? this.inlineToTextRuns(pt.tokens, opts.fontFamily, opts.fontSize * 2)
                    : pt.text ? [new TextRun({ text: pt.text, font: opts.fontFamily, size: opts.fontSize * 2 })] : [],
                }));
              }
            }
          }
          break;
        }
        case 'table': {
          const headerCells = (tok.header || []).map((h: string) =>
            new TableCell({
              children: [new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [new TextRun({ text: h, font: opts.fontFamily, size: Math.max(opts.fontSize - 1, 9) * 2, bold: true })],
              })],
            })
          );
          const rows = (tok.rows || []).map((row: string[]) =>
            new TableRow({
              children: row.map((cell: string) =>
                new TableCell({
                  children: [new Paragraph({
                    alignment: AlignmentType.LEFT,
                    children: [new TextRun({ text: cell, font: opts.fontFamily, size: Math.max(opts.fontSize - 1, 9) * 2 })],
                  })],
                })
              ),
            })
          );
          result.push(new Table({
            rows: [new TableRow({ children: headerCells }), ...rows],
          }));
          break;
        }
        case 'code': {
          result.push(new Paragraph({
            spacing: { before: 200, after: 200 },
            indent: { left: 360 },
            children: [new TextRun({
              text: tok.text || '',
              font: 'Courier New',
              size: (opts.fontSize - 1) * 2,
            })],
          }));
          break;
        }
        case 'html': {
          if (/PAGE_BREAK/i.test(tok.text || '')) {
            result.push(new Paragraph({ pageBreakBefore: true, children: [] }));
          } else if (/MERMAID_PNG/.test(tok.text || '')) {
            const placeholder = tok.text?.trim();
            const pngBuffer = placeholder ? mermaidImages.get(placeholder) : undefined;
            if (pngBuffer) {
              try {
                const dims = sizeOf(pngBuffer);
                const imgW = dims.width || 400;
                const imgH = dims.height || 300;
                const maxPx = opts.pageContentWidthPx || 600;
                let pxW: number, pxH: number;
                if (imgW > maxPx) {
                  const ratio = maxPx / imgW;
                  pxW = maxPx;
                  pxH = Math.round(imgH * ratio);
                } else {
                  pxW = imgW;
                  pxH = imgH;
                }
                result.push(new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 240, after: 240 },
                  children: [new ImageRun({
                    type: 'png',
                    data: pngBuffer,
                    transformation: { width: pxW, height: pxH },
                  })],
                }));
              } catch {
                result.push(new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 200, after: 200 },
                  children: [new TextRun({ text: '[Diagrama]', font: opts.fontFamily, size: opts.fontSize * 2, italics: true })],
                }));
              }
            }
          }
          break;
        }
        case 'blockquote': {
          result.push(new Paragraph({
            spacing: { after: opts.spacingAfterTwip, line: Math.round(opts.lineSpacing * 240) },
            indent: { left: 720, right: 360 },
            children: tok.tokens?.length
              ? this.inlineToTextRuns(tok.tokens, opts.fontFamily, opts.fontSize * 2)
              : tok.text ? [new TextRun({ text: tok.text, font: opts.fontFamily, size: opts.fontSize * 2 })] : [],
          }));
          break;
        }
        case 'image': {
          const imgUrl = tok.href || '';
          if (imgUrl) {
            result.push(new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 200 },
              children: [new TextRun({ text: tok.text || 'Figura', font: opts.fontFamily, size: opts.fontSize * 2, italics: true })],
            }));
          }
          break;
        }
        case 'space': break;
        default: {
          if (tok.text && tok.type !== 'hr') {
            result.push(new Paragraph({
              spacing: { after: opts.spacingAfterTwip, line: Math.round(opts.lineSpacing * 240) },
              indent: { firstLine: opts.indentTwip },
              children: [new TextRun({ text: tok.text, font: opts.fontFamily, size: opts.fontSize * 2 })],
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
        case 'del':
          result.push(new TextRun({ text: this.collectText(tok), font: fontFamily, size, strike: true }));
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

  async getTemplateSections(templateId: string) {
    const template = await this.prisma.thesisTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) throw new NotFoundException('Template no encontrado');
    if (!template.extractedSchema) throw new BadRequestException('El template no tiene un esquema extraído');
    const schema = template.extractedSchema as any;
    return { sections: schema.sections || [] };
  }

  private async resolveProvider(requestedProvider?: string, requestedModel?: string): Promise<{ aiProvider: string; aiModel: string }> {
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

    const defaultModels: Record<string, string> = {
      openai: 'gpt-4o',
      deepseek: 'deepseek-chat',
      gemini: 'gemini-3.1-flash-lite',
      groq: 'llama-3.3-70b-versatile',
      claude: 'claude-3-5-sonnet-20241022',
      minimax: 'MiniMax-Text-01',
    };

    let provider = requestedProvider;
    let model = requestedModel;

    if (provider === 'default' || !provider) {
      const settings = await this.prisma.systemSettings.findUnique({
        where: { id: 'default' },
      });
      provider = settings?.aiProvider || process.env.AI_PROVIDER || 'groq';
      model = settings?.aiModel || process.env.AI_MODEL || 'llama-3.3-70b-versatile';
    }

    if (model && !provider) {
      provider = modelToProvider[model];
    }
    if (provider && !model) {
      model = defaultModels[provider];
    }
    if (model && provider && modelToProvider[model] && modelToProvider[model] !== provider) {
      provider = modelToProvider[model];
    }

    if (!provider || !model) {
      const envProvider = process.env.AI_PROVIDER || 'groq';
      const envModel = process.env.AI_MODEL || 'llama-3.3-70b-versatile';
      provider = provider || envProvider;
      model = model || envModel;
    }

    const available = this.getAvailableProviders();
    if (!available[provider]) {
      throw new BadRequestException(
        `El proveedor '${provider}' no tiene una API key configurada. Agrega ${provider.toUpperCase()}_API_KEY en .env para activarlo.`,
      );
    }

    return { aiProvider: provider as string, aiModel: model as string };
  }

  private getAvailableProviders(): Record<string, boolean> {
    const hasKey = (key: string) => {
      const val = process.env[key];
      return !!val && val !== '' && val !== 'undefined';
    };
    return {
      openai: hasKey('OPENAI_API_KEY'),
      groq: hasKey('GROQ_API_KEY'),
      gemini: hasKey('GEMINI_API_KEY'),
      deepseek: hasKey('DEEPSEEK_API_KEY'),
      claude: hasKey('CLAUDE_API_KEY'),
      minimax: hasKey('MINIMAX_API_KEY'),
    };
  }

  private buildPipelineConfig(provider: string, model: string) {
    const openaiKey = provider === 'groq'
      ? (process.env.GROQ_API_KEY || '')
      : (process.env.OPENAI_API_KEY || '');

    return {
      openaiKey,
      deepseekKey: process.env.DEEPSEEK_API_KEY || '',
      geminiKey: process.env.GEMINI_API_KEY || '',
      claudeKey: process.env.CLAUDE_API_KEY || '',
      minimaxKey: process.env.MINIMAX_API_KEY || '',
      provider: provider as any,
      maxGrade: Number(process.env.MAX_GRADE) || 20,
      model,
    };
  }
}
