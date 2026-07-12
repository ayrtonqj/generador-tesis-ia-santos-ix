import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TranslateService {
  private readonly logger = new Logger(TranslateService.name);

  constructor(private prisma: PrismaService) {}

  private async getActiveConfig(): Promise<{ model: string; provider: string }> {
    const settings = await this.prisma.systemSettings.findUnique({
      where: { id: 'default' },
    });
    return {
      model: settings?.aiModel || process.env.AI_MODEL || 'llama-3.3-70b-versatile',
      provider: settings?.aiProvider || process.env.AI_PROVIDER || 'groq',
    };
  }

  async translate(text: string, source: string, target: string): Promise<string> {
    if (source === target || !text) return text;

    this.logger.log(`Traduciendo texto de ${source} a ${target} con IA...`);
    
    const config = await this.getActiveConfig();
    const isGemini = config.provider === 'gemini' || process.env.GEMINI_API_KEY;
    const hasGroq = !!process.env.GROQ_API_KEY;

    let translated = '';
    const systemPrompt = `Eres un traductor experto académico. Traduce el siguiente texto académico de ${source} a ${target}. 
Responde ÚNICAMENTE con el texto traducido. Mantén el formato markdown, no añadas explicaciones ni introducciones.`;

    try {
      if (isGemini && process.env.GEMINI_API_KEY) {
        this.logger.log(`Usando Gemini para traducción (${config.model})`);
        const geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = geminiClient.getGenerativeModel({ model: config.model || 'gemini-3.1-flash-lite' });
        const result = await model.generateContent([
          { text: systemPrompt },
          { text: text }
        ]);
        translated = result.response.text();
      } else if (hasGroq) {
        this.logger.log(`Usando Groq para traducción (llama-3.3-70b-versatile)`);
        const llm = new ChatOpenAI({
          apiKey: process.env.GROQ_API_KEY,
          model: 'llama-3.3-70b-versatile',
          temperature: 0.1,
          maxTokens: 5000,
          configuration: { baseURL: 'https://api.groq.com/openai/v1' },
        });
        const res = await llm.invoke([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ]);
        translated = res.content as string;
      } else if (process.env.OPENAI_API_KEY) {
         this.logger.log(`Usando OpenAI para traducción (gpt-4o-mini)`);
         const llm = new ChatOpenAI({
          apiKey: process.env.OPENAI_API_KEY,
          model: 'gpt-4o-mini',
          temperature: 0.1,
        });
        const res = await llm.invoke([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ]);
        translated = res.content as string;
      } else {
        throw new InternalServerErrorException('No hay API keys de IA configuradas para traducción (Gemini, Groq, u OpenAI).');
      }

      let content = translated.trim();
      if (content.startsWith('\`\`\`markdown')) content = content.replace(/^\`\`\`markdown\n?/, '').replace(/\n?\`\`\`$/, '');
      else if (content.startsWith('\`\`\`')) content = content.replace(/^\`\`\`\n?/, '').replace(/\n?\`\`\`$/, '');

      return content;
    } catch (error: any) {
      this.logger.error(`Error en traducción IA: ${error.message}`);
      throw new InternalServerErrorException(`Fallo en la traducción IA: ${error.message}`);
    }
  }
}
