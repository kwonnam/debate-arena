import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { AppConfig, DEFAULT_CONFIG } from './defaults.js';

const CONFIG_DIR = join(homedir(), '.fight-for-me');
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
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
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
  return (config as Record<string, unknown>)[key] as string | number | boolean | undefined;
}

export function setConfigValue(key: string, value: string): void {
  const config = loadConfig();
  const record = config as Record<string, unknown>;

  // Auto-convert booleans and numbers
  if (value === 'true') record[key] = true;
  else if (value === 'false') record[key] = false;
  else if (!isNaN(Number(value)) && value.trim() !== '') record[key] = Number(value);
  else record[key] = value;

  saveConfig(config);
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

export function resolveCommands(config: AppConfig): {
  codexCommand: string;
  claudeCommand: string;
  claudeApplyCommand: string;
  commandTimeoutMs: number;
  applyTimeoutMs: number;
} {
  const codexBase = process.env.CODEX_COMMAND || config.codexCommand;
  const claudeBase = process.env.CLAUDE_COMMAND || config.claudeCommand;
  const claudeApplyBase = config.claudeApplyCommand;

  return {
    codexCommand: insertCodexModel(codexBase, config.codexModel),
    claudeCommand: insertClaudeModel(claudeBase, config.claudeModel),
    claudeApplyCommand: insertClaudeModel(claudeApplyBase, config.claudeModel),
    commandTimeoutMs: Number(process.env.AGENT_COMMAND_TIMEOUT_MS || config.commandTimeoutMs),
    applyTimeoutMs: config.applyTimeoutMs,
  };
}
