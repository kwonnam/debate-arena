import { BaseHttpProvider } from './base-http-provider.js';
import type { ModelInfo, ProviderCapabilities } from './base-http-provider.js';
import type { Message, MessageAttachment } from './types.js';
import { ProviderTimeoutError } from './errors.js';

const TEXT_ATTACHMENT_LIMIT = 12_000;

type OpenAIContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

function createRequestController(timeoutMs: number, externalSignal?: AbortSignal): {
  controller: AbortController;
  didTimeout: () => boolean;
  cleanup: () => void;
} {
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort('timeout');
  }, timeoutMs);

  const abortFromExternalSignal = () => {
    controller.abort(externalSignal?.reason);
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      abortFromExternalSignal();
    } else {
      externalSignal.addEventListener('abort', abortFromExternalSignal, { once: true });
    }
  }

  return {
    controller,
    didTimeout: () => timedOut,
    cleanup: () => {
      clearTimeout(timer);
      if (externalSignal) {
        externalSignal.removeEventListener('abort', abortFromExternalSignal);
      }
    },
  };
}

function toOpenAICompatMessages(messages: Message[]): Array<{
  role: Message['role'];
  content: string | OpenAIContentPart[];
}> {
  return messages.map((message) => {
    if (!message.attachments || message.attachments.length === 0) {
      return { role: message.role, content: message.content };
    }

    const contentParts: OpenAIContentPart[] = [];
    if (message.content.trim()) {
      contentParts.push({ type: 'text', text: message.content });
    }

    for (const attachment of message.attachments) {
      const part = attachmentToContentPart(attachment);
      if (part) {
        contentParts.push(part);
      }
    }

    if (contentParts.length === 0) {
      return { role: message.role, content: message.content };
    }

    return { role: message.role, content: contentParts };
  });
}

function attachmentToContentPart(attachment: MessageAttachment): OpenAIContentPart | null {
  if (attachment.kind === 'image') {
    const imageUrl = normalizeImageUrl(attachment);
    if (!imageUrl) return null;
    return {
      type: 'image_url',
      image_url: { url: imageUrl },
    };
  }

  const name = attachment.name ?? 'attachment';
  const mimeType = attachment.mimeType ?? 'text/plain';
  const text = attachment.content.slice(0, TEXT_ATTACHMENT_LIMIT);
  return {
    type: 'text',
    text: `Attachment (${name}, ${mimeType}):\n${text}`,
  };
}

function normalizeImageUrl(attachment: MessageAttachment): string | null {
  const raw = attachment.content.trim();
  if (!raw) return null;

  if (raw.startsWith('data:image/')) {
    return raw;
  }

  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return raw;
  }

  const mimeType = attachment.mimeType?.startsWith('image/')
    ? attachment.mimeType
    : 'image/png';
  return `data:${mimeType};base64,${raw}`;
}

export class OllamaCompatProvider extends BaseHttpProvider {
  readonly name: string;
  private readonly model: string;

  constructor(
    name: string,
    baseUrl: string,
    apiKey: string = '',
    timeout?: number,
    capabilities?: ProviderCapabilities,
    model: string = '',
  ) {
    super(baseUrl, apiKey, timeout, capabilities);
    this.name = name;
    this.model = model;
  }

  async generate(messages: Message[]): Promise<string> {
    const { controller, didTimeout, cleanup } = createRequestController(this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify({
          model: this.model || undefined,
          messages: toOpenAICompatMessages(messages),
          stream: false,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const json = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
      };
      return json.choices[0].message.content;
    } catch (err) {
      if (didTimeout()) {
        throw new ProviderTimeoutError(`Request timed out after ${this.timeout}ms`, this.timeout);
      }
      this.handleError(err);
    } finally {
      cleanup();
    }
  }

  async *stream(messages: Message[], signal?: AbortSignal, _cwd?: string): AsyncIterable<string> {
    const { controller, didTimeout, cleanup } = createRequestController(this.timeout, signal);

    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify({
          model: this.model || undefined,
          messages: toOpenAICompatMessages(messages),
          stream: true,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;

          const data = trimmed.slice('data:'.length).trim();
          if (data === '[DONE]') return;

          try {
            const parsed = JSON.parse(data) as {
              choices: Array<{ delta: { content?: string } }>;
            };
            const content = parsed.choices[0]?.delta?.content;
            if (content) yield content;
          } catch {
            // skip malformed SSE lines
          }
        }
      }
    } catch (err) {
      if (didTimeout()) {
        throw new ProviderTimeoutError(`Request timed out after ${this.timeout}ms`, this.timeout);
      }
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      this.handleError(err);
    } finally {
      cleanup();
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    const { controller, didTimeout, cleanup } = createRequestController(this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/v1/models`, {
        headers: this.buildHeaders(),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const json = (await response.json()) as {
        data: Array<{ id: string; name?: string; context_length?: number }>;
      };

      return json.data.map((m) => ({
        id: m.id,
        name: m.name ?? m.id,
        contextLength: m.context_length,
      }));
    } catch (err) {
      if (didTimeout()) {
        throw new ProviderTimeoutError(`Request timed out after ${this.timeout}ms`, this.timeout);
      }
      this.handleError(err);
    } finally {
      cleanup();
    }
  }

  async validateApiKey(): Promise<boolean> {
    try {
      await this.listModels();
      return true;
    } catch {
      return false;
    }
  }
}
