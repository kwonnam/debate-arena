import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { loadConfigV2 } from '../config/manager.js';
import type { SearchLanguageScope } from '../news/search-plan.js';
import { listProviderOptions } from '../providers/factory.js';

type QueryTransformMode = 'off' | 'expand';

const DEFAULT_TELEGRAM_OLLAMA_PROVIDER_IDS = [
  'ollama-cloud-minimax-m2-7',
  'ollama-cloud-qwen3-5-397b',
  'ollama-cloud-glm-5',
  'ollama-cloud-nemotron-3-super',
  'ollama-cloud-kimi-k2-5',
  'ollama-cloud-minimax-m2-5',
] as const;

export interface TelegramBotSettings {
  botToken: string;
  apiBaseUrl: string;
  allowedChatIds?: Set<number>;
  defaultTemplateId: string;
  rounds: number;
  stateFile: string;
  responseLanguage: 'auto' | 'ko' | 'en';
  ollamaProviderIds: string[];
  judgeProviderId: string;
  newsQueryTransformMode: QueryTransformMode;
  newsQueryLanguageScope: SearchLanguageScope;
  newsMaxArticles: number;
  newsMode: 'unified' | 'split';
}

function parseCsv(value: string | undefined): string[] {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function clampInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

function uniqueValues(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const item = value.trim();
    if (!item || seen.has(item)) {
      continue;
    }
    seen.add(item);
    result.push(item);
  }

  return result;
}

function parseAllowedChatIds(value: string | undefined): Set<number> | undefined {
  const ids = parseCsv(value)
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item));

  if (ids.length === 0) {
    return undefined;
  }

  return new Set(ids);
}

function resolveConfiguredOllamaProviderIds(): string[] {
  const config = loadConfigV2();
  return Object.entries(config.providers ?? {})
    .filter(([, provider]) => provider.type === 'ollama-compat')
    .map(([providerId]) => providerId);
}

function resolveAvailableOllamaProviderIds(requestedProviderIds: string[]): string[] {
  const available = new Set(
    listProviderOptions()
      .filter((option) => option.available && option.type === 'ollama-compat')
      .map((option) => option.name),
  );

  if (requestedProviderIds.length > 0) {
    const selected = uniqueValues(requestedProviderIds).filter((providerId) => available.has(providerId));
    if (selected.length === 0) {
      throw new Error(
        `TELEGRAM_OLLAMA_PROVIDER_IDS did not match any available ollama-compat provider. Available: ${[...available].join(', ') || 'none'}`,
      );
    }
    return selected;
  }

  const config = loadConfigV2();
  const preferred: string[] = [];
  const defaultProvider = typeof config.defaultProvider === 'string' ? config.defaultProvider.trim() : '';
  const defaultJudge = typeof config.debate?.defaultJudge === 'string' ? config.debate.defaultJudge.trim() : '';

  for (const providerId of DEFAULT_TELEGRAM_OLLAMA_PROVIDER_IDS) {
    if (available.has(providerId)) {
      preferred.push(providerId);
    }
  }

  if (defaultProvider && available.has(defaultProvider)) {
    preferred.push(defaultProvider);
  }
  if (defaultJudge && available.has(defaultJudge)) {
    preferred.push(defaultJudge);
  }

  for (const providerId of resolveConfiguredOllamaProviderIds()) {
    if (available.has(providerId)) {
      preferred.push(providerId);
    }
  }

  const resolved = uniqueValues(preferred);
  if (resolved.length === 0) {
    throw new Error('Telegram bot requires at least one available ollama-compat provider in config.v2.json.');
  }

  return resolved;
}

export function loadEnvFileIfPresent(envPath = join(process.cwd(), '.env')): void {
  if (!existsSync(envPath)) {
    return;
  }

  const raw = readFileSync(envPath, 'utf-8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith('\'') && value.endsWith('\''))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

export function loadTelegramBotSettings(): TelegramBotSettings {
  const requestedProviderIds = parseCsv(process.env.TELEGRAM_OLLAMA_PROVIDER_IDS);
  const ollamaProviderIds = resolveAvailableOllamaProviderIds(requestedProviderIds);
  const requestedJudge = String(process.env.TELEGRAM_JUDGE_PROVIDER ?? '').trim();
  const judgeProviderId = requestedJudge || ollamaProviderIds[0];

  if (!ollamaProviderIds.includes(judgeProviderId)) {
    throw new Error(`Telegram judge provider must be one of the predefined Ollama providers: ${ollamaProviderIds.join(', ')}`);
  }

  const responseLanguage = String(process.env.TELEGRAM_RESPONSE_LANGUAGE ?? 'auto').trim().toLowerCase();
  const newsMode = String(process.env.TELEGRAM_NEWS_MODE ?? 'unified').trim().toLowerCase();
  const queryLanguageScope = String(process.env.TELEGRAM_NEWS_LANGUAGE_SCOPE ?? 'both').trim().toLowerCase();
  const queryTransformMode = String(process.env.TELEGRAM_NEWS_QUERY_MODE ?? 'expand').trim().toLowerCase();

  return {
    botToken: String(process.env.TELEGRAM_BOT_TOKEN ?? '').trim(),
    apiBaseUrl: String(process.env.TELEGRAM_API_BASE_URL ?? 'https://api.telegram.org').trim() || 'https://api.telegram.org',
    allowedChatIds: parseAllowedChatIds(process.env.TELEGRAM_ALLOWED_CHAT_IDS),
    defaultTemplateId: String(process.env.TELEGRAM_DEFAULT_TEMPLATE_ID ?? '').trim(),
    rounds: clampInteger(process.env.TELEGRAM_DEBATE_ROUNDS, 3, 1, 5),
    stateFile: String(process.env.TELEGRAM_STATE_FILE ?? join(homedir(), '.debate-arena', 'telegram-state.json')).trim(),
    responseLanguage: responseLanguage === 'ko' || responseLanguage === 'en' ? responseLanguage : 'auto',
    ollamaProviderIds,
    judgeProviderId,
    newsQueryTransformMode: queryTransformMode === 'off' ? 'off' : 'expand',
    newsQueryLanguageScope: (
      queryLanguageScope === 'input'
      || queryLanguageScope === 'ko'
      || queryLanguageScope === 'en'
      || queryLanguageScope === 'both'
    ) ? queryLanguageScope : 'both',
    newsMaxArticles: clampInteger(process.env.TELEGRAM_NEWS_MAX_ARTICLES, 6, 3, 12),
    newsMode: newsMode === 'split' ? 'split' : 'unified',
  };
}
