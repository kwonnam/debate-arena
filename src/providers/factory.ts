import { loadConfig, loadConfigV2, resolveCommands } from '../config/manager.js';
import type { ProviderConfig } from '../config/defaults.js';
import type { ProviderName } from '../types/debate.js';
import type { DebateParticipant } from '../types/roles.js';
import type { ModelInfo } from './base-http-provider.js';
import type { AIProvider } from './types.js';
import { CliProvider } from './cli-provider.js';
import { ClaudeProvider } from './claude.js';
import { CodexProvider } from './codex.js';
import { GeminiProvider } from './gemini.js';
import { OllamaCompatProvider } from './ollama-compat.js';

export interface ProviderOption {
  name: ProviderName;
  label: string;
  available: boolean;
  reason?: string;
  type: ProviderConfig['type'] | 'legacy';
}

interface ResolvedProviderEntry {
  id: ProviderName;
  type: ProviderConfig['type'];
  command?: string;
  baseUrl?: string;
  apiKeyEnvVar?: string;
  apiKey?: string;
  model?: string;
  timeoutMs: number;
  source: 'v2' | 'legacy';
}

interface ProviderOverrides {
  ollamaModel?: string;
}

const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
const DEFAULT_OLLAMA_MODEL = 'llama3';

function normalizeProviderId(raw: unknown): ProviderName {
  return String(raw ?? '').trim().toLowerCase();
}

function resolveLegacyProviderEntries(): Map<ProviderName, ResolvedProviderEntry> {
  const config = loadConfig();
  const commands = resolveCommands(config);

  const entries = new Map<ProviderName, ResolvedProviderEntry>();

  entries.set('codex', {
    id: 'codex',
    type: 'cli',
    command: commands.codexCommand,
    model: config.codexModel,
    timeoutMs: commands.commandTimeoutMs,
    source: 'legacy',
  });

  entries.set('claude', {
    id: 'claude',
    type: 'cli',
    command: commands.claudeCommand,
    model: config.claudeModel,
    timeoutMs: commands.commandTimeoutMs,
    source: 'legacy',
  });

  entries.set('gemini', {
    id: 'gemini',
    type: 'cli',
    command: commands.geminiCommand,
    model: config.geminiModel,
    timeoutMs: commands.commandTimeoutMs,
    source: 'legacy',
  });

  const ollamaBaseUrl = process.env.OLLAMA_BASE_URL?.trim() || DEFAULT_OLLAMA_BASE_URL;
  const ollamaModel = process.env.OLLAMA_MODEL?.trim() || DEFAULT_OLLAMA_MODEL;

  entries.set('ollama', {
    id: 'ollama',
    type: 'ollama-compat',
    baseUrl: ollamaBaseUrl,
    apiKeyEnvVar: 'OLLAMA_API_KEY',
    model: ollamaModel,
    timeoutMs: commands.commandTimeoutMs,
    source: 'legacy',
  });

  return entries;
}

function resolveV2ProviderEntries(): Map<ProviderName, ResolvedProviderEntry> {
  const v2 = loadConfigV2();
  const timeoutMs = Number(v2.debate?.commandTimeoutMs || 180_000);
  const entries = new Map<ProviderName, ResolvedProviderEntry>();

  for (const [rawId, provider] of Object.entries(v2.providers || {})) {
    const id = normalizeProviderId(rawId);
    if (!id) continue;

    entries.set(id, {
      id,
      type: provider.type,
      command: provider.command,
      baseUrl: provider.baseUrl,
      apiKeyEnvVar: provider.apiKeyEnvVar,
      apiKey: provider.apiKey
        ?? provider.openaiApiKey
        ?? provider.openai_api_key
        ?? provider.ollamaApiKey
        ?? provider.ollama_api_key,
      model: provider.model,
      timeoutMs,
      source: 'v2',
    });
  }

  return entries;
}

function resolveProviderEntries(): Map<ProviderName, ResolvedProviderEntry> {
  const legacy = resolveLegacyProviderEntries();
  const v2 = resolveV2ProviderEntries();

  const merged = new Map<ProviderName, ResolvedProviderEntry>(legacy);
  for (const [id, entry] of v2.entries()) {
    merged.set(id, entry);
  }
  return merged;
}

