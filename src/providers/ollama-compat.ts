import type { OllamaToolConfig } from '../config/defaults.js';
import { ProviderTimeoutError } from './errors.js';
import { BaseHttpProvider } from './base-http-provider.js';
import type { ModelInfo, ProviderCapabilities } from './base-http-provider.js';
import type { Message, MessageAttachment } from './types.js';

const TEXT_ATTACHMENT_LIMIT = 12_000;
const TOOL_CONTENT_LIMIT = 12_000;
const DEFAULT_OLLAMA_TOOL_API_BASE_URL = 'https://ollama.com/api';
const DEFAULT_OLLAMA_TOOL_API_KEY_ENV_VAR = 'OLLAMA_API_KEY';
const DEFAULT_OLLAMA_TOOL_MAX_ITERATIONS = 6;
const DEFAULT_WEB_SEARCH_RESULTS = 5;

type OpenAIFunctionTool = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
};

type OpenAIFunctionToolCall = {
  id?: string;
  type?: string;
  function?: {
    name?: string;
    arguments?: string | Record<string, unknown>;
  };
};

type OpenAIContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

type OpenAICompatMessage =
  | {
    role: 'system' | 'user' | 'assistant';
    content: string | OpenAIContentPart[];
    tool_calls?: OpenAIFunctionToolCall[];
  }
  | {
    role: 'tool';
    content: string;
    tool_name?: string;
    tool_call_id?: string;
    name?: string;
  };

interface ChatCompletionMessage {
  content?: string | OpenAIContentPart[] | null;
  tool_calls?: OpenAIFunctionToolCall[];
}

interface ChatCompletionResponse {
  choices: Array<{ message?: ChatCompletionMessage }>;
}

interface WebSearchApiResponse {
  results?: Array<Record<string, unknown>>;
}

interface WebFetchApiResponse extends Record<string, unknown> {
  url?: string;
  title?: string;
  markdown?: string;
  content?: string;
  text?: string;
  excerpt?: string;
  description?: string;
}

interface NormalizedOllamaToolOptions {
  enabled: boolean;
  webSearch: boolean;
  webFetch: boolean;
  maxIterations: number;
  apiBaseUrl: string;
  apiKeyEnvVar: string;
}

