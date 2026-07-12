// ═══════════════════════════════════════════════════════════════
// KIMY — Pipeline de Análisis de IA
// ═══════════════════════════════════════════════════════════════

import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { GoogleGenerativeAI } from '@google/generative-ai';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import { EVALUATION_PROMPT, SECTION_ANALYSIS_PROMPT, REFERENCES_PROMPT, STRUCTURE_PROMPT, DETAILED_FEEDBACK_PROMPT, THESIS_GENERATION_PROMPT, SEQUENTIAL_SECTION_PROMPT } from '../prompts';
import type { AnalysisResult, ExtractedReference, TemplateSchema, DetailedFeedback, SectionAnalysisOutput, ThesisGenRequest, ThesisGenResult } from '../types';

export class AnalysisPipeline {
  private llm: any;
  private fastLlm: any;
  private embeddings: any;
  // Native Gemini SDK — used when provider === 'gemini'
  private geminiClient: GoogleGenerativeAI | null = null;
  private geminiModel: string = 'gemini-3.1-flash-lite';
  // Native Anthropic SDK — used when provider === 'claude'
  private claudeClient: any = null;
  private claudeModel: string = 'claude-3-5-sonnet-20241022';
  private splitter: RecursiveCharacterTextSplitter;

  private config: {
    openaiKey: string;
    deepseekKey?: string;
    geminiKey?: string;
    claudeKey?: string;
    minimaxKey?: string;
    provider?: 'openai' | 'gemini' | 'groq' | 'deepseek' | 'claude' | 'minimax';
    maxGrade: number;
    model?: string;
    embeddingModel?: string;
  };

