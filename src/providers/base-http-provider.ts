import type { AIProvider, Message } from './types.js';

export interface ProviderCapabilities {
  supportsStreaming: boolean;
  supportsVision: boolean;
  maxContextTokens: number;
  supportedFormats: string[];
}

export interface ModelInfo {
  id: string;
  name: string;
  contextLength?: number;
}

export abstract class BaseHttpProvider implements AIProvider {
  abstract readonly name: string;

  protected constructor(
    protected readonly baseUrl: string,
    protected readonly apiKey: string,
    protected readonly timeout: number = 60_000,
    protected readonly capabilities: ProviderCapabilities = {
      supportsStreaming: true,
      supportsVision: false,
      maxContextTokens: 128_000,
      supportedFormats: ['text'],
    }
  ) {}

  abstract generate(messages: Message[]): Promise<string>;
  abstract stream(messages: Message[], signal?: AbortSignal, cwd?: string): AsyncIterable<string>;
  abstract listModels(): Promise<ModelInfo[]>;
  abstract validateApiKey(): Promise<boolean>;

  protected buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  protected handleError(err: unknown): never {
    if (err instanceof Error) {
      const masked = err.message.replace(this.apiKey, '***');
      throw new Error(masked);
    }
    throw new Error('Unknown provider error');
  }
}
