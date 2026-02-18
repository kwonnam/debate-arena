import { select } from '@inquirer/prompts';
import chalk from 'chalk';
import ora from 'ora';
import { loadConfig, saveConfig } from '../../config/manager.js';
import {
  fetchCodexModels,
  fetchClaudeModels,
  clearModelCache,
  type ModelFetchResult,
} from '../../core/model-fetcher.js';
import { withSafeStdin } from '../tty-state.js';

function sourceLabel(source: ModelFetchResult['source']): string {
  switch (source) {
    case 'api':
      return chalk.green('[API]');
    case 'cached':
      return chalk.yellow('[cached]');
    case 'fallback':
      return chalk.dim('[fallback]');
  }
}

async function selectCodexModel(): Promise<void> {
  const spinner = ora('Fetching Codex models...').start();
  const result = await fetchCodexModels();
  spinner.stop();

  console.log(`  Models loaded ${sourceLabel(result.source)}`);

  const config = loadConfig();
  const chosen = await withSafeStdin(() =>
    select({
      message: 'Select Codex model:',
      choices: [
        { value: '', name: '(default - CLI built-in)' },
        ...result.models.map((m) => ({
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
  const spinner = ora('Fetching Claude models...').start();
  const result = await fetchClaudeModels();
  spinner.stop();

  console.log(`  Models loaded ${sourceLabel(result.source)}`);

  const config = loadConfig();
  const chosen = await withSafeStdin(() =>
    select({
      message: 'Select Claude model:',
      choices: [
        { value: '', name: '(default - CLI built-in)' },
        ...result.models.map((m) => ({
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

function handleRefresh(): void {
  clearModelCache();
  console.log(`\n  ${chalk.green('OK')} Model cache cleared.\n`);
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
    case 'refresh':
      handleRefresh();
      break;
    case 'list':
    case '':
      listModels();
      break;
    default:
      console.log('Usage: /model [codex|claude|list|refresh]');
  }
}
