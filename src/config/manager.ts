import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { AppConfig, ConfigV2, DEFAULT_CONFIG, ProviderConfig } from './defaults.js';

const CONFIG_DIR = join(homedir(), '.debate-arena');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function loadConfig(): AppConfig {
  ensureConfigDir();
  if (!existsSync(CONFIG_FILE)) {
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = readFileSync(CONFIG_FILE, 'utf-8');
    const loaded = { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    if (typeof loaded.defaultJudge !== 'string' || loaded.defaultJudge.trim() === '') {
      loaded.defaultJudge = DEFAULT_CONFIG.defaultJudge;
    }
    return loaded;
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: Partial<AppConfig>): void {
  ensureConfigDir();
  const current = loadConfig();
  const merged = { ...current, ...config };
  writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf-8');
}

export function getConfigValue(key: string): string | number | boolean | undefined {
  const config = loadConfig();
  return (config as unknown as Record<string, unknown>)[key] as string | number | boolean | undefined;
}

export function setConfigValue(key: string, value: string): void {
  const config = loadConfig();
  const record = config as unknown as Record<string, unknown>;

  // Auto-convert booleans and numbers
  if (value === 'true') record[key] = true;
  else if (value === 'false') record[key] = false;
  else if (!isNaN(Number(value)) && value.trim() !== '') record[key] = Number(value);
  else record[key] = value;

  saveConfig(config);
}

const CONFIG_V2_FILE = join(CONFIG_DIR, 'config.v2.json');
const CONFIG_V2_LOCAL_FILE = join(process.cwd(), 'config.v2.json');

function tryReadConfigV2(path: string): ConfigV2 | null {
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw) as ConfigV2;
    if (parsed && parsed.version === 2) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function resolveConfigV2Candidates(): string[] {
  const candidates: string[] = [];

  const override = process.env.FFM_CONFIG_V2?.trim();
  if (override) {
    const overridePath = override.startsWith('/')
      ? override
      : join(process.cwd(), override);
    candidates.push(overridePath);
  }

  candidates.push(CONFIG_V2_LOCAL_FILE);
  candidates.push(CONFIG_V2_FILE);
  return candidates;
}

// v1 AppConfig → v2 ConfigV2 변환
export function migrateToV2(v1: AppConfig): ConfigV2 {
  const providers: Record<string, ProviderConfig> = {};

  if (v1.codexCommand) {
    providers['codex'] = {
      type: 'cli',
      command: v1.codexCommand,
      webSearch: Boolean(v1.codexWebSearch),
      model: v1.codexModel || '',
      capabilities: { supportsStreaming: true, maxContextTokens: 128_000 },
    };
  }
  if (v1.claudeCommand) {
    providers['claude'] = {
      type: 'cli',
      command: v1.claudeCommand,
      mcpConfigs: splitCsv(v1.claudeMcpConfig),
      strictMcpConfig: Boolean(v1.claudeStrictMcpConfig),
      allowedTools: splitCsv(v1.claudeAllowedTools),
      model: v1.claudeModel || '',
      capabilities: { supportsStreaming: true, maxContextTokens: 200_000 },
    };
  }
  if (v1.geminiCommand) {
    providers['gemini'] = {
      type: 'cli',
      command: v1.geminiCommand,
      model: v1.geminiModel || '',
      capabilities: { supportsStreaming: true, maxContextTokens: 1_000_000 },
    };
  }

  return {
    version: 2,
    providers,
    debate: {
      defaultRounds: v1.defaultRounds,
      defaultJudge: v1.defaultJudge,
      defaultFormat: v1.defaultFormat,
      stream: v1.stream,
      commandTimeoutMs: v1.commandTimeoutMs,
      applyTimeoutMs: v1.applyTimeoutMs,
    },
  };
}

// v2 파일 로드 (없으면 v1 변환)
export function loadConfigV2(): ConfigV2 {
  ensureConfigDir();

  for (const candidate of resolveConfigV2Candidates()) {
    const loaded = tryReadConfigV2(candidate);
    if (loaded) return loaded;
  }

  // v1에서 변환
  const v1 = loadConfig();
  return migrateToV2(v1);
}

// v2 저장
export function saveConfigV2(config: ConfigV2): void {
  ensureConfigDir();
  writeFileSync(CONFIG_V2_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

// 마이그레이션 필요 시 자동 수행 (시작 시 호출)
export function migrateIfNeeded(): ConfigV2 {
  if (!existsSync(CONFIG_V2_FILE)) {
    const v2 = loadConfigV2();
    saveConfigV2(v2);
    return v2;
  }
  return loadConfigV2();
}

function insertCodexModel(command: string, model: string): string {
  if (!model) return command;
  // `-` (stdin) must stay last; insert `--model <model>` before it
  if (command.trimEnd().endsWith(' -')) {
    return `${command.slice(0, command.lastIndexOf('-')).trimEnd()} --model ${model} -`;
  }
  return `${command} --model ${model}`;
}

function insertClaudeModel(command: string, model: string): string {
  if (!model) return command;
  return `${command} --model ${model}`;
}

function insertGeminiModel(command: string, model: string): string {
  if (!model) return command;
  return `${command} --model ${model}`;
}

export function resolveCommands(config: AppConfig): {
  codexCommand: string;
  claudeCommand: string;
  claudeApplyCommand: string;
  geminiCommand: string;
  commandTimeoutMs: number;
  applyTimeoutMs: number;
} {
  const codexBase = process.env.CODEX_COMMAND || config.codexCommand;
  const claudeBase = process.env.CLAUDE_COMMAND || config.claudeCommand;
  const claudeApplyBase = config.claudeApplyCommand;
  const geminiBase = process.env.GEMINI_COMMAND || config.geminiCommand;

  return {
    codexCommand: insertCodexModel(codexBase, config.codexModel),
    claudeCommand: insertClaudeModel(claudeBase, config.claudeModel),
    claudeApplyCommand: insertClaudeModel(claudeApplyBase, config.claudeModel),
    geminiCommand: insertGeminiModel(geminiBase, config.geminiModel),
    commandTimeoutMs: Number(process.env.AGENT_COMMAND_TIMEOUT_MS || config.commandTimeoutMs),
    applyTimeoutMs: config.applyTimeoutMs,
  };
}

function splitCsv(value: string | undefined): string[] {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