function applyProviderOverrides(
  entry: ResolvedProviderEntry,
  overrides?: ProviderOverrides,
): ResolvedProviderEntry {
  if (entry.id !== 'ollama') {
    return entry;
  }

  const model = overrides?.ollamaModel?.trim();
  if (!model) {
    return entry;
  }

  return {
    ...entry,
    model,
  };
}

function resolveApiKey(entry: ResolvedProviderEntry): string {
  if (entry.apiKey && entry.apiKey.trim()) {
    return entry.apiKey.trim();
  }
  if (!entry.apiKeyEnvVar) return '';
  const envName = entry.apiKeyEnvVar.trim();
  const fromEnv = process.env[envName]?.trim();
  if (fromEnv) return fromEnv;

  // Backward-friendly fallback:
  // if apiKeyEnvVar is not a valid env var name, treat it as a literal key.
  if (!isLikelyEnvVarName(envName)) {
    return envName;
  }
  return '';
}

function isLikelyEnvVarName(value: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
}

function validateProviderEntry(entry: ResolvedProviderEntry): string | null {
  if (entry.type === 'cli') {
    if (!entry.command || !entry.command.trim()) {
      return 'Missing CLI command';
    }
    return null;
  }

  if (entry.type === 'ollama-compat') {
    if (!entry.baseUrl || !entry.baseUrl.trim()) {
      return 'Missing baseUrl';
    }
    return null;
  }

  if (entry.type === 'anthropic') {
    return 'anthropic type is not implemented yet (use cli or ollama-compat)';
  }

  return `Unsupported provider type: ${entry.type}`;
}

function instantiateProvider(entry: ResolvedProviderEntry): AIProvider {
  if (entry.type === 'cli') {
    const command = resolveCliCommand(entry);
    if (!command) {
      throw new Error(`Provider '${entry.id}' is missing CLI command`);
    }

    if (entry.id === 'codex') {
      return new CodexProvider(command, entry.timeoutMs);
    }
    if (entry.id === 'claude') {
      return new ClaudeProvider(command, entry.timeoutMs);
    }
    if (entry.id === 'gemini') {
      return new GeminiProvider(command, entry.timeoutMs);
    }
    return new CliProvider(entry.id, command, entry.timeoutMs);
  }

  if (entry.type === 'ollama-compat') {
    if (!entry.baseUrl?.trim()) {
      throw new Error(`Provider '${entry.id}' is missing baseUrl`);
    }
    const apiKey = resolveApiKey(entry);
    return new OllamaCompatProvider(
      entry.id,
      entry.baseUrl.trim(),
      apiKey,
      entry.timeoutMs,
      undefined,
      entry.model?.trim() || '',
    );
  }

  throw new Error(`Provider type '${entry.type}' is not supported yet`);
}

function resolveCliCommand(entry: ResolvedProviderEntry): string {
  const base = entry.command?.trim() || '';
  if (!base) return '';
  const model = normalizeCliModel(entry.model);
  if (!model) return base;
  if (base.includes('--model ')) return base;

  if (entry.id === 'codex') {
    if (base.endsWith(' -')) {
      return `${base.slice(0, base.lastIndexOf('-')).trimEnd()} --model ${model} -`;
    }
    return `${base} --model ${model}`;
  }

  if (entry.id === 'claude' || entry.id === 'gemini') {
    return `${base} --model ${model}`;
  }

  return base;
}

function normalizeCliModel(raw?: string): string {
  const value = raw?.trim() ?? '';
  if (!value) return '';
  if (value.toLowerCase() === 'default') return '';
  return value;
}

function formatProviderLabel(entry: ResolvedProviderEntry): string {
  const model = normalizeDisplayModel(entry.model);
  if (!model) {
    return `${entry.id}`;
  }
  return `${entry.id} (${model})`;
}

