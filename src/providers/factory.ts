import { resolve as resolvePath } from 'node:path';
import { loadConfig, loadConfigV2, resolveCommands } from '../config/manager.js';
import type { OllamaToolConfig, ProviderConfig } from '../config/defaults.js';
import type { ProviderName } from '../types/debate.js';
import type { DebateParticipant } from '../types/roles.js';
import type { ModelInfo } from './base-http-provider.js';
import type { AIProvider } from './types.js';
import { CliProvider } from './cli-provider.js';
import { ClaudeProvider } from './claude.js';
import { CodexProvider } from './codex.js';
import { GeminiProvider } from './gemini.js';
import { OllamaCompatProvider } from './ollama-compat.js';
import { WebAiBridgeProvider } from './web-ai-bridge.js';

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
  webSearch?: boolean;
  mcpConfigs?: string[];
  strictMcpConfig?: boolean;
  allowedTools?: string[];
  baseUrl?: string;
  bridgeUrl?: string;
  apiKeyEnvVar?: string;
  apiKey?: string;
  model?: string;
  ollamaTools?: OllamaToolConfig;
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
    webSearch: Boolean(config.codexWebSearch),
    model: config.codexModel,
    timeoutMs: commands.commandTimeoutMs,
    source: 'legacy',
  });

  entries.set('claude', {
    id: 'claude',
    type: 'cli',
    command: commands.claudeCommand,
    mcpConfigs: splitCsv(config.claudeMcpConfig),
    strictMcpConfig: Boolean(config.claudeStrictMcpConfig),
    allowedTools: splitCsv(config.claudeAllowedTools),
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
      webSearch: provider.webSearch,
      mcpConfigs: provider.mcpConfigs,
      strictMcpConfig: provider.strictMcpConfig,
      allowedTools: provider.allowedTools,
      baseUrl: provider.baseUrl,
      bridgeUrl: provider.bridgeUrl,
      apiKeyEnvVar: provider.apiKeyEnvVar,
      apiKey: provider.apiKey
        ?? provider.openaiApiKey
        ?? provider.openai_api_key
        ?? provider.ollamaApiKey
        ?? provider.ollama_api_key,
      ollamaTools: provider.ollamaTools,
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
    const legacyEntry = merged.get(id);
    merged.set(id, {
      ...legacyEntry,
      ...entry,
      webSearch: entry.webSearch ?? legacyEntry?.webSearch,
      mcpConfigs: entry.mcpConfigs ?? legacyEntry?.mcpConfigs,
      strictMcpConfig: entry.strictMcpConfig ?? legacyEntry?.strictMcpConfig,
      allowedTools: entry.allowedTools ?? legacyEntry?.allowedTools,
      ollamaTools: entry.ollamaTools ?? legacyEntry?.ollamaTools,
    });
  }
  return merged;
}

function applyProviderOverrides(
  entry: ResolvedProviderEntry,
  overrides?: ProviderOverrides,
): ResolvedProviderEntry {
  if (entry.type !== 'ollama-compat') {
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

  if (entry.type === 'web-ai-bridge') {
    if (!entry.bridgeUrl || !entry.bridgeUrl.trim()) {
      return 'Missing bridgeUrl';
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
      entry.ollamaTools,
    );
  }

  if (entry.type === 'web-ai-bridge') {
    if (!entry.bridgeUrl?.trim()) {
      throw new Error(`Provider '${entry.id}' is missing bridgeUrl`);
    }
    return new WebAiBridgeProvider(entry.id, entry.bridgeUrl.trim(), entry.timeoutMs);
  }

  throw new Error(`Provider type '${entry.type}' is not supported yet`);
}

function resolveCliCommand(entry: ResolvedProviderEntry): string {
  const base = entry.command?.trim() || '';
  if (!base) return '';

  if (entry.id === 'codex' || isLikelyCodexCliCommand(base)) {
    return buildCodexCliCommand(base, entry.model, entry.webSearch);
  }

  if (entry.id === 'claude' || isLikelyClaudeCliCommand(base)) {
    return buildClaudeCliCommand(base, {
      model: entry.model,
      mcpConfigs: entry.mcpConfigs,
      strictMcpConfig: entry.strictMcpConfig,
      allowedTools: entry.allowedTools,
    });
  }

  const model = normalizeCliModel(entry.model);
  if (!model) return base;
  if (base.includes('--model ')) return base;

  if (entry.id === 'gemini') {
    return `${base} --model ${model}`;
  }

  return base;
}

export function buildCodexCliCommand(
  command: string,
  model?: string,
  webSearch?: boolean,
): string {
  let resolved = command.trim();
  if (!resolved) return '';

  if (webSearch) {
    resolved = insertCodexWebSearch(resolved);
  }

  const normalizedModel = normalizeCliModel(model);
  if (!normalizedModel || resolved.includes('--model ')) {
    return resolved;
  }

  if (resolved.endsWith(' -')) {
    return `${resolved.slice(0, resolved.lastIndexOf('-')).trimEnd()} --model ${normalizedModel} -`;
  }

  return `${resolved} --model ${normalizedModel}`;
}

function insertCodexWebSearch(command: string): string {
  if (!isLikelyCodexCliCommand(command) || /\s--search(?:\s|$)/.test(command)) {
    return command;
  }

  const match = /\bexec\b/.exec(command);
  if (!match || match.index <= 0) {
    return command;
  }

  const prefix = command.slice(0, match.index).trimEnd();
  const suffix = command.slice(match.index);
  return `${prefix} --search ${suffix}`;
}

function isLikelyCodexCliCommand(command: string): boolean {
  return /\b(?:codex|@openai\/codex)\b/.test(command);
}

interface ClaudeCliOptions {
  model?: string;
  mcpConfigs?: string[];
  strictMcpConfig?: boolean;
  allowedTools?: string[];
}

export function buildClaudeCliCommand(
  command: string,
  options: ClaudeCliOptions = {},
): string {
  let resolved = command.trim();
  if (!resolved) return '';

  const model = normalizeCliModel(options.model);
  if (model && !resolved.includes('--model ')) {
    resolved += ` --model ${model}`;
  }

  const mcpConfigs = normalizeMcpConfigPaths(options.mcpConfigs);
  for (const mcpConfig of mcpConfigs) {
    const quoted = shellQuote(mcpConfig);
    if (!resolved.includes(`--mcp-config ${quoted}`)) {
      resolved += ` --mcp-config ${quoted}`;
    }
  }

  if (options.strictMcpConfig && !/\s--strict-mcp-config(?:\s|$)/.test(resolved)) {
    resolved += ' --strict-mcp-config';
  }

  const allowedTools = normalizeStringList(options.allowedTools);
  if (allowedTools.length > 0 && !resolved.includes('--allowedTools') && !resolved.includes('--allowed-tools')) {
    resolved += ` --allowedTools ${shellQuote(allowedTools.join(','))}`;
  }

  return resolved.trim();
}

function isLikelyClaudeCliCommand(command: string): boolean {
  return /\bclaude\b/.test(command);
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

function normalizeStringList(values?: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values ?? []) {
    const item = value.trim();
    if (!item || seen.has(item)) continue;
    seen.add(item);
    normalized.push(item);
  }

  return normalized;
}

function normalizeMcpConfigPaths(values?: string[]): string[] {
  return normalizeStringList(values).map((value) => {
    if (value.startsWith('/')) {
      return value;
    }
    return resolvePath(value);
  });
}

function splitCsv(value: string | undefined): string[] {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function shellQuote(value: string): string {
  return JSON.stringify(value);
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
