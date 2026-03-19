import type { TelegramMessage, TelegramUpdate } from './types.js';
import type { TelegramBotSettings } from './settings.js';

interface TelegramApiEnvelope<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

export class TelegramApiClient {
  private readonly baseUrl: string;

  constructor(private readonly settings: TelegramBotSettings) {
    this.baseUrl = `${this.settings.apiBaseUrl.replace(/\/+$/, '')}/bot${this.settings.botToken}`;
  }

  async sendMessage(chatId: number, text: string): Promise<TelegramMessage> {
    return this.request<TelegramMessage>('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });
  }

  async editMessageText(chatId: number, messageId: number, text: string): Promise<TelegramMessage | null> {
    try {
      return await this.request<TelegramMessage>('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes('message is not modified')) {
        return null;
      }
      throw error;
    }
  }

  async getUpdates(options: {
    offset?: number;
    timeout?: number;
    allowedUpdates?: string[];
  } = {}): Promise<TelegramUpdate[]> {
    const timeout = Math.max(1, Math.trunc(options.timeout ?? 30));
    return this.request<TelegramUpdate[]>(
      'getUpdates',
      {
        timeout,
        offset: options.offset,
        allowed_updates: options.allowedUpdates,
      },
      (timeout + 10) * 1000,
    );
  }

  private async request<T>(
    method: string,
    payload: Record<string, unknown>,
    timeoutMs = 30_000,
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort('timeout');
    }, timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/${method}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Telegram API HTTP ${response.status} for ${method}`);
      }

      const data = await response.json() as TelegramApiEnvelope<T>;
      if (!data.ok || data.result === undefined) {
        throw new Error(data.description || `Telegram API call failed for ${method}`);
      }

      return data.result;
    } finally {
      clearTimeout(timer);
    }
  }
}
