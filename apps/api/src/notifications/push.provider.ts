import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string;
}

interface ExpoPushReceipt {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

@Injectable()
export class PushProvider {
  private readonly logger = new Logger(PushProvider.name);

  /**
   * Envía notificaciones push a uno o más tokens de Expo.
   * Respeta el límite de 100 mensajes por request de Expo Push API.
   */
  async sendBatch(
    tokens: string[],
    payload: { title: string; body: string; data?: Record<string, unknown> },
  ): Promise<void> {
    if (!tokens.length) return;

    // Filtrar tokens válidos (formato ExpoPushToken o expoToken)
    const validTokens = tokens.filter(
      (t) => t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken['),
    );

    if (!validTokens.length) {
      this.logger.warn('No valid Expo push tokens found in batch');
      return;
    }

    // Dividir en batches de máx 100
    const BATCH_SIZE = 100;
    for (let i = 0; i < validTokens.length; i += BATCH_SIZE) {
      const batch = validTokens.slice(i, i + BATCH_SIZE);
      const messages: PushMessage[] = batch.map((to) => ({
        to,
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
        sound: 'default',
        channelId: 'default',
      }));

      try {
        const response = await axios.post<{ data: ExpoPushReceipt[] }>(
          EXPO_PUSH_URL,
          messages,
          {
            headers: {
              Accept: 'application/json',
              'Accept-Encoding': 'gzip, deflate',
              'Content-Type': 'application/json',
            },
            timeout: 10_000,
          },
        );

        const receipts = response.data?.data ?? [];
        const errors = receipts.filter((r) => r.status === 'error');

        if (errors.length) {
          this.logger.warn(
            `${errors.length} push errors: ${errors.map((e) => e.message).join(', ')}`,
          );
        }

        this.logger.log(
          `Push batch sent: ${batch.length} tokens, ${receipts.filter((r) => r.status === 'ok').length} ok`,
        );
      } catch (error: any) {
        this.logger.error(`Expo Push API error: ${error?.message}`);
      }
    }
  }
}
