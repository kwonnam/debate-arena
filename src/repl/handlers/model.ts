import { select } from '@inquirer/prompts';
import chalk from 'chalk';
import { loadConfig, saveConfig } from '../../config/manager.js';
import { withSafeStdin } from '../tty-state.js';

const CODEX_MODELS = [
  { value: 'o3', name: 'o3' },
  { value: 'o4-mini', name: 'o4-mini' },
  { value: 'gpt-4.1', name: 'gpt-4.1' },
  { value: 'gpt-4.1-mini', name: 'gpt-4.1-mini' },
  { value: 'gpt-4.1-nano', name: 'gpt-4.1-nano' },
] as const;

const CLAUDE_MODELS = [
  { value: 'claude-opus-4-6', name: 'claude-opus-4-6' },
  { value: 'claude-sonnet-4-5-20250929', name: 'claude-sonnet-4-5-20250929' },
  { value: 'claude-haiku-4-5-20251001', name: 'claude-haiku-4-5-20251001' },
] as const;

async function selectCodexModel(): Promise<void> {
  const config = loadConfig();
  const chosen = await withSafeStdin(() =>
    select({
      message: 'Select Codex model:',
      choices: [
        { value: '', name: '(default - CLI built-in)' },
        ...CODEX_MODELS.map((m) => ({
          value: m.value,
          name: config.codexModel === m.value ? `${m.name} ${chalk.green('(current)')}` : m.name,
        })),
      ],
      default: config.codexModel,
    }),
  );

  saveConfig({ codexModel: chosen });
  const label = chosen || '(default)';
  console.log(`\n  ${chalk.green('OK')} Codex model set to ${chalk.bold(label)}\n`);
}

async function selectClaudeModel(): Promise<void> {
  const config = loadConfig();
  const chosen = await withSafeStdin(() =>
    select({
      message: 'Select Claude model:',
      choices: [
        { value: '', name: '(default - CLI built-in)' },
        ...CLAUDE_MODELS.map((m) => ({
          value: m.value,
          name: config.claudeModel === m.value ? `${m.name} ${chalk.green('(current)')}` : m.name,
        })),
      ],
      default: config.claudeModel,
    }),
  );

  saveConfig({ claudeModel: chosen });
  const label = chosen || '(default)';
  console.log(`\n  ${chalk.green('OK')} Claude model set to ${chalk.bold(label)}\n`);
}

function listModels(): void {
  const config = loadConfig();
  console.log(chalk.bold('\n  Current Models:\n'));
  console.log(
    `  ${chalk.cyan('Codex')}:  ${config.codexModel || chalk.dim('(default - CLI built-in)')}`,
  );
  console.log(
    `  ${chalk.cyan('Claude')}: ${config.claudeModel || chalk.dim('(default - CLI built-in)')}`,
  );
  console.log('');
}

export async function handleModel(args: string): Promise<void> {
  const subcommand = args.trim().toLowerCase();

  switch (subcommand) {
    case 'codex':
      await selectCodexModel();
      break;
    case 'claude':
      await selectClaudeModel();
      break;
    case 'list':
    case '':
      listModels();
      break;
    default:
      console.log('Usage: /model [codex|claude|list]');
  }
}