  constructor(config: {
    openaiKey: string;
    deepseekKey?: string;
    geminiKey?: string;
    claudeKey?: string;
    minimaxKey?: string;
    provider?: 'openai' | 'gemini' | 'groq' | 'deepseek' | 'claude' | 'minimax';
    maxGrade: number;
    model?: string;
    embeddingModel?: string;
  }) {
    this.config = config;
    const isGemini = config.provider === 'gemini' && config.geminiKey;
    const isClaude = config.provider === 'claude' && config.claudeKey;
    const isMinimax = config.provider === 'minimax' && config.minimaxKey;

    if (isClaude) {
      // Native Anthropic SDK — no LangChain wrapper needed
      const Anthropic = require('@anthropic-ai/sdk');
      this.claudeClient = new Anthropic.default({ apiKey: config.claudeKey });
      this.claudeModel = config.model || 'claude-3-5-sonnet-20241022';
      this.embeddings = null;
    } else if (isMinimax) {
      // Minimax uses OpenAI-compatible REST API — only baseURL differs
      const minimaxModel = config.model || 'MiniMax-Text-01';
      this.llm = new ChatOpenAI({
        apiKey: config.minimaxKey,
        model: minimaxModel,
        temperature: 0.1,
        configuration: { baseURL: 'https://api.minimaxi.chat/v1' },
      });
      this.fastLlm = new ChatOpenAI({
        apiKey: config.minimaxKey,
        model: minimaxModel,
        temperature: 0,
        configuration: { baseURL: 'https://api.minimaxi.chat/v1' },
      });
      this.embeddings = null;
    } else if (isGemini) {
      // Use @google/generative-ai directly — bypasses LangChain version restrictions
      this.geminiClient = new GoogleGenerativeAI(config.geminiKey!);
      this.geminiModel = config.model || 'gemini-3.1-flash-lite';
    } else if (config.provider === 'groq') {
      // Groq uses an OpenAI-compatible REST API — no new package needed
      const groqModel = config.model || 'llama-3.3-70b-versatile';
      this.llm = new ChatOpenAI({
        apiKey: config.openaiKey,
        model: groqModel,
        temperature: 0.1,
        maxTokens: 32000,
        configuration: { baseURL: 'https://api.groq.com/openai/v1' },
      });
      this.fastLlm = new ChatOpenAI({
        apiKey: config.openaiKey,
        model: 'llama-3.1-8b-instant',
        temperature: 0,
        maxTokens: 32000,
        configuration: { baseURL: 'https://api.groq.com/openai/v1' },
      });
      // Groq doesn't have an embedding model — skip embeddings (already handled by skip guard)
      this.embeddings = null;
    } else if (config.provider === 'deepseek') {
      // DeepSeek uses OpenAI-compatible API — no new package needed
      const dsModel = config.model || 'deepseek-chat';
      this.llm = new ChatOpenAI({
        apiKey: config.deepseekKey || config.openaiKey,
        model: dsModel,
        temperature: 0.1,
        maxTokens: 32000,
        configuration: { baseURL: 'https://api.deepseek.com/v1' },
      });
      this.fastLlm = new ChatOpenAI({
        apiKey: config.deepseekKey || config.openaiKey,
        model: 'deepseek-chat',
        temperature: 0,
        maxTokens: 32000,
        configuration: { baseURL: 'https://api.deepseek.com/v1' },
      });
      this.embeddings = null;
    } else {
      this.llm = new ChatOpenAI({
        apiKey: config.openaiKey,
        model: config.model || 'gpt-4o',
        temperature: 0.1,
        maxTokens: 32000,
        modelKwargs: { response_format: { type: 'json_object' } },
      });

      this.fastLlm = new ChatOpenAI({
        apiKey: config.openaiKey,
        model: 'gpt-4o-mini',
        temperature: 0,
        maxTokens: 32000,
        modelKwargs: { response_format: { type: 'json_object' } },
      });

      this.embeddings = new OpenAIEmbeddings({
        apiKey: config.openaiKey,
        model: config.embeddingModel || 'text-embedding-3-large',
      });
    }

    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1500,
      chunkOverlap: 200,
      separators: ['\n\n', '\n', '. ', ' '],
    });
  }

  // ─── Helper: invoke Gemini with retry + model cascade ───────────
  private async invokeGemini(systemPrompt: string, userContent: string): Promise<string> {
    if (!this.geminiClient) throw new Error('Gemini client not initialized');

    // Serie 2.5 / 3.x activa en capa gratuita (mayo 2026)
    // Se intenta en orden de mejor a peor calidad, priorizando el seleccionado por el usuario.
    const modelsToTry = [
      this.geminiModel,
      'gemini-3.5-flash',
      'gemini-3-flash',
      'gemini-3.1-flash-lite',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
    ].filter((v, i, a) => a.indexOf(v) === i);

    // Errors that are billing/account issues — no point retrying or trying other models
    const isFatalBillingError = (msg: string) =>
      msg.includes('prepaid credits are depleted') ||
      msg.includes('SERVICE_DISABLED') ||
      msg.includes('CONSUMER_INVALID') ||
      msg.includes('403');

    let lastError: any;
    for (const modelName of modelsToTry) {
      console.log(`\x1b[35m[AI ENGINE - GEMINI]\x1b[0m Intentando invocar modelo: \x1b[36m${modelName}\x1b[0m`);
      const apiVersion = 'v1beta';
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          if (attempt > 0) {
            console.log(`\x1b[35m[AI ENGINE - GEMINI]\x1b[0m Reintentando modelo \x1b[36m${modelName}\x1b[0m (Intento ${attempt + 1}/2)...`);
          }
          const model = this.geminiClient.getGenerativeModel(
            { model: modelName },
            { apiVersion }
          );
          const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userContent}` }] }],
            generationConfig: { maxOutputTokens: 32768 },
          });
          let text = result.response.text();
          if (text.startsWith('```json')) text = text.replace(/^```json\n?/, '').replace(/\n?```$/, '');
          else if (text.startsWith('```')) text = text.replace(/^```\n?/, '').replace(/\n?```$/, '');
          console.log(`\x1b[32m[AI ENGINE - GEMINI]\x1b[0m ¡Invocación exitosa con modelo: \x1b[36m${modelName}\x1b[0m!`);
          return text.trim();
        } catch (e: any) {
          lastError = e;
          const fullMsg = e?.message || '';
          const msg = fullMsg.length > 300 ? fullMsg.substring(0, 300) + '...' : fullMsg;
          console.warn(`\x1b[31m[AI ENGINE - GEMINI]\x1b[0m Falló intento con \x1b[36m${modelName}\x1b[0m: ${msg}`);

          // Billing / account error: fail immediately, skip all remaining models
          if (isFatalBillingError(fullMsg)) {
            console.error(`\x1b[31m[AI ENGINE - GEMINI]\x1b[0m Error de facturación fatal en Google. Abortando invocación.`);
            throw e;
          }

          // True rate-limit 429 with retryDelay hint: wait once then retry same model
          const isRateLimit = fullMsg.includes('429') && fullMsg.includes('retryDelay');
          if (isRateLimit && attempt === 0) {
            const match = fullMsg.match(/"retryDelay":"(\d+)s"/);
            const waitSeconds = parseInt(match?.[1] || '10');
            console.log(`\x1b[33m[AI ENGINE - GEMINI]\x1b[0m Límite de velocidad (429) detectado. Esperando \x1b[36m${waitSeconds}s\x1b[0m antes de reintentar...`);
            const waitMs = Math.min((waitSeconds + 3) * 1000, 30000);
            await new Promise(r => setTimeout(r, waitMs));
            continue;
          }

          if (attempt === 1 && modelName !== modelsToTry[modelsToTry.length - 1]) {
            console.log(`\x1b[33m[AI ENGINE - GEMINI]\x1b[0m Cambiando / saltando al siguiente modelo en la cascada de fallbacks...`);
          }
          break; // other error or second attempt: try next model
        }
      }
    }
    throw lastError;
  }

  // ─── Helper: invoke Claude (Anthropic SDK) ───────────────────
  private async invokeClaude(systemPrompt: string, userContent: string): Promise<string> {
    if (!this.claudeClient) throw new Error('Claude client not initialized');
    console.log(`\x1b[35m[AI ENGINE - CLAUDE]\x1b[0m Intentando invocar modelo: \x1b[36m${this.claudeModel}\x1b[0m`);
    try {
      const message = await this.claudeClient.messages.create({
        model: this.claudeModel,
        max_tokens: 16384,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      });
      let text = message.content[0]?.type === 'text' ? message.content[0].text : '';
      if (text.startsWith('```json')) text = text.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      else if (text.startsWith('```')) text = text.replace(/^```\n?/, '').replace(/\n?```$/, '');
      console.log(`\x1b[32m[AI ENGINE - CLAUDE]\x1b[0m ¡Invocación exitosa con modelo: \x1b[36m${this.claudeModel}\x1b[0m!`);
      return text.trim();
    } catch (e: any) {
      console.error(`\x1b[31m[AI ENGINE - CLAUDE]\x1b[0m Falló invocación con \x1b[36m${this.claudeModel}\x1b[0m: ${e.message}`);
      throw e;
    }
  }

  // ─── Extracción de texto ────────────────────
  async extractText(fileBuffer: Buffer, fileType: 'pdf' | 'docx'): Promise<string> {
    if (fileType === 'docx') {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      return result.value;
    }
    const data = await pdfParse(fileBuffer);
    return data.text;
  }

  // ─── Chunking ──────────────────────────────
  async chunkDocument(text: string, chunkOverlap = 200): Promise<string[]> {
    if (chunkOverlap === 0) {
      const translationSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1500,
        chunkOverlap: 0,
        separators: ['\n\n', '\n', '. ', ' '],
      });
      return translationSplitter.splitText(text);
    }
    return this.splitter.splitText(text);
  }

  // ─── Embeddings ────────────────────────────
  async generateEmbeddings(chunks: string[]): Promise<number[][]> {
    // Gemini, Claude, Minimax, and Groq have no configured embedding model — skip
    if (this.geminiClient || this.claudeClient || !this.embeddings) {
      return chunks.map(() => []);
    }
    // Procesar en batches de 20 para evitar rate limits
    const batchSize = 20;
    const allEmbeddings: number[][] = [];
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const embeddings = await this.embeddings.embedDocuments(batch);
      allEmbeddings.push(...embeddings);
    }
    return allEmbeddings;
  }

  // ─── Extracción de estructura ──────────────
  async extractStructure(text: string): Promise<TemplateSchema> {
    let rawContent: string;
    const truncatedText = text; // Sin límite: enviar el documento patrón completo de inicio a fin
    if (this.geminiClient) {
      rawContent = await this.invokeGemini(STRUCTURE_PROMPT, truncatedText);
    } else if (this.claudeClient) {
      rawContent = await this.invokeClaude(STRUCTURE_PROMPT, truncatedText);
    } else {
      const response: any = await (this.fastLlm as any).invoke([
        { role: 'system', content: STRUCTURE_PROMPT },
        { role: 'user', content: truncatedText },
      ]);
      rawContent = response.content as string;
      if (rawContent.startsWith('```json')) rawContent = rawContent.replace(/^```json\n/, '').replace(/\n```$/, '');
      else if (rawContent.startsWith('```')) rawContent = rawContent.replace(/^```\n/, '').replace(/\n```$/, '');
    }
    return this.parseRobustJson(rawContent);
  }

  // ─── Análisis principal ────────────────────
  private buildFlexibleRegex(patternStr: string): RegExp {
    let pattern = patternStr
      .replace(/[aáàä]/gi, '[aáàäAÁÀÄ]')
      .replace(/[eéèë]/gi, '[eéèëEÉÈË]')
      .replace(/[iíìï]/gi, '[iíìïIÍÌÏ]')
      .replace(/[oóòö]/gi, '[oóòöOÓÒÖ]')
      .replace(/[uúùü]/gi, '[uúùüUÚÙÜ]')
      .replace(/[nñ]/gi, '[nñNÑ]');

    pattern = pattern.replace(/[\s\-_:\.]+/g, '[\\s\\-_:\\.]*');

    // Require the header to be at the start of a line (with optional markdown hashes)
    // and followed by a space, punctuation, newline, or end of string.
    return new RegExp(`(?:^|\\n)#{1,4}\\s*${pattern}(?=\\s|\\n|$)|(?:^|\\n)${pattern}(?=\\s|\\n|$)`, 'i');
  }

  private findSectionOffset(fullText: string, sectionName: string): { index: number; length: number } | null {
    // 1. Try flexible regex matching the whole name
    let regex = this.buildFlexibleRegex(sectionName);
    let match = regex.exec(fullText);
    if (match) {
      return { index: match.index, length: match[0].length };
    }

    // 2. Try matching after colon/hyphen/dot if present (e.g. "CAPITULO I: INTRODUCCIÓN" -> "INTRODUCCIÓN")
    const parts = sectionName.split(/[:\-\.]+/);
    if (parts.length > 1) {
      for (const part of parts) {
        const trimmedPart = part.trim();
        if (trimmedPart.length > 4) { // Avoid short Roman numerals/numbers
          regex = this.buildFlexibleRegex(trimmedPart);
          match = regex.exec(fullText);
          if (match) {
            return { index: match.index, length: match[0].length };
          }
        }
      }
    }

    // 3. Fallback for common synonyms
    const lowerName = sectionName.toLowerCase();
    let synonyms: string[] = [];
    if (lowerName.includes('introduc')) {
      synonyms = ['introducción', 'introduccion', 'capítulo i', 'capitulo i'];
    } else if (lowerName.includes('método') || lowerName.includes('metodo')) {
      synonyms = ['método', 'metodo', 'metodología', 'metodologia', 'capítulo ii', 'capitulo ii'];
    } else if (lowerName.includes('aspectos') || lowerName.includes('administrativ')) {
      synonyms = ['aspectos administrativos', 'recursos y presupuesto', 'capítulo iii', 'capitulo iii'];
    } else if (lowerName.includes('referencia') || lowerName.includes('bibliograf')) {
      synonyms = ['referencias bibliográficas', 'referencias bibliograficas', 'referencias', 'bibliografía', 'bibliografia'];
    } else if (lowerName.includes('anexo')) {
      synonyms = ['anexos', 'apéndices', 'apendices'];
    } else if (lowerName.includes('cubierta') || lowerName.includes('carátula') || lowerName.includes('caratula')) {
      synonyms = ['carátula', 'caratula', 'portada', 'cubierta'];
    }

    for (const syn of synonyms) {
      regex = this.buildFlexibleRegex(syn);
      match = regex.exec(fullText);
      if (match) {
        return { index: match.index, length: match[0].length };
      }
    }

    return null;
  }

  // ─── Helper: extraer texto de una sección por su nombre ────────
  private extractSectionText(fullText: string, sectionName: string, allSectionNames: string[]): string {
    let startMatch = this.findSectionOffset(fullText, sectionName);
    let sectionStart = 0;
    let startMatchLength = 0;

    if (!startMatch) {
      // If it's the very first section in the template (e.g., Cover/Carátula), it starts at 0
      if (allSectionNames[0] === sectionName) {
        sectionStart = 0;
        startMatchLength = 0;
      } else {
        return '';
      }
    } else {
      sectionStart = startMatch.index;
      startMatchLength = startMatch.length;
    }

    let sectionEnd = fullText.length;

    // Find where the next section starts
    for (const otherName of allSectionNames) {
      if (otherName === sectionName) continue;

      const otherMatch = this.findSectionOffset(fullText.substring(sectionStart + startMatchLength), otherName);
      if (otherMatch) {
        const candidateEnd = sectionStart + startMatchLength + otherMatch.index;
        if (candidateEnd > sectionStart && candidateEnd < sectionEnd) {
          sectionEnd = candidateEnd;
        }
      }
    }

    return fullText.substring(sectionStart, sectionEnd).trim();
  }

  // ─── Helper: flatten nested sections for analysis ────────
  private flattenSections(sections: any[], level = 1): { name: string; level: number; required: boolean; description?: string; subsections?: any[] }[] {
    const flattened: { name: string; level: number; required: boolean; description?: string; subsections?: any[] }[] = [];
    for (const section of sections) {
      flattened.push({
        name: section.name,
        level,
        required: section.required,
        description: section.description,
        subsections: section.subsections,
      });
      if (section.subsections && Array.isArray(section.subsections)) {
        flattened.push(...this.flattenSections(section.subsections, level + 1));
      }
    }
    return flattened;
  }

  // ─── Helper: format subsections for prompt ────────
  private formatSubsectionsForPrompt = (subsections: any[], indent = ''): string => {
    if (!subsections || !Array.isArray(subsections) || subsections.length === 0) return '';
    let result = '';
    for (const sub of subsections) {
      const levelMarker = sub.level === 2 ? '  - ' : sub.level === 3 ? '    * ' : '- ';
      result += `${indent}${levelMarker}${sub.name}${sub.required ? ' (OBLIGATORIO)' : ' (opcional)'}\n`;
      if (sub.subsections && Array.isArray(sub.subsections) && sub.subsections.length > 0) {
        result += this.formatSubsectionsForPrompt(sub.subsections, indent + '    ');
      }
    }
    return result;
  };

  // ─── Fase 2: análisis detallado por sección ─────────────────────
  private async analyzeSectionBySection(
    fullText: string,
    templateSchema: TemplateSchema | object,
    advanceType: string,
    globalSummary: string,
    structureAnalysis: any,
  ): Promise<{ findings: any[]; sectionSummaries: Record<string, string> }> {
    const schema = templateSchema as TemplateSchema;
    const sections = schema.sections || [];
    const flattenedSections = this.flattenSections(sections);
    const allSectionNames = flattenedSections.map(s => s.name);
    const allFindings: any[] = [];
    const sectionSummaries: Record<string, string> = {};
    let accumulatedContext = `Resumen Global del Avance: ${globalSummary}`;

    const isFullThesis = /tesis\s*completa/i.test(advanceType);

    for (const section of sections) {
      const isPresent = structureAnalysis?.presentSections?.some(
        (p: string) => p.toLowerCase().includes(section.name.toLowerCase()) ||
          section.name.toLowerCase().includes(p.toLowerCase())
      );

      if (!isPresent && !isFullThesis) continue;

      const sectionText = this.extractSectionText(fullText, section.name, allSectionNames);
      const subsectionsStr = this.formatSubsectionsForPrompt(section.subsections || []);

      const sectionPromptContent = `
## SECCIÓN A ANALIZAR
Nombre: ${section.name}
Nivel: ${section.level || 1}
Descripción del patrón: ${section.description || 'Sin descripción específica.'}
Reglas de validación específicas: ${section.validationRules && section.validationRules.length > 0 ? section.validationRules.map((r: string) => `- ${r}`).join('\n') : 'Ninguna especificada.'}
Estado detectado: ${isPresent ? 'PRESENTE en el documento' : 'AUSENTE en el documento'}
Tipo de avance: ${advanceType}

## JERARQUÍA DE SUBSECCIONES DEL PATRÓN:
${subsectionsStr || 'Esta sección no tiene subsecciones definidas en el patrón.'}

## CONTEXTO ACUMULADO DE SECCIONES ANTERIORES
${accumulatedContext}

## TEXTO DE ESTA SECCIÓN EN EL DOCUMENTO DEL ESTUDIANTE
${sectionText ? sectionText.substring(0, 200000) : '(Sección no encontrada en el documento — está AUSENTE)'}

## RESPUESTA REQUERIDA
Responde con este JSON exacto (sin backticks, sin markdown):
{
  "findings": [
    {
      "sectionRef": "${section.name}",
      "pageRef": null,
      "severity": "CRITICAL|MAJOR|MINOR|SUGGESTION",
      "description": "<descripción específica, mínimo 2 oraciones>",
      "correctionSteps": "<pasos para corregir, mínimo 3 pasos>",
      "exampleImprovement": "<ejemplo concreto de mejora>",
      "recommendation": "<consejo académico adicional>"
    }
  ],
  "sectionSummary": "<resumen en 2-3 oraciones de los elementos clave encontrados en esta sección, para contexto de las siguientes secciones>"
}`;

      console.log(`\x1b[35m[AI ENGINE - PHASE 2]\x1b[0m Analizando sección: \x1b[36m${section.name}\x1b[0m`);

      let rawContent: string;
      try {
        if (this.geminiClient) {
          rawContent = await this.invokeGemini(SECTION_ANALYSIS_PROMPT, sectionPromptContent);
        } else if (this.claudeClient) {
          rawContent = await this.invokeClaude(SECTION_ANALYSIS_PROMPT, sectionPromptContent);
        } else {
          const response: any = await (this.llm as any).invoke([
            { role: 'system', content: SECTION_ANALYSIS_PROMPT },
            { role: 'user', content: sectionPromptContent },
          ]);
          rawContent = response.content as string;
          if (rawContent.startsWith('```json')) rawContent = rawContent.replace(/^```json\n/, '').replace(/\n```$/, '');
          else if (rawContent.startsWith('```')) rawContent = rawContent.replace(/^```\n/, '').replace(/\n```$/, '');
        }

        const parsed: SectionAnalysisOutput = this.parseRobustJson(rawContent);
        if (parsed.findings && Array.isArray(parsed.findings)) {
          allFindings.push(...parsed.findings);
        }
        if (parsed.sectionSummary) {
          sectionSummaries[section.name] = parsed.sectionSummary;
          accumulatedContext += `\n\n[${section.name}]: ${parsed.sectionSummary}`;
        }
      } catch (e: any) {
        console.warn(`\x1b[33m[AI ENGINE - PHASE 2]\x1b[0m Falló análisis de sección "${section.name}": ${e.message}`);
      }

      // Analyze nested subsections recursively
      if (section.subsections && Array.isArray(section.subsections) && section.subsections.length > 0) {
        const subFindings = await this.analyzeSubsections(fullText, section, allSectionNames, accumulatedContext, isFullThesis, structureAnalysis, advanceType);
        allFindings.push(...subFindings);
      }
    }

    return { findings: allFindings, sectionSummaries };
  }

  // ─── Helper: analyze nested subsections recursively ────────
  private async analyzeSubsections(
    fullText: string,
    parentSection: any,
    allSectionNames: string[],
    accumulatedContext: string,
    isFullThesis: boolean,
    structureAnalysis: any,
    advanceType: string,
  ): Promise<any[]> {
    const subFindings: any[] = [];
    const parentName = parentSection.name;

    for (const subsection of parentSection.subsections || []) {
      const subsectionFullName = `${parentName} > ${subsection.name}`;
      const isPresent = structureAnalysis?.presentSections?.some(
        (p: string) => p.toLowerCase().includes(subsection.name.toLowerCase()) ||
          subsection.name.toLowerCase().includes(p.toLowerCase())
      );

      if (!isPresent && !isFullThesis) continue;

      const sectionText = this.extractSectionText(fullText, subsection.name, allSectionNames);
      const subSubsectionsStr = this.formatSubsectionsForPrompt(subsection.subsections || []);

      const subPromptContent = `
## SUB-SECCIÓN A ANALIZAR
Nombre: ${subsection.name}
Jerarquía: ${subsectionFullName}
Nivel: ${subsection.level || 2}
Descripción del patrón: ${subsection.description || 'Sin descripción específica.'}
Reglas de validación específicas: ${subsection.validationRules && subsection.validationRules.length > 0 ? subsection.validationRules.map((r: string) => `- ${r}`).join('\n') : 'Ninguna especificada.'}
Estado detectado: ${isPresent ? 'PRESENTE en el documento' : 'AUSENTE en el documento'}
Tipo de avance: ${advanceType}

## JERARQUÍA DE SUB-SUBSECCIONES DEL PATRÓN:
${subSubsectionsStr || 'Esta subsección no tiene sub-subsecciones definidas.'}

## CONTEXTO ACUMULADO
${accumulatedContext}

## TEXTO DE ESTA SUB-SECCIÓN EN EL DOCUMENTO DEL ESTUDIANTE
${sectionText ? sectionText.substring(0, 150000) : '(Sub-sección no encontrada en el documento — está AUSENTE)'}

## RESPUESTA REQUERIDA
Responde con este JSON exacto (sin backticks, sin markdown):
{
  "findings": [
    {
      "sectionRef": "${subsectionFullName}",
      "pageRef": null,
      "severity": "CRITICAL|MAJOR|MINOR|SUGGESTION",
      "description": "<descripción específica>",
      "correctionSteps": "<pasos para corregir>",
      "exampleImprovement": "<ejemplo concreto de mejora>",
      "recommendation": "<consejo académico adicional>"
    }
  ],
  "sectionSummary": "<resumen breve>"
}`;

      console.log(`\x1b[35m[AI ENGINE - PHASE 2]\x1b[0m Analizando sub-sección: \x1b[36m${subsection.name}\x1b[0m`);

      let rawContent: string;
      try {
        if (this.geminiClient) {
          rawContent = await this.invokeGemini(SECTION_ANALYSIS_PROMPT, subPromptContent);
        } else if (this.claudeClient) {
          rawContent = await this.invokeClaude(SECTION_ANALYSIS_PROMPT, subPromptContent);
        } else {
          const response: any = await (this.llm as any).invoke([
            { role: 'system', content: SECTION_ANALYSIS_PROMPT },
            { role: 'user', content: subPromptContent },
          ]);
          rawContent = response.content as string;
          if (rawContent.startsWith('```json')) rawContent = rawContent.replace(/^```json\n/, '').replace(/\n```$/, '');
          else if (rawContent.startsWith('```')) rawContent = rawContent.replace(/^```\n/, '').replace(/\n```$/, '');
        }

        const parsed: SectionAnalysisOutput = this.parseRobustJson(rawContent);
        if (parsed.findings && Array.isArray(parsed.findings)) {
          subFindings.push(...parsed.findings);
        }
      } catch (e: any) {
        console.warn(`\x1b[33m[AI ENGINE - PHASE 2]\x1b[0m Falló análisis de sub-sección "${subsection.name}": ${e.message}`);
      }

      // Recurse for sub-subsections
      if (subsection.subsections && Array.isArray(subsection.subsections) && subsection.subsections.length > 0) {
        const subSubFindings = await this.analyzeSubSubsections(fullText, subsection, parentName, allSectionNames, accumulatedContext, isFullThesis, structureAnalysis, advanceType);
        subFindings.push(...subSubFindings);
      }
    }

    return subFindings;
  }

  // ─── Helper: analyze sub-subsections (level 3) ────────
  private async analyzeSubSubsections(
    fullText: string,
    parentSubsection: any,
    grandparentName: string,
    allSectionNames: string[],
    accumulatedContext: string,
    isFullThesis: boolean,
    structureAnalysis: any,
    advanceType: string,
  ): Promise<any[]> {
    const subSubFindings: any[] = [];

    for (const subsub of parentSubsection.subsections || []) {
      const subsubFullName = `${grandparentName} > ${parentSubsection.name} > ${subsub.name}`;
      const isPresent = structureAnalysis?.presentSections?.some(
        (p: string) => p.toLowerCase().includes(subsub.name.toLowerCase()) ||
          subsub.name.toLowerCase().includes(p.toLowerCase())
      );

      if (!isPresent && !isFullThesis) continue;

      const sectionText = this.extractSectionText(fullText, subsub.name, allSectionNames);

      const subsubPromptContent = `
## SUB-SUB-SECCIÓN A ANALIZAR
Nombre: ${subsub.name}
Jerarquía completa: ${subsubFullName}
Nivel: ${subsub.level || 3}
Descripción del patrón: ${subsub.description || 'Sin descripción específica.'}
Reglas de validación específicas: ${subsub.validationRules && subsub.validationRules.length > 0 ? subsub.validationRules.map((r: string) => `- ${r}`).join('\n') : 'Ninguna especificada.'}
Estado detectado: ${isPresent ? 'PRESENTE en el documento' : 'AUSENTE en el documento'}
Tipo de avance: ${advanceType}

## TEXTO DE ESTA SUB-SUB-SECCIÓN EN EL DOCUMENTO
${sectionText ? sectionText.substring(0, 20000) : '(Sub-sub-sección no encontrada)'}

## RESPUESTA REQUERIDA
Responde con JSON exacto (sin backticks, sin markdown):
{
  "findings": [
    {
      "sectionRef": "${subsubFullName}",
      "pageRef": null,
      "severity": "CRITICAL|MAJOR|MINOR|SUGGESTION",
      "description": "<descripción>",
      "correctionSteps": "<pasos>",
      "exampleImprovement": "<ejemplo>",
      "recommendation": "<consejo>"
    }
  ],
  "sectionSummary": "<resumen>"
}`;

      console.log(`\x1b[35m[AI ENGINE - PHASE 2]\x1b[0m Analizando sub-sub-sección: \x1b[36m${subsub.name}\x1b[0m`);

      try {
        let rawContent: string;
        if (this.geminiClient) {
          rawContent = await this.invokeGemini(SECTION_ANALYSIS_PROMPT, subsubPromptContent);
        } else if (this.claudeClient) {
          rawContent = await this.invokeClaude(SECTION_ANALYSIS_PROMPT, subsubPromptContent);
        } else {
          const response: any = await (this.llm as any).invoke([
            { role: 'system', content: SECTION_ANALYSIS_PROMPT },
            { role: 'user', content: subsubPromptContent },
          ]);
          rawContent = response.content as string;
          if (rawContent.startsWith('```json')) rawContent = rawContent.replace(/^```json\n/, '').replace(/\n```$/, '');
          else if (rawContent.startsWith('```')) rawContent = rawContent.replace(/^```\n/, '').replace(/\n```$/, '');
        }

        const parsed: SectionAnalysisOutput = this.parseRobustJson(rawContent);
        if (parsed.findings && Array.isArray(parsed.findings)) {
          subSubFindings.push(...parsed.findings);
        }
      } catch (e: any) {
        console.warn(`\x1b[33m[AI ENGINE - PHASE 2]\x1b[0m Falló análisis de sub-sub-sección "${subsub.name}": ${e.message}`);
      }
    }

    return subSubFindings;
  }

  // ─── Análisis principal (2 fases) ─────────────────────────────
  async analyze(
    advanceText: string,
    templateSchema: TemplateSchema | object,
    templateText: string,
    advanceType: string,
  ): Promise<AnalysisResult> {
    const startMs = Date.now();

    // ── FASE 1: Evaluación global (puntuaciones + estructura) ──────
    console.log(`\x1b[35m[AI ENGINE - PHASE 1]\x1b[0m Evaluación global iniciada...`);
    const globalPrompt = `
## DOCUMENTO PATRÓN — ESTRUCTURA ESPERADA
${JSON.stringify(templateSchema, null, 2)}

## FRAGMENTO DEL PATRÓN (referencia de estilo y profundidad)
${templateText}

## TIPO DE AVANCE A EVALUAR
${advanceType}

## AVANCE DEL ESTUDIANTE
${advanceText.substring(0, 600000)}

## RESPUESTA REQUERIDA
Responde con este JSON exacto (sin backticks, sin markdown):
{
  "scores": {
    "structure": <número 0-100>,
    "content": <número 0-100>,
    "form": <número 0-100>,
    "originality": <número 0-100>
  },
  "executiveSummary": "<párrafo de 4-6 oraciones sintetizando fortalezas, debilidades, coherencia global y nivel de avance>",
  "structureAnalysis": {
    "presentSections": ["lista de secciones principales encontradas"],
    "missingSections": ["lista de secciones principales faltantes del patrón"],
    "extraSections": ["secciones no esperadas en el patrón"],
    "orderCorrect": true
  }
}`;

    let rawGlobal: string;
    if (this.geminiClient) {
      rawGlobal = await this.invokeGemini(EVALUATION_PROMPT, globalPrompt);
    } else if (this.claudeClient) {
      rawGlobal = await this.invokeClaude(EVALUATION_PROMPT, globalPrompt);
    } else {
      const response: any = await (this.llm as any).invoke([
        { role: 'system', content: EVALUATION_PROMPT },
        { role: 'user', content: globalPrompt },
      ]);
      rawGlobal = response.content as string;
      if (rawGlobal.startsWith('```json')) rawGlobal = rawGlobal.replace(/^```json\n/, '').replace(/\n```$/, '');
      else if (rawGlobal.startsWith('```')) rawGlobal = rawGlobal.replace(/^```\n/, '').replace(/\n```$/, '');
    }

    const globalParsed = this.parseRobustJson(rawGlobal);
    console.log(`\x1b[32m[AI ENGINE - PHASE 1]\x1b[0m Evaluación global completada.`);

    // ── FASE 2: Análisis detallado por sección ──────────────────────
    console.log(`\x1b[35m[AI ENGINE - PHASE 2]\x1b[0m Iniciando análisis secuencial por sección...`);
    const { findings: sectionFindings } = await this.analyzeSectionBySection(
      advanceText,
      templateSchema,
      advanceType,
      globalParsed.executiveSummary || '',
      globalParsed.structureAnalysis,
    );
    console.log(`\x1b[32m[AI ENGINE - PHASE 2]\x1b[0m Análisis por sección completado. Hallazgos encontrados: ${sectionFindings.length}`);

    const s = globalParsed.scores;
    const overall = s.structure * 0.3 + s.content * 0.4 + s.form * 0.2 + s.originality * 0.1;
    const grade = (overall / 100) * this.config.maxGrade;

    return {
      scores: {
        structure: Math.round(s.structure),
        content: Math.round(s.content),
        form: Math.round(s.form),
        originality: Math.round(s.originality),
        overall: Math.round(overall * 10) / 10,
      },
      grade: Math.round(grade * 10) / 10,
      executiveSummary: globalParsed.executiveSummary,
      structureAnalysis: globalParsed.structureAnalysis,
      findings: sectionFindings,
      processingMs: Date.now() - startMs,
    };
  }

  // ─── Feedback detallado ────────────────────
  async generateDetailedFeedback(
    advanceText: string,
    scores: { structure: number; content: number; form: number; originality: number; overall: number },
    executiveSummary: string,
    findings: any[],
    advanceType: string,
    templateSchema?: any,
    structureAnalysis?: any,
  ): Promise<DetailedFeedback> {
    const sectionsDescription = templateSchema
      ? `\n\n## ESTRUCTURA DEL PATRÓN (ESQUEMA DE SECCIONES ESPERADAS)\n${JSON.stringify(templateSchema, null, 2)}`
      : '';
    const structureAnalysisDescription = structureAnalysis
      ? `\n\n## ANÁLISIS DE SECCIONES DETECTADAS Y SU ESTADO\n- Secciones Presentes: ${JSON.stringify(structureAnalysis.presentSections || [])}\n- Secciones Faltantes: ${JSON.stringify(structureAnalysis.missingSections || [])}\n- Secciones No Esperadas: ${JSON.stringify(structureAnalysis.extraSections || [])}`
      : '';

    const userPrompt = `
## TIPO DE AVANCE EVALUADO
${advanceType}

## PUNTUACIONES POR DIMENSIÓN
- Estructura: ${scores.structure}/100
- Contenido: ${scores.content}/100
- Forma: ${scores.form}/100
- Originalidad: ${scores.originality}/100
- Puntaje Global: ${scores.overall}/100

## RESUMEN EJECUTIVO
${executiveSummary}

## HALLAZGOS DETECTADOS
${JSON.stringify(findings, null, 2)}${sectionsDescription}${structureAnalysisDescription}

## FRAGMENTO DEL AVANCE DEL ESTUDIANTE
${advanceText.substring(0, 600000)}`;

    let rawContent: string;
    if (this.geminiClient) {
      rawContent = await this.invokeGemini(DETAILED_FEEDBACK_PROMPT, userPrompt);
    } else if (this.claudeClient) {
      rawContent = await this.invokeClaude(DETAILED_FEEDBACK_PROMPT, userPrompt);
    } else {
      const response: any = await (this.llm as any).invoke([
        { role: 'system', content: DETAILED_FEEDBACK_PROMPT },
        { role: 'user', content: userPrompt },
      ]);
      rawContent = response.content as string;
      if (rawContent.startsWith('```json')) rawContent = rawContent.replace(/^```json\n/, '').replace(/\n```$/, '');
      else if (rawContent.startsWith('```')) rawContent = rawContent.replace(/^```\n/, '').replace(/\n```$/, '');
    }
    return this.parseRobustJson(rawContent);
  }

  // ─── Extracción de referencias ─────────────
  async extractReferences(text: string): Promise<ExtractedReference[]> {
    const bibIndex = text.search(
      /referencias\s+bibliográficas?|bibliografía|references|bibliography/i,
    );
    const bibSection = bibIndex !== -1
      ? text.slice(bibIndex) // Take everything to the end
      : text.slice(-30000);   // Fallback

    // Split the bibliography section into manageable chunks of 10,000 characters
    // with a 500 characters overlap to prevent cutting references in half.
    const chunkSize = 10000;
    const overlap = 500;
    const bibChunks: string[] = [];

    let start = 0;
    while (start < bibSection.length) {
      const end = Math.min(start + chunkSize, bibSection.length);
      bibChunks.push(bibSection.slice(start, end));
      if (end === bibSection.length) break;
      start += chunkSize - overlap;
    }

    console.log(`\x1b[35m[AI ENGINE - REFS EXTRACTION]\x1b[0m Extrayendo referencias de \x1b[36m${bibChunks.length}\x1b[0m fragmentos secuenciales.`);

    const allReferences: ExtractedReference[] = [];
    const seenRefs = new Set<string>();

    for (let i = 0; i < bibChunks.length; i++) {
      const chunkText = bibChunks[i];
      console.log(`\x1b[35m[AI ENGINE - REFS EXTRACTION]\x1b[0m Procesando fragmento \x1b[36m${i + 1}/${bibChunks.length}\x1b[0m (${chunkText.length} caracteres)...`);

      let rawContent: string;
      if (this.geminiClient) {
        rawContent = await this.invokeGemini(REFERENCES_PROMPT, chunkText);
      } else if (this.claudeClient) {
        rawContent = await this.invokeClaude(REFERENCES_PROMPT, chunkText);
      } else {
        const response: any = await (this.fastLlm as any).invoke([
          { role: 'system', content: REFERENCES_PROMPT },
          { role: 'user', content: chunkText },
        ]);
        rawContent = response.content as string;
        if (rawContent.startsWith('```json')) rawContent = rawContent.replace(/^```json\n/, '').replace(/\n```$/, '');
        else if (rawContent.startsWith('```')) rawContent = rawContent.replace(/^```\n/, '').replace(/\n```$/, '');
      }

      try {
        const parsed = this.parseRobustJson(rawContent);
        const chunkRefs: ExtractedReference[] = parsed.references || [];

        for (const ref of chunkRefs) {
          const normalized = (ref.title || ref.rawText || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
          if (normalized.length > 5 && !seenRefs.has(normalized)) {
            seenRefs.add(normalized);
            allReferences.push(ref);
          }
        }
      } catch (err) {
        console.error(`Error parsing JSON for reference chunk ${i + 1}:`, err);
      }
    }

    console.log(`\x1b[32m[AI ENGINE - REFS EXTRACTION]\x1b[0m Extracción final completada. Encontradas \x1b[36m${allReferences.length}\x1b[0m referencias únicas.`);
    return allReferences;
  }

  async generateThesis(request: ThesisGenRequest): Promise<ThesisGenResult> {
    const schemaSections = request.templateSchema.sections || [];

    // 1. Sort request.sectionNames according to the schema's order
    const orderedSectionNames = [...request.sectionNames].sort((a, b) => {
      const secA = schemaSections.find(s => s.name === a);
      const secB = schemaSections.find(s => s.name === b);
      return (secA?.order || 0) - (secB?.order || 0);
    });

    const isReferencesSection = (name: string) => {
      return /referencias\s+bibliográficas?|bibliografía|references|bibliography/i.test(name);
    };

    const needsRefs = (name: string) => {
      const lower = name.toLowerCase();
      return !(/carátula|portada|índice|tabla de contenido|jurado|cronograma|presupuesto|anexos|formatos|declaración/i.test(lower));
    };

    const isFormalSection = (name: string) =>
      /carátula|portada|jurado|índice|declaración|tabla de contenido|formatos|título|titulo|autoría|autoria|miembros/i.test(name);

    const isDiagramSection = (name: string) => {
      const lower = name.toLowerCase();
      return /árbol\s+de\s+objetivos|árbol\s+de\s+problemas|mapa\s+(mental|conceptual)|mindmap|ishikawa|espina\s+de\s+pescado|causa[-\s]?efecto|fishbone|árbol\s+de\s+decision(es)?|decision\s*tree|cronograma|gantt|diagrama\s+de\s+(flujo|gantt)|flujo(grama)?|proceso|flowchart|diagrama|figura|esquema/i.test(lower);
    };

    let fullMarkdown = '';
    const allReferences: string[] = [];
    const generatedSectionTitles: string[] = [];
    let lastGeneratedSectionText = '';

    const citationStyle = request.templateSchema.citationStyle || 'APA';

    for (const sectionName of orderedSectionNames) {
      // If it's a references/bibliography section, we skip it and populate at the end
      if (isReferencesSection(sectionName)) {
        continue;
      }

      const secConfig = schemaSections.find(s => s.name === sectionName) as any;

      // Smart scaling of estimated words for academic content to ensure real-world thesis length
      let targetWords = secConfig?.estimatedWords || secConfig?.minWords || 1000;
      const lowerName = sectionName.toLowerCase();
      const isAcademicContent = lowerName.includes('capitulo') ||
        lowerName.includes('capítulo') ||
        lowerName.includes('introducción') ||
        lowerName.includes('introduccion') ||
        lowerName.includes('método') ||
        lowerName.includes('metodo') ||
        lowerName.includes('marco') ||
        lowerName.includes('resultado') ||
        lowerName.includes('discusión') ||
        lowerName.includes('discusion') ||
        lowerName.includes('revisión') ||
        lowerName.includes('revision') ||
        lowerName.includes('teórico') ||
        lowerName.includes('teorico') ||
        lowerName.includes('conclusión') ||
        lowerName.includes('conclusion') ||
        lowerName.includes('análisis') ||
        lowerName.includes('analisis') ||
        lowerName.includes('diseño') ||
        lowerName.includes('diseno') ||
        lowerName.includes('desarrollo') ||
        lowerName.includes('propuesta') ||
        lowerName.includes('chapter') ||
        lowerName.includes('introduction') ||
        lowerName.includes('method') ||
        lowerName.includes('framework') ||
        lowerName.includes('result') ||
        lowerName.includes('discussion') ||
        lowerName.includes('conclusion') ||
        lowerName.includes('literature') ||
        lowerName.includes('theory') ||
        lowerName.includes('analysis') ||
        lowerName.includes('design') ||
        lowerName.includes('development') ||
        lowerName.includes('proposal');

      // Apply page range scaling FIRST to get the true target
      const pageRangeToScale: Record<string, number> = {
        'menos-10': 0.08,
        '10-20':    0.18,
        '20-30':    0.32,
        '30-40':    0.60,
        '40-50':    1.00,
        '50-60':    1.30,
        '60-70':    1.60,
        '70-80':    2.00,
        '+80':      2.50,
      };
      const scaleFactor = pageRangeToScale[request.targetPageRange || '40-50'] || 1.0;

      // Smart scaling of estimated words for academic content
      // Academic multiplier is capped based on page range to avoid bloat
      const academicMultiplier = scaleFactor < 0.5 ? 1.5 : scaleFactor < 1.0 ? 2.5 : 4;
      const minAcademicWords = scaleFactor < 0.15 ? 300 : scaleFactor < 0.4 ? 600 : 2500;

      if (isAcademicContent) {
        targetWords = Math.max(targetWords * academicMultiplier, minAcademicWords);
      } else if (isFormalSection(sectionName)) {
        targetWords = Math.max(targetWords, 100);
      } else if (!needsRefs(sectionName)) {
        targetWords = Math.max(targetWords, 150);
      }

      const minFloor = isFormalSection(sectionName)
        ? 20
        : scaleFactor < 0.15 ? 80 : scaleFactor < 0.4 ? 150 : 200;

      targetWords = Math.max(Math.floor(targetWords * scaleFactor), minFloor);

      const description = secConfig?.description || 'Desarrollar la sección según las mejores prácticas académicas.';
      const subsections = secConfig?.subsections || [];
      const validationRules = secConfig?.validationRules || [];
      const sectionLevel = secConfig?.order !== undefined ? 1 : 2;

      // Fetch real references from CrossRef for academic sections
      let realReferencesList = '';
      if (needsRefs(sectionName)) {
        const queryText = `${request.topic} ${sectionName}`;
        const realPapers = await this.fetchRealPapersFromCrossRef(queryText);
        if (realPapers.length > 0) {
          realReferencesList = realPapers.map((p, idx) => `${idx + 1}. ${p.formatted}`).join('\n');
        } else {
          realReferencesList = 'No se encontraron referencias específicas en CrossRef. Utiliza citas metodológicas generales de alta calidad si es necesario.';
        }
      } else {
        realReferencesList = 'Esta sección es administrativa o de estructura preliminar. No se requiere citación científica obligatoria.';
      }

      // Build context from previously generated sections
      const previousSectionsList = generatedSectionTitles.map(t => `- ${t}`).join('\n');
      const immediatePreviousText = lastGeneratedSectionText ? lastGeneratedSectionText.slice(-10000) : '';
      const previousContentOutline = generatedSectionTitles.length > 0
        ? `Secciones ya redactadas:\n${previousSectionsList}\n\nÚltimos párrafos redactados:\n...${immediatePreviousText}`
        : 'Ninguna sección ha sido redactada aún. Esta es la primera sección del documento.';

      const systemPrompt = SEQUENTIAL_SECTION_PROMPT
        .replace('{{topic}}', request.topic)
        .replace('{{citationStyle}}', citationStyle)
        .replace('{{fullSchema}}', JSON.stringify(request.templateSchema, null, 2))
        .replace('{{previousContentOutline}}', previousContentOutline)
        .replace('{{realReferencesList}}', realReferencesList)
        .replace('{{sectionName}}', sectionName)
        .replace('{{sectionLevel}}', sectionLevel.toString())
        .replace(
          '{{sectionSubsections}}',
          subsections.length > 0
            ? subsections.map((s: any) => `(nivel ${s.level}) ${s.name}`).join(', ')
            : 'Ninguna subsección obligatoria en el patrón — desarrollar como sección de contenido directo.'
        )
        .replace('{{sectionDescription}}', description)
        .replace(
          '{{validationRules}}',
          validationRules.length > 0
            ? validationRules.join('\n- ')
            : 'Sin reglas de validación específicas. Seguir las reglas generales de calidad.'
        )
        .replace('{{estimatedWords}}', targetWords.toString());

      const subsectionNames = subsections.length > 0
        ? subsections.map((s: any) => s.name).join(', ')
        : 'desarrollo directo según el patrón';

      const userMessage = isFormalSection(sectionName)
        ? `Tema de la tesis: ${request.topic}
Genera ÚNICAMENTE la plantilla formal o los datos de la sección "${sectionName}".
PROHIBIDO escribir párrafos narrativos, prosa, análisis, justificaciones o explicaciones de lo que representa la sección.
- Si es carátula: solo datos institucionales centrados (nombre de institución, facultad, título en minúsculas, autores, asesor, línea, sede, año).
- Si es jurado o miembros: solo lista de miembros del jurado/comité con roles (Presidente, Secretario, Vocal/Asesor).
- Si es índice: solo estructura con puntos suspensivos (......) y números de página.
- Si es declaración jurada: solo texto reglamentario oficial y campos de firma.
- Si es formatos/anexos: solo estructura de la plantilla.
- Si es título/título de la tesis: solo muestra el título en español e inglés.
- Si es autoría o información de autoría: solo muestra los nombres de los autores, afiliación institucional, ORCID y correo de contacto en una lista o bloque formal.
El sistema de conteo de palabras NO aplica para esta sección formal.`
        : `Tema de la tesis: ${request.topic}
Genera el contenido detallado de la sección "${sectionName}" (${targetWords} palabras estimadas).
Subsecciones obligatorias del patrón: ${subsectionNames}
- Desarrolla EXACTAMENTE las subsecciones listadas, en ese orden, respetando su nivel jerárquico.
- Redacta de 4 a 6 párrafos extensos y sustanciales por cada subsección de contenido académico.
- Integra de forma orgánica las citas de las fuentes bibliográficas reales provistas.
- Genera datos numéricos, tablas y esquemas completamente poblados, sin placeholders.
${isDiagramSection(sectionName) ? `- IMPORTANTE: Esta sección REQUIERE un diagrama Mermaid. Incluye un bloque \`\`\`mermaid después del texto introductorio con el diagrama correspondiente (mindmap, flowchart, gantt, etc.). El diagrama debe contener datos reales del contexto de la tesis.` : ''}`;

      let rawContent: string;
      if (this.geminiClient) {
        rawContent = await this.invokeGemini(systemPrompt, userMessage);
      } else if (this.claudeClient) {
        rawContent = await this.invokeClaude(systemPrompt, userMessage);
      } else {
        const activeProvider = this.config.provider || 'openai';
        const activeModel = this.config.model || 'gpt-4o';
        console.log(`\x1b[35m[AI ENGINE - ${activeProvider.toUpperCase()}]\x1b[0m Generando sección secuencial: \x1b[36m${sectionName}\x1b[0m usando \x1b[36m${activeModel}\x1b[0m`);
        try {
          const response: any = await (this.llm as any).invoke([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ]);
          rawContent = response.content as string;
        } catch (e: any) {
          console.error(`\x1b[31m[AI ENGINE - ${activeProvider.toUpperCase()}]\x1b[0m Falló invocación para sección ${sectionName}: ${e.message}`);
          throw e;
        }
      }

      // ── Validación de conteo de palabras (solo para secciones académicas, no formales) ────
      if (!isFormalSection(sectionName)) {
        const wordCount = (text: string) => text.split(/\s+/).filter(w => w.length > 0).length;
        const actualWords = wordCount(rawContent);
        const minRequiredWords = Math.floor(targetWords * 0.8);

        if (actualWords < minRequiredWords) {
          console.warn(`\x1b[33m[AI ENGINE]\x1b[0m Sección "${sectionName}" generó solo ${actualWords} palabras (mínimo: ${minRequiredWords}). Reintentando con énfasis en extensión...`);
          const retryMessage = `El contenido generado para "${sectionName}" tiene solo ${actualWords} palabras. Se requieren al menos ${targetWords} palabras.

CONTENIDO ACTUAL GENERADO:
${rawContent.substring(0, 15000)}

INSTRUCCIÓN DE EXPANSIÓN:
Expande y profundiza el contenido anterior hasta alcanzar al menos ${targetWords} palabras. Agrega:
- Más fundamentación teórica y citas adicionales.
- Ejemplos más detallados y aplicaciones concretas.
- Análisis crítico más profundo.
- Desarrolla más cada subsección con 4-6 párrafos sustanciales.
- NO resumas ni elimines contenido existente — EXPANDE.

Genera el contenido completo y expandido directamente en markdown.`;

          try {
            let retryContent: string;
            if (this.geminiClient) {
              retryContent = await this.invokeGemini(systemPrompt, retryMessage);
            } else if (this.claudeClient) {
              retryContent = await this.invokeClaude(systemPrompt, retryMessage);
            } else {
              const response: any = await (this.llm as any).invoke([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: retryMessage },
              ]);
              retryContent = response.content as string;
            }
            const retryWords = wordCount(retryContent);
            console.log(`\x1b[32m[AI ENGINE]\x1b[0m Reintento para "${sectionName}": ${retryWords} palabras`);
            if (retryWords > actualWords) {
              rawContent = retryContent;
            }
          } catch (retryError: any) {
            console.warn(`\x1b[33m[AI ENGINE]\x1b[0m Reintento falló para "${sectionName}": ${retryError.message}. Usando contenido original.`);
          }
        }
      } else {
        console.log(`\x1b[32m[AI ENGINE]\x1b[0m Sección formal "${sectionName}" — se omite validación de extensión.`);
      }

      let content = rawContent.trim();
      if (content.startsWith('```markdown')) content = content.replace(/^```markdown\n?/, '').replace(/\n?```$/, '');
      else if (content.startsWith('```')) content = content.replace(/^```\n?/, '').replace(/\n?```$/, '');

      let sectionContent = content;

      // Detect references section at the end of this specific section output
      const refHeaderRegex = /(?:###?\s*(?:Referencias de esta Sección|Referencias|Bibliografía)[\s\S]*?)([\s\S]*)$/i;
      const matchRefs = content.match(refHeaderRegex);
      if (matchRefs) {
        const refsText = matchRefs[1].trim();
        const refsLines = refsText
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 5 && (line.startsWith('-') || line.startsWith('*') || /^\d+\./.test(line) || line.length > 20));

        allReferences.push(...refsLines);
        // Remove references block from the main section content
        sectionContent = content.replace(refHeaderRegex, '').trim();
      }

      if (fullMarkdown.length > 0) {
        fullMarkdown += `\n\n<!--PAGE_BREAK-->\n\n`;
      }
      fullMarkdown += sectionContent;
      generatedSectionTitles.push(sectionName);
      lastGeneratedSectionText = sectionContent;
    }

    // Clean and deduplicate references
    const cleanReferences = Array.from(new Set(
      allReferences
        .map(ref => ref.replace(/^[-*\s\d\.]+\s*/, '').trim())
        .filter(ref => ref.length > 10)
    )).sort();

    // Generate consolidated bibliography
    const selectedReferencesSec = orderedSectionNames.find(name => isReferencesSection(name));

    if (selectedReferencesSec) {
      const refSecConfig = schemaSections.find(s => isReferencesSection(s.name));
      const refValidationRules = refSecConfig?.validationRules || [];

      const refSystemPrompt = `Eres un bibliotecario académico experto en gestión de referencias bibliográficas y normativas ${citationStyle || 'APA'}. Tu única tarea es generar la sección de REFERENCIAS BIBLIOGRÁFICAS de una tesis de posgrado.

Debes seguir ESTRICTAMENTE todas las siguientes reglas del documento patrón:
${refValidationRules.length > 0 ? refValidationRules.map((r: string, i: number) => `${i + 1}. ${r}`).join('\n') : 'Sin reglas específicas del patrón.'}

Reglas adicionales:
- Formato: ${citationStyle || 'APA 7ma edición'}
- Orden alfabético por apellido del primer autor.
- Cada referencia debe incluir DOI en formato enlace markdown (https://doi.org/...).
- NO incluir párrafos narrativos, solo la lista de referencias.
- NO incluir títulos de sección adicionales.
- NO repetir referencias.
- Las referencias deben ser REALES y verificables académicamente.`;

      const refUserMessage = `Tema de la tesis: ${request.topic}

Reglas del documento patrón a cumplir:
${refValidationRules.length > 0 ? refValidationRules.map((r: string, i: number) => `${i + 1}. ${r}`).join('\n') : 'Cumplir con el formato ' + (citationStyle || 'APA 7ma edición') + ' y generar al menos 30 referencias.'}

Referencias ya citadas en los capítulos de la tesis (NO repetir, pero SÍ incluirlas formateadas correctamente en la lista):
${cleanReferences.length > 0 ? cleanReferences.map((r, i) => `${i + 1}. ${r}`).join('\n') : 'No hay referencias previas acumuladas.'}

Genera ÚNICAMENTE la lista completa de referencias bibliográficas en formato ${citationStyle || 'APA'}, orden alfabético. Si las referencias listadas arriba no alcanzan el mínimo requerido por el patrón (mínimo 30 si no se especifica otro número), agrega referencias adicionales REALES hasta cumplir exactamente con todos los requisitos del documento patrón.`;

      try {
        let refContent: string;
        if (this.geminiClient) {
          refContent = await this.invokeGemini(refSystemPrompt, refUserMessage);
        } else if (this.claudeClient) {
          refContent = await this.invokeClaude(refSystemPrompt, refUserMessage);
        } else {
          const response: any = await (this.llm as any).invoke([
            { role: 'system', content: refSystemPrompt },
            { role: 'user', content: refUserMessage },
          ]);
          refContent = response.content as string;
        }
        if (refContent.startsWith('```markdown')) refContent = refContent.replace(/^```markdown\n?/, '').replace(/\n?```$/, '');
        else if (refContent.startsWith('```')) refContent = refContent.replace(/^```\n?/, '').replace(/\n?```$/, '');

        fullMarkdown += `\n\n<!--PAGE_BREAK-->\n\n# ${selectedReferencesSec}\n\n${refContent.trim()}\n`;
        console.log(`\x1b[32m[AI ENGINE - REFERENCES]\x1b[0m Sección de referencias generada con AI siguiendo las reglas del patrón.`);
      } catch (err: any) {
        console.error(`\x1b[31m[AI ENGINE - REFERENCES]\x1b[0m Falló generación AI de referencias: ${err.message}. Usando acumuladas.`);
        if (cleanReferences.length > 0) {
          const formattedRefs = cleanReferences.map(ref => `- ${ref}`).join('\n');
          fullMarkdown += `\n\n<!--PAGE_BREAK-->\n\n# ${selectedReferencesSec}\n\n${formattedRefs}\n`;
        }
      }
    } else if (cleanReferences.length > 0) {
      const formattedRefs = cleanReferences.map(ref => `- ${ref}`).join('\n');
      fullMarkdown += `\n\n# Referencias\n\n${formattedRefs}\n`;
    }

    return { content: fullMarkdown.trim(), sections: orderedSectionNames };
  }

  private async fetchRealPapersFromCrossRef(queryText: string): Promise<any[]> {
    try {
      console.log(`\x1b[34m[CROSSREF - SEARCH]\x1b[0m Buscando referencias reales en CrossRef para: \x1b[36m${queryText}\x1b[0m`);
      const res = await fetch(
        `https://api.crossref.org/works?query=${encodeURIComponent(queryText)}&rows=5`,
        { headers: { 'User-Agent': 'KIMY-ThesisReview/1.0 (mailto:admin@kimy.edu)' } }
      );
      if (!res.ok) {
        console.warn(`[CROSSREF - SEARCH] Falló consulta. Código HTTP: ${res.status}`);
        return [];
      }
      const data = await res.json();
      const items = data.message?.items || [];

      const papers = items.map((item: any) => {
        const authors = (item.author || [])
          .map((a: any) => `${a.family || ''}, ${a.given ? a.given[0] + '.' : ''}`)
          .filter(Boolean)
          .join(', ');

        const year = item.published?.['date-parts']?.[0]?.[0] ||
          item['published-print']?.['date-parts']?.[0]?.[0] ||
          item['published-online']?.['date-parts']?.[0]?.[0] ||
          new Date().getFullYear();

        const title = item.title?.[0] || 'Sin título';
        const container = item['container-title']?.[0] || item.publisher || '';
        const doi = item.DOI || '';
        const doiUrl = doi ? `https://doi.org/${doi}` : '';

        const formatted = `${authors || 'Autor Anónimo'} (${year}). *${title}*.${container ? ' ' + container + '.' : ''}${doiUrl ? ' [' + doiUrl + '](' + doiUrl + ')' : ''}`;

        return {
          authors: authors || 'Autor Anónimo',
          year,
          title,
          container,
          doi,
          doiUrl,
          formatted
        };
      });
      console.log(`\x1b[32m[CROSSREF - SEARCH]\x1b[0m Encontradas \x1b[36m${papers.length}\x1b[0m fuentes reales.`);
      return papers;
    } catch (err) {
      console.error('Error fetching real papers from CrossRef:', err);
      return [];
    }
  }

  private parseRobustJson(text: string): any {
    const cleanText = text.trim();

    // Helper: attempt parse, return [result or null, error or null]
    const attemptParse = (s: string): any => {
      try { return JSON.parse(s); } catch { return null; }
    };

    // 1. Try simple parse first
    let parsed = attemptParse(cleanText);
    if (parsed) return parsed;

    // 2. Extract markdown JSON block if present
    const markdownJsonRegex = /```json\s*([\s\S]*?)\s*```/;
    const matchMarkdown = cleanText.match(markdownJsonRegex);
    if (matchMarkdown && matchMarkdown[1]) {
      parsed = attemptParse(matchMarkdown[1].trim());
      if (parsed) return parsed;
    }

    // 3. Fallback: find first '{' or '[' and last '}' or ']'
    const firstBrace = cleanText.indexOf('{');
    const lastBrace = cleanText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      parsed = attemptParse(cleanText.substring(firstBrace, lastBrace + 1));
      if (parsed) return parsed;
    }

    const firstBracket = cleanText.indexOf('[');
    const lastBracket = cleanText.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      parsed = attemptParse(cleanText.substring(firstBracket, lastBracket + 1));
      if (parsed) return parsed;
    }

    // 4. Automatic JSON repair:
    //    Truncated/malformed JSON from LLMs often has:
    //    - Unterminated strings (missing closing quote)
    //    - Trailing commas
    //    - Missing closing braces/brackets
    //    - Single quotes instead of double quotes
    const tryRepair = (s: string): string | null => {
      let repaired = s;

      // 4a. Extract only the JSON-like portion (first { to last }, or first [ to last ])
      const fb = repaired.indexOf('{');
      const lb = repaired.lastIndexOf('}');
      if (fb !== -1 && lb !== -1 && lb > fb) {
        repaired = repaired.substring(fb, lb + 1);
      } else {
        const fbr = repaired.indexOf('[');
        const lbr = repaired.lastIndexOf(']');
        if (fbr !== -1 && lbr !== -1 && lbr > fbr) {
          repaired = repaired.substring(fbr, lbr + 1);
        } else {
          return null;
        }
      }

      // 4b. Replace single quotes with double quotes (but not within already double-quoted strings)
      repaired = repaired.replace(/(?<!\\)'/g, '"');

      // 4c. Remove trailing commas before closing braces/brackets
      repaired = repaired.replace(/,\s*}/g, '}');
      repaired = repaired.replace(/,\s*\]/g, ']');

      // 4d. Try to close unclosed strings at the end:
      //     If a string value is truncated (e.g. "hello worl), close it
      repaired = repaired.replace(/(?<=[^\\])"(?![,\}\]\s:])/g, '",');

      // 4e. Add missing closing braces if unmatched
      let openBraces = (repaired.match(/\{/g) || []).length;
      let closeBraces = (repaired.match(/\}/g) || []).length;
      while (closeBraces < openBraces) {
        repaired += '}';
        closeBraces++;
      }
      let openBrackets = (repaired.match(/\[/g) || []).length;
      let closeBrackets = (repaired.match(/\]/g) || []).length;
      while (closeBrackets < openBrackets) {
        repaired += ']';
        closeBrackets++;
      }

      // 4f. Clean any remaining unquoted property names (add quotes)
      repaired = repaired.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');

      // 4g. Final attempt
      return repaired;
    };

    const repairedJson = tryRepair(cleanText);
    if (repairedJson) {
      parsed = attemptParse(repairedJson);
      if (parsed) return parsed;
    }

    // If everything fails, try standard parse or return a safe empty object fallback to avoid throwing stack traces
    try {
      return JSON.parse(cleanText);
    } catch (err: any) {
      console.warn(`\x1b[33m[AI ENGINE - JSON PARSE]\x1b[0m No se pudo parsear o reparar el JSON de la respuesta. Usando fallback vacío. (Mensaje: ${err.message})`);
      return {};
    }
  }
}
