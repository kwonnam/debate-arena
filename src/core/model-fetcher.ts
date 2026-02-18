import OpenAI from 'openai';

export interface ModelChoice {
  readonly value: string;
  readonly name: string;
}

export interface ModelFetchResult {
  readonly models: readonly ModelChoice[];
  readonly source: 'api' | 'cached' | 'fallback';
}

interface CacheEntry {
  readonly models: readonly ModelChoice[];
  readonly fetchedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5_000;

const FALLBACK_CODEX_MODELS: readonly ModelChoice[] = [
  { value: 'o3', name: 'o3' },
  { value: 'o4-mini', name: 'o4-mini' },
  { value: 'gpt-4.1', name: 'gpt-4.1' },
  { value: 'gpt-4.1-mini', name: 'gpt-4.1-mini' },
  { value: 'gpt-4.1-nano', name: 'gpt-4.1-nano' },
];

const FALLBACK_CLAUDE_MODELS: readonly ModelChoice[] = [
  { value: 'claude-opus-4-6', name: 'claude-opus-4-6' },
  { value: 'claude-sonnet-4-5-20250929', name: 'claude-sonnet-4-5-20250929' },
  { value: 'claude-haiku-4-5-20251001', name: 'claude-haiku-4-5-20251001' },
];

const CODEX_CHAT_PREFIXES = ['gpt-', 'o1', 'o3', 'o4', 'chatgpt'];

let codexCache: CacheEntry | null = null;
let claudeCache: CacheEntry | null = null;

function isCacheValid(entry: CacheEntry | null): entry is CacheEntry {
  return entry !== null && Date.now() - entry.fetchedAt < CACHE_TTL_MS;
}

function isChatModel(id: string): boolean {
  return CODEX_CHAT_PREFIXES.some((prefix) => id.startsWith(prefix));
}

export async function fetchCodexModels(): Promise<ModelFetchResult> {
  if (isCacheValid(codexCache)) {
    return { models: codexCache.models, source: 'cached' };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { models: FALLBACK_CODEX_MODELS, source: 'fallback' };
  }

  try {
    const client = new OpenAI({ apiKey, timeout: FETCH_TIMEOUT_MS });
    const response = await client.models.list();

    const models: ModelChoice[] = [];
    for await (const model of response) {
      if (isChatModel(model.id)) {
        models.push({ value: model.id, name: model.id });
      }
    }

    models.sort((a, b) => a.name.localeCompare(b.name));

    if (models.length === 0) {
      return { models: FALLBACK_CODEX_MODELS, source: 'fallback' };
    }

    codexCache = { models, fetchedAt: Date.now() };
    return { models, source: 'api' };
  } catch {
    return { models: FALLBACK_CODEX_MODELS, source: 'fallback' };
  }
}

interface AnthropicModelResponse {
  readonly data: readonly { readonly id: string; readonly display_name: string }[];
}

export async function fetchClaudeModels(): Promise<ModelFetchResult> {
  if (isCacheValid(claudeCache)) {
    return { models: claudeCache.models, source: 'cached' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { models: FALLBACK_CLAUDE_MODELS, source: 'fallback' };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      return { models: FALLBACK_CLAUDE_MODELS, source: 'fallback' };
    }

    const body = (await response.json()) as AnthropicModelResponse;

    if (!body.data || body.data.length === 0) {
      return { models: FALLBACK_CLAUDE_MODELS, source: 'fallback' };
    }

    const models: ModelChoice[] = body.data.map((m) => ({
      value: m.id,
      name: m.display_name || m.id,
    }));

    models.sort((a, b) => a.name.localeCompare(b.name));

    claudeCache = { models, fetchedAt: Date.now() };
    return { models, source: 'api' };
  } catch {
    return { models: FALLBACK_CLAUDE_MODELS, source: 'fallback' };
  }
}

export function clearModelCache(): void {
  codexCache = null;
  claudeCache = null;
}
