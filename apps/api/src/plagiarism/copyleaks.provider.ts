import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface CopyleaksResult {
  score: number; // 0-100, porcentaje de similitud
  sources: Array<{
    title: string;
    url: string;
    similarity: number;
    type: 'internet' | 'academic' | 'student';
  }>;
  reportUrl?: string;
}

/**
 * Integración con Copyleaks API para detección de plagio avanzada.
 * Documentación: https://api.copyleaks.com/v3/
 *
 * Flujo:
 * 1. Login → obtener access token
 * 2. Submit document → obtener scan ID
 * 3. Poll status → esperar resultado (webhook en producción)
 * 4. Get report → extraer similitudes
 */
@Injectable()
export class CopyleaksProvider {
  private readonly logger = new Logger(CopyleaksProvider.name);
  private readonly baseUrl = 'https://api.copyleaks.com';
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  private get apiKey(): string | undefined {
    return process.env.COPYLEAKS_ACCESS_TOKEN;
  }

  private get email(): string | undefined {
    return process.env.COPYLEAKS_EMAIL;
  }

  /** Verifica si Copyleaks está configurado */
  isConfigured(): boolean {
    return !!(this.apiKey && this.email);
  }

  /** Obtiene o refresca el access token */
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/v3/account/login/api`,
        {
          email: this.email,
          key: this.apiKey,
        },
        { timeout: 10_000 },
      );

      this.accessToken = response.data.access_token;
      // Token válido por ~24h
      this.tokenExpiry = new Date(Date.now() + 23 * 60 * 60 * 1000);
      return this.accessToken!;
    } catch (error: any) {
      throw new Error(`Copyleaks login failed: ${error?.message}`);
    }
  }

  /**
   * Envía un documento a Copyleaks para análisis de plagio.
   * Retorna el scan ID para polling posterior.
   */
  async submitDocument(
    content: string,
    title: string,
    scanId: string,
  ): Promise<string> {
    const token = await this.getAccessToken();
    const encodedContent = Buffer.from(content).toString('base64');

    await axios.put(
      `${this.baseUrl}/v3/education/submit/file/${scanId}`,
      {
        base64: encodedContent,
        filename: `${title.replace(/\s+/g, '_')}.txt`,
        properties: {
          webhooks: {
            status: `${process.env.API_URL || 'http://localhost:3001'}/api/plagiarism/copyleaks-webhook/{STATUS}/${scanId}`,
          },
          expiration: 1,
          checkDocumentForPlagiarism: true,
          includedDatabases: {
            internet: true,
            internalDatabase: true,
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 15_000,
      },
    );

    this.logger.log(`Copyleaks scan submitted: ${scanId}`);
    return scanId;
  }

  /**
   * Obtiene el resultado de un scan completado.
   */
  async getResults(scanId: string): Promise<CopyleaksResult | null> {
    try {
      const token = await this.getAccessToken();

      const response = await axios.get(
        `${this.baseUrl}/v3/downloads/${scanId}/results`,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10_000,
        },
      );

      const data = response.data;
      const score = data.scannedDocument?.totalWords > 0
        ? Math.round((data.results?.reduce((acc: number, r: any) => acc + (r.matchedWords ?? 0), 0) / data.scannedDocument.totalWords) * 100)
        : 0;

      return {
        score: Math.min(score, 100),
        sources: (data.results ?? []).slice(0, 10).map((r: any) => ({
          title: r.title || 'Fuente desconocida',
          url: r.url || '',
          similarity: Math.round((r.matchedWords / (data.scannedDocument?.totalWords || 1)) * 100),
          type: r.type === 'internet' ? 'internet' : 'academic',
        })),
        reportUrl: `https://app.copyleaks.com/scans/${scanId}`,
      };
    } catch (error: any) {
      this.logger.error(`Failed to get Copyleaks results for ${scanId}: ${error?.message}`);
      return null;
    }
  }
}
