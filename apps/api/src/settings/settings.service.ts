import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getSettings() {
    let settings = await this.prisma.systemSettings.findFirst();
    if (!settings) {
      settings = await this.prisma.systemSettings.create({
        data: {
          id: 'default',
          institutionName: 'Universidad Nacional de Trujillo',
          maxGrade: 20,
          aiModel: 'gpt-4o',
          aiProvider: 'openai',
          approvalThreshold: 60,
          rigorLevel: 'Alto',
        },
      });
    }
    return settings;
  }

  async updateSettings(data: {
    institutionName?: string;
    maxGrade?: number;
    aiModel?: string;
    aiProvider?: string;
    approvalThreshold?: number;
    rigorLevel?: string;
  }) {
    if (data.aiProvider) {
      const available = this.getAvailableProviders();
      if (!available[data.aiProvider]) {
        throw new Error(`El proveedor '${data.aiProvider}' no tiene una API key configurada en .env. Agrega ${data.aiProvider.toUpperCase()}_API_KEY para activarlo.`);
      }
    }
    const settings = await this.getSettings();
    return this.prisma.systemSettings.update({
      where: { id: settings.id },
      data: {
        ...(data.institutionName && { institutionName: data.institutionName }),
        ...(data.maxGrade !== undefined && { maxGrade: data.maxGrade }),
        ...(data.aiModel && { aiModel: data.aiModel }),
        ...(data.aiProvider && { aiProvider: data.aiProvider }),
        ...(data.approvalThreshold !== undefined && { approvalThreshold: data.approvalThreshold }),
        ...(data.rigorLevel && { rigorLevel: data.rigorLevel }),
      },
    });
  }
  getAvailableProviders(): Record<string, boolean> {
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
}
