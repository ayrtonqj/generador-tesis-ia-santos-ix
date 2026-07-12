import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnalysisPipeline } from '@kimy/ai-engine';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class ReferencesService {
  private readonly logger = new Logger(ReferencesService.name);
  private readonly CROSSREF_BASE = 'https://api.crossref.org/works';

  constructor(
    private prisma: PrismaService,
    @InjectQueue('references') private queue: Queue,
  ) {}

  async enqueueAnalyze(advanceId: string) {
    await this.queue.add('analyze', { advanceId }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });
  }

  async analyze(advanceId: string) {
    // Obtener texto del avance (chunks o extractedText como fallback)
    const advance = await this.prisma.advance.findUnique({ where: { id: advanceId }, select: { extractedText: true } });
    const chunks = await this.prisma.advanceChunk.findMany({
      where: { advanceId },
      select: { content: true },
    });
    const fullText = chunks.length > 0
      ? chunks.map((c: any) => c.content).join('\n\n')
      : (advance?.extractedText || '');

    if (!fullText) {
      this.logger.warn(`No text found for advance ${advanceId}`);
      return;
    }

    const hasOpenAI = process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('your-openai-key');
    const hasGroq = process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== '';
    const hasGemini = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== '';

    let extracted: any[] = [];
    let success = false;

    // 1. OpenAI
    if (hasOpenAI && !success) {
      try {
        const pipeline = new AnalysisPipeline({ openaiKey: process.env.OPENAI_API_KEY!, maxGrade: 20 });
        extracted = await pipeline.extractReferences(fullText);
        success = true;
      } catch (e: any) {
        this.logger.error(`OpenAI refs extraction failed: ${e.message}`);
      }
    }

    // 2. Groq
    if (hasGroq && !success) {
      try {
        const pipeline = new AnalysisPipeline({ openaiKey: process.env.GROQ_API_KEY!, provider: 'groq', maxGrade: 20 });
        extracted = await pipeline.extractReferences(fullText);
        success = true;
      } catch (e: any) {
        this.logger.error(`Groq refs extraction failed: ${e.message}`);
      }
    }

    // 3. Gemini
    if (hasGemini && !success) {
      try {
        const pipeline = new AnalysisPipeline({ openaiKey: '', geminiKey: process.env.GEMINI_API_KEY, provider: 'gemini', maxGrade: 20 });
        extracted = await pipeline.extractReferences(fullText);
        success = true;
      } catch (e: any) {
        this.logger.error(`Gemini refs extraction failed: ${e.message}`);
      }
    }

    if (!success) {
      this.logger.warn(`Todos los modelos fallaron para extraer referencias en ${advanceId}`);
      extracted = [];
    }

    const analysis = await this.prisma.referenceAnalysis.upsert({
      where: { advanceId },
      create: {
        advanceId,
        totalRefs: extracted.length,
        verifiedCount: 0,
        errorCount: 0,
      },
      update: {
        totalRefs: extracted.length,
        verifiedCount: 0,
        errorCount: 0,
      },
    });

    // Limpiar referencias de intentos anteriores fallidos
    await this.prisma.reference.deleteMany({ where: { analysisId: analysis.id } });

    let verifiedCount = 0;
    let errorCount = 0;

    // Verificar cada referencia (con rate limiting: 1 req/seg)
    for (const ref of extracted) {
      try {
        const result = await this.verifyReference(ref);

        await this.prisma.reference.create({
          data: {
            analysisId: analysis.id,
            rawText: ref.rawText || '',
            authors: Array.isArray(ref.authors) ? ref.authors.join(', ') : (ref.authors ?? null),
            year: ref.year ? (parseInt(String(ref.year).replace(/\D/g, ''), 10) || null) : null,
            title: ref.title,
            journal: ref.journal,
            doi: ref.doi,
            url: ref.url,
            status: result.status as any,
            errorType: result.errorType,
            suggestion: result.suggestion,
            crossrefData: result.crossrefData,
          },
        });

        if (result.status === 'VERIFIED') verifiedCount++;
        else errorCount++;

        // Rate limit: esperar 1 segundo entre requests a CrossRef
        await new Promise((r) => setTimeout(r, 1000));
      } catch (error) {
        this.logger.error(`Error verifying reference: ${ref.title}`, error);
        errorCount++;
      }
    }

    await this.prisma.referenceAnalysis.update({
      where: { id: analysis.id },
      data: { verifiedCount, errorCount },
    });

    this.logger.log(
      `References: ${advanceId} — ${verifiedCount}/${extracted.length} verified, ${errorCount} errors`,
    );
  }

  private async verifyReference(ref: any) {
    if (ref.doi) {
      return this.verifyByDOI(ref);
    }
    if (ref.title) {
      return this.verifyByQuery(ref);
    }
    return {
      status: 'NOT_FOUND',
      errorType: 'insufficient_data',
      suggestion: 'No se pudo verificar: faltan datos (título o DOI)',
      crossrefData: null,
    };
  }

  /** Compara metadatos de la referencia del documento contra datos de CrossRef */
  private compareMetadata(ref: any, crossrefItem: any): { status: string; suggestion: string | null } {
    if (!crossrefItem) return { status: 'VERIFIED', suggestion: null };

    const docYear = ref.year ? parseInt(String(ref.year), 10) : null;
    const docAuthors = ref.authors
      ? (Array.isArray(ref.authors) ? ref.authors.join(', ') : String(ref.authors)).toLowerCase().trim()
      : null;

    // Extraer año de CrossRef
    const crossrefYear = crossrefItem?.published?.dateParts?.[0]?.[0] ||
                         crossrefItem?.['published-print']?.dateParts?.[0]?.[0] ||
                         crossrefItem?.['published-online']?.dateParts?.[0]?.[0] ||
                         null;

    // Extraer primer autor de CrossRef
    let crossrefAuthor: string | null = null;
    if (crossrefItem?.author?.[0]?.family) {
      crossrefAuthor = crossrefItem.author[0].family.toLowerCase();
    }

    let mismatches: string[] = [];

    if (docYear && crossrefYear && docYear !== crossrefYear) {
      mismatches.push(`año (doc: ${docYear}, CrossRef: ${crossrefYear})`);
    }

    if (docAuthors && crossrefAuthor && !docAuthors.includes(crossrefAuthor) && !crossrefAuthor.includes(docAuthors)) {
      mismatches.push(`autor (doc: "${ref.authors}", CrossRef: "${crossrefItem.author[0].family}")`);
    }

    if (mismatches.length > 0) {
      return {
        status: 'PARTIAL',
        suggestion: `Discrepancia en ${mismatches.join(', ')}. Verifique los datos.`,
      };
    }

    return { status: 'VERIFIED', suggestion: null };
  }

  private async verifyByDOI(ref: any) {
    const cleanDoi = ref.doi.replace(/^https?:\/\/doi\.org\//i, '');
    try {
      const res = await fetch(`${this.CROSSREF_BASE}/${encodeURIComponent(cleanDoi)}`, {
        headers: { 'User-Agent': 'KIMY-ThesisReview/1.0 (mailto:admin@kimy.edu)' },
      });

      if (res.status === 404) {
        return {
          status: 'NOT_FOUND',
          errorType: 'doi_not_found',
          suggestion: `DOI ${ref.doi} no encontrado en CrossRef`,
          crossrefData: null,
        };
      }

      const data = await res.json();
      const crossrefItem = data.message;
      const { status, suggestion } = this.compareMetadata(ref, crossrefItem);

      return {
        status,
        errorType: status === 'PARTIAL' ? 'metadata_mismatch' : null,
        suggestion,
        crossrefData: crossrefItem,
      };
    } catch {
      return { status: 'NOT_FOUND', errorType: 'network_error', suggestion: null, crossrefData: null };
    }
  }

  private async verifyByQuery(ref: any) {
    const authorsStr = Array.isArray(ref.authors) ? ref.authors.join(', ') : (ref.authors || '');
    const query = [ref.title, authorsStr].filter(Boolean).join(' ').substring(0, 120);
    try {
      const res = await fetch(
        `${this.CROSSREF_BASE}?query=${encodeURIComponent(query)}&rows=3`,
        { headers: { 'User-Agent': 'KIMY-ThesisReview/1.0 (mailto:admin@kimy.edu)' } },
      );

      if (!res.ok) {
        return { status: 'NOT_FOUND', errorType: 'api_error', suggestion: null, crossrefData: null };
      }

      const data = await res.json();
      const best = data.message?.items?.[0];

      if (!best || (best.score ?? 0) < 50) {
        return {
          status: 'HALLUCINATED',
          errorType: 'not_found_in_crossref',
          suggestion: `La referencia "${ref.title}" no fue encontrada en CrossRef. Verifique que exista.`,
          crossrefData: null,
        };
      }

      const { status, suggestion } = this.compareMetadata(ref, best);

      return {
        status,
        errorType: status === 'PARTIAL' ? 'metadata_mismatch' : null,
        suggestion: suggestion || (best.DOI ? `DOI encontrado: ${best.DOI}` : null),
        crossrefData: best,
      };
    } catch {
      return { status: 'NOT_FOUND', errorType: 'network_error', suggestion: null, crossrefData: null };
    }
  }

  async findAll() {
    return this.prisma.reference.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async getReport(advanceId: string) {
    return this.prisma.referenceAnalysis.findUnique({
      where: { advanceId },
      include: { references: { orderBy: { status: 'asc' } } },
    });
  }
}