function normalizeDisplayModel(raw?: string): string {
  const value = raw?.trim() ?? '';
  if (!value) return '';
  if (value.toLowerCase() === 'default') return '';
  return value;
}

function normalizeRequestedProvider(raw: unknown): ProviderName {
  return normalizeProviderId(raw);
}

export function listProviderOptions(): ProviderOption[] {
  const entries = [...resolveProviderEntries().values()];

  return entries
    .map((entry) => {
      const reason = validateProviderEntry(entry);
      const type: ProviderOption['type'] = entry.source === 'legacy' ? 'legacy' : entry.type;
      return {
        name: entry.id,
        label: formatProviderLabel(entry),
        available: reason === null,
        reason: reason ?? undefined,
        type,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function createProviderMap(
  participants?: readonly (ProviderName | DebateParticipant)[],
  judge?: ProviderName | 'both',
  overrides?: ProviderOverrides,
): Map<ProviderName, AIProvider> {
  const entries = resolveProviderEntries();
  const providers = new Map<ProviderName, AIProvider>();
  const errors = new Map<ProviderName, string>();

  for (const entry of entries.values()) {
    const effectiveEntry = applyProviderOverrides(entry, overrides);
    const validationError = validateProviderEntry(effectiveEntry);
    if (validationError) {
      errors.set(effectiveEntry.id, validationError);
      continue;
    }

    try {
      providers.set(effectiveEntry.id, instantiateProvider(effectiveEntry));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.set(effectiveEntry.id, message);
    }
  }

  const required = new Set<ProviderName>();
  if (participants && participants.length > 0) {
    for (const participant of participants) {
      required.add(normalizeRequestedProvider(typeof participant === 'string' ? participant : participant.provider));
    }
  } else {
    required.add('codex');
    required.add('claude');
  }

  if (judge && judge !== 'both') {
    required.add(normalizeRequestedProvider(judge));
  }

  const availableNames = [...providers.keys()].sort();
  for (const name of required) {
    if (providers.has(name)) continue;

    const reason = errors.get(name) ?? 'not configured';
    const availableHint = availableNames.length > 0
      ? ` Available providers: ${availableNames.join(', ')}.`
      : '';
    throw new Error(`Provider '${name}' is unavailable (${reason}).${availableHint}`);
  }

  return providers;
}

export function createApplyProvider(providerName: ProviderName): AIProvider {
  const providerId = normalizeProviderId(providerName);
  const config = loadConfig();
  const commands = resolveCommands(config);

  if (providerId === 'codex') {
    return new CodexProvider(commands.codexCommand, commands.applyTimeoutMs);
  }
  if (providerId === 'claude') {
    return new ClaudeProvider(commands.claudeApplyCommand, commands.applyTimeoutMs);
  }

  const entry = resolveProviderEntries().get(providerId);
  if (!entry) {
    throw new Error(`Provider '${providerName}' is not configured`);
  }

  if (entry.type !== 'cli') {
    throw new Error(
      `Apply supports CLI providers only. '${providerName}' is '${entry.type}'.`,
    );
  }

  const command = entry.command?.trim();
  if (!command) {
    throw new Error(`Provider '${providerName}' is missing CLI command`);
  }

  return new CliProvider(providerId, command, commands.applyTimeoutMs);
}

export async function listProviderModels(providerName: ProviderName): Promise<ModelInfo[]> {
  const providerId = normalizeProviderId(providerName);
  const entry = resolveProviderEntries().get(providerId);

  if (!entry) {
    throw new Error(`Provider '${providerName}' is not configured`);
  }

  if (entry.type !== 'ollama-compat') {
    throw new Error(`Provider '${providerName}' does not support remote model listing`);
  }

  const validationError = validateProviderEntry(entry);
  if (validationError) {
    throw new Error(`Provider '${providerName}' is unavailable (${validationError})`);
  }

  const provider = instantiateProvider(entry);
  if (!(provider instanceof OllamaCompatProvider)) {
    throw new Error(`Provider '${providerName}' does not expose model listing`);
  }

  const models = await provider.listModels();
  return models.sort((left, right) => left.id.localeCompare(right.id));
}
