import chalk from 'chalk';
import { loadConfig, saveConfig } from '../../config/manager.js';

export const KNOWN_CODEX_MODELS: readonly string[] = [
  'o3',
  'o4-mini',
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4.1-nano',
];

export const KNOWN_CLAUDE_MODELS: readonly string[] = [
  'claude-opus-4-6',
  'claude-sonnet-4-5-20250929',
  'claude-haiku-4-5-20251001',
];

export const KNOWN_GEMINI_MODELS: readonly string[] = [
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
];

const PROVIDERS: readonly string[] = ['codex', 'claude', 'gemini'];

type Provider = 'codex' | 'claude' | 'gemini';

export function getModelCompletions(input: string): readonly string[] {
  const trimmed = input.trimStart();
  const parts = trimmed.split(/\s+/);

  if (parts.length <= 1) {
    const prefix = parts[0]?.toLowerCase() ?? '';
    return PROVIDERS.filter((p) => p.startsWith(prefix));
  }

  const provider = parts[0].toLowerCase();
  const modelPrefix = parts[parts.length - 1].toLowerCase();

  const models =
    provider === 'codex'
      ? KNOWN_CODEX_MODELS
      : provider === 'claude'
        ? KNOWN_CLAUDE_MODELS
        : provider === 'gemini'
          ? KNOWN_GEMINI_MODELS
          : [];

  return ['default', ...models].filter((m) => m.startsWith(modelPrefix));
}

function showCurrentModels(): void {
  const config = loadConfig();
  console.log(chalk.bold('\n  Current Models:\n'));
  console.log(
    `  ${chalk.cyan('Codex')}:  ${config.codexModel || chalk.dim('(default - CLI built-in)')}`,
  );
  console.log(
    `  ${chalk.cyan('Claude')}: ${config.claudeModel || chalk.dim('(default - CLI built-in)')}`,
  );
  console.log(
    `  ${chalk.cyan('Gemini')}: ${config.geminiModel || chalk.dim('(default - CLI built-in)')}`,
  );

  console.log(chalk.bold('\n  Known Models:\n'));
  console.log(`  ${chalk.cyan('Codex')}:  ${KNOWN_CODEX_MODELS.join(', ')}`);
  console.log(`  ${chalk.cyan('Claude')}: ${KNOWN_CLAUDE_MODELS.join(', ')}`);
  console.log(`  ${chalk.cyan('Gemini')}: ${KNOWN_GEMINI_MODELS.join(', ')}`);

  console.log(chalk.dim('\n  Usage: /model <codex|claude|gemini> <model-name|default>\n'));
}

function setModel(provider: Provider, modelName: string): void {
  const value = modelName === 'default' ? '' : modelName;
  const configKey =
    provider === 'codex' ? 'codexModel' :
    provider === 'gemini' ? 'geminiModel' :
    'claudeModel';

  saveConfig({ [configKey]: value });

  const label = value || '(default)';
  console.log(
    `\n  ${chalk.green('OK')} ${chalk.cyan(provider)} model set to ${chalk.bold(label)}\n`,
  );
}

export function handleModel(args: string): void {
  const parts = args.trim().split(/\s+/);
  const subcommand = parts[0]?.toLowerCase() ?? '';
  const modelName = parts[1] ?? '';

  if (subcommand === '' || subcommand === 'list') {
    showCurrentModels();
    return;
  }

  if (subcommand !== 'codex' && subcommand !== 'claude' && subcommand !== 'gemini') {
    console.log(`\n  ${chalk.red('Unknown provider:')} ${subcommand}`);
    console.log(chalk.dim('  Usage: /model <codex|claude|gemini> <model-name|default>\n'));
    return;
  }

  if (!modelName) {
    const known =
      subcommand === 'codex' ? KNOWN_CODEX_MODELS :
      subcommand === 'gemini' ? KNOWN_GEMINI_MODELS :
      KNOWN_CLAUDE_MODELS;
    console.log(`\n  ${chalk.red('Model name required.')}`);
    console.log(`  Known ${subcommand} models: ${known.join(', ')}`);
    console.log(chalk.dim('  Usage: /model ' + subcommand + ' <model-name|default>\n'));
    return;
  }

  setModel(subcommand, modelName);
}