function trimTrailingSlash(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

function normalizeOllamaToolOptions(input?: OllamaToolConfig): NormalizedOllamaToolOptions {
  const webSearch = Boolean(input?.webSearch);
  const webFetch = input?.webFetch ?? webSearch;

  return {
    enabled: webSearch || Boolean(webFetch),
    webSearch,
    webFetch: Boolean(webFetch),
    maxIterations: clampInteger(input?.maxIterations, DEFAULT_OLLAMA_TOOL_MAX_ITERATIONS, 1, 12),
    apiBaseUrl: trimTrailingSlash(input?.apiBaseUrl || DEFAULT_OLLAMA_TOOL_API_BASE_URL),
    apiKeyEnvVar: input?.apiKeyEnvVar?.trim() || DEFAULT_OLLAMA_TOOL_API_KEY_ENV_VAR,
  };
}

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

function toOpenAICompatMessages(messages: Message[]): OpenAICompatMessage[] {
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

function normalizeAssistantContent(content: ChatCompletionMessage['content']): string {
  if (typeof content === 'string') {
    return content;
  }
  if (!Array.isArray(content)) {
    return '';
  }
  return content
    .filter((part): part is Extract<OpenAIContentPart, { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('\n');
}

function normalizeToolCalls(toolCalls: unknown): OpenAIFunctionToolCall[] {
  if (!Array.isArray(toolCalls)) {
    return [];
  }

  return toolCalls
    .filter((toolCall): toolCall is OpenAIFunctionToolCall => Boolean(toolCall && typeof toolCall === 'object'))
    .map((toolCall) => ({
      id: typeof toolCall.id === 'string' ? toolCall.id : undefined,
      type: typeof toolCall.type === 'string' ? toolCall.type : 'function',
      function: toolCall.function && typeof toolCall.function === 'object'
        ? {
          name: typeof toolCall.function.name === 'string' ? toolCall.function.name : undefined,
          arguments: typeof toolCall.function.arguments === 'string' || (
            toolCall.function.arguments
            && typeof toolCall.function.arguments === 'object'
            && !Array.isArray(toolCall.function.arguments)
          )
            ? toolCall.function.arguments
            : undefined,
        }
        : undefined,
    }))
    .filter((toolCall) => Boolean(toolCall.function?.name));
}

function parseToolArguments(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw !== 'string' || !raw.trim()) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 1)}…`;
}

function normalizeToolPayload(value: unknown): string {
  const serialized = JSON.stringify(value);
  if (!serialized) {
    return '{"ok":false,"error":"Empty tool payload"}';
  }
  return truncateText(serialized, TOOL_CONTENT_LIMIT);
}

export class OllamaCompatProvider extends BaseHttpProvider {
  readonly name: string;
  private readonly model: string;
  private readonly toolOptions: NormalizedOllamaToolOptions;

  constructor(
    name: string,
    baseUrl: string,
    apiKey: string = '',
    timeout?: number,
    capabilities?: ProviderCapabilities,
    model: string = '',
    toolOptions?: OllamaToolConfig,
  ) {
    super(baseUrl, apiKey, timeout, capabilities);
    this.name = name;
    this.model = model;
    this.toolOptions = normalizeOllamaToolOptions(toolOptions);
  }

  async generate(messages: Message[]): Promise<string> {
    const { controller, didTimeout, cleanup } = createRequestController(this.timeout);

    try {
      return await this.completeWithTools(toOpenAICompatMessages(messages), controller.signal);
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
    if (this.hasCallableTools()) {
      const { controller, didTimeout, cleanup } = createRequestController(this.timeout, signal);

      try {
        const content = await this.completeWithTools(toOpenAICompatMessages(messages), controller.signal);
        if (content) {
          yield content;
        }
        return;
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

  private hasCallableTools(): boolean {
    return this.getAvailableTools().length > 0;
  }

  private getAvailableTools(): OpenAIFunctionTool[] {
    if (!this.toolOptions.enabled || !this.resolveToolApiKey()) {
      return [];
    }

    const tools: OpenAIFunctionTool[] = [];

    if (this.toolOptions.webSearch) {
      tools.push({
        type: 'function',
        function: {
          name: 'web_search',
          description: 'Search the public web for recent or external information before answering.',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'The search query to run.',
              },
              max_results: {
                type: 'integer',
                description: 'Maximum number of results to return (1-10).',
              },
            },
            required: ['query'],
          },
        },
      });
    }

    if (this.toolOptions.webFetch) {
      tools.push({
        type: 'function',
        function: {
          name: 'web_fetch',
          description: 'Fetch and extract a specific web page by URL.',
          parameters: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The absolute http or https URL to fetch.',
              },
            },
            required: ['url'],
          },
        },
      });
    }

    return tools;
  }

  private resolveToolApiKey(): string {
    if (this.apiKey?.trim()) {
      return this.apiKey.trim();
    }
    const envName = this.toolOptions.apiKeyEnvVar.trim();
    return process.env[envName]?.trim() || '';
  }

  private async completeWithTools(
    messages: OpenAICompatMessage[],
    signal: AbortSignal,
  ): Promise<string> {
    const tools = this.getAvailableTools();
    if (tools.length === 0) {
      const response = await this.requestChatCompletion(messages, signal);
      return response.content;
    }

    const conversation: OpenAICompatMessage[] = [...messages];

    for (let iteration = 0; iteration < this.toolOptions.maxIterations; iteration++) {
      const assistantMessage = await this.requestChatCompletion(conversation, signal, tools);

      conversation.push({
        role: 'assistant',
        content: assistantMessage.content,
        ...(assistantMessage.toolCalls.length > 0 ? { tool_calls: assistantMessage.toolCalls } : {}),
      });

      if (assistantMessage.toolCalls.length === 0) {
        return assistantMessage.content;
      }

      const toolMessages = await Promise.all(
        assistantMessage.toolCalls.map((toolCall) => this.executeToolCall(toolCall, signal)),
      );
      conversation.push(...toolMessages);
    }

    throw new Error(`Ollama tool loop exceeded ${this.toolOptions.maxIterations} iterations`);
  }

  private async requestChatCompletion(
    messages: OpenAICompatMessage[],
    signal: AbortSignal,
    tools?: OpenAIFunctionTool[],
  ): Promise<{ content: string; toolCalls: OpenAIFunctionToolCall[] }> {
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({
        model: this.model || undefined,
        messages,
        stream: false,
        ...(tools && tools.length > 0 ? { tools, tool_choice: 'auto' } : {}),
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const json = (await response.json()) as ChatCompletionResponse;
    const message = json.choices[0]?.message;
    return {
      content: normalizeAssistantContent(message?.content),
      toolCalls: normalizeToolCalls(message?.tool_calls),
    };
  }

  private async executeToolCall(
    toolCall: OpenAIFunctionToolCall,
    signal: AbortSignal,
  ): Promise<Extract<OpenAICompatMessage, { role: 'tool' }>> {
    const toolName = toolCall.function?.name?.trim() || 'unknown_tool';

    try {
      let payload: unknown;
      if (toolName === 'web_search') {
        payload = await this.callWebSearch(toolCall, signal);
      } else if (toolName === 'web_fetch') {
        payload = await this.callWebFetch(toolCall, signal);
      } else {
        payload = { ok: false, error: `Unsupported tool '${toolName}'` };
      }

      return {
        role: 'tool',
        content: normalizeToolPayload(payload),
        tool_name: toolName,
        tool_call_id: toolCall.id,
        name: toolName,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        role: 'tool',
        content: normalizeToolPayload({ ok: false, error: message }),
        tool_name: toolName,
        tool_call_id: toolCall.id,
        name: toolName,
      };
    }
  }

  private async callWebSearch(
    toolCall: OpenAIFunctionToolCall,
    signal: AbortSignal,
  ): Promise<Record<string, unknown>> {
    const args = parseToolArguments(toolCall.function?.arguments);
    const query = String(args.query ?? '').trim();
    if (!query) {
      return { ok: false, error: 'web_search requires a non-empty query' };
    }

    const maxResults = clampInteger(args.max_results ?? args.maxResults, DEFAULT_WEB_SEARCH_RESULTS, 1, 10);
    const response = await fetch(`${this.toolOptions.apiBaseUrl}/web_search`, {
      method: 'POST',
      headers: this.buildToolHeaders(),
      body: JSON.stringify({
        query,
        max_results: maxResults,
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`web_search failed with HTTP ${response.status}`);
    }

    const json = (await response.json()) as WebSearchApiResponse;
    const results = Array.isArray(json.results) ? json.results : [];

    return {
      ok: true,
      query,
      results: results.slice(0, maxResults).map((item) => ({
        title: String(item.title ?? ''),
        url: String(item.url ?? ''),
        source: typeof item.source === 'string' ? item.source : undefined,
        publishedAt: typeof item.published_at === 'string'
          ? item.published_at
          : typeof item.publishedAt === 'string'
            ? item.publishedAt
            : undefined,
        content: truncateText(
          String(item.content ?? item.description ?? item.snippet ?? ''),
          1_500,
        ),
      })),
    };
  }

  private async callWebFetch(
    toolCall: OpenAIFunctionToolCall,
    signal: AbortSignal,
  ): Promise<Record<string, unknown>> {
    const args = parseToolArguments(toolCall.function?.arguments);
    const url = String(args.url ?? '').trim();
    if (!/^https?:\/\//i.test(url)) {
      return { ok: false, error: 'web_fetch requires an absolute http(s) URL' };
    }

    const response = await fetch(`${this.toolOptions.apiBaseUrl}/web_fetch`, {
      method: 'POST',
      headers: this.buildToolHeaders(),
      body: JSON.stringify({ url }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`web_fetch failed with HTTP ${response.status}`);
    }

    const json = (await response.json()) as WebFetchApiResponse;
    const content = String(
      json.markdown
      ?? json.content
      ?? json.text
      ?? json.excerpt
      ?? json.description
      ?? '',
    );

    return {
      ok: true,
      url: String(json.url ?? url),
      title: typeof json.title === 'string' ? json.title : undefined,
      content: truncateText(content, 8_000),
    };
  }

  private buildToolHeaders(): Record<string, string> {
    const apiKey = this.resolveToolApiKey();
    if (!apiKey) {
      throw new Error(`Missing ${this.toolOptions.apiKeyEnvVar} for Ollama web tools`);
    }

    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    };
  }
}
