import { Command } from 'commander';
import { select } from '@inquirer/prompts';
import chalk from 'chalk';
import { loadConfig, saveConfig } from '../../config/manager.js';

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

export function registerModelCommand(program: Command): void {
  const modelCmd = program.command('model').description('Select agent model');

  modelCmd
    .command('codex')
    .description('Select Codex (OpenAI) model')
    .action(async () => {
      const config = loadConfig();
      const chosen = await select({
        message: 'Select Codex model:',
        choices: [
          { value: '', name: '(default — CLI built-in)' },
          ...CODEX_MODELS.map((m) => ({
            value: m.value,
            name: config.codexModel === m.value ? `${m.name} ${chalk.green('← current')}` : m.name,
          })),
        ],
        default: config.codexModel,
      });

      saveConfig({ codexModel: chosen });
      const label = chosen || '(default)';
      console.log(`\n  ${chalk.green('✓')} Codex model set to ${chalk.bold(label)}\n`);
    });

  modelCmd
    .command('claude')
    .description('Select Claude (Anthropic) model')
    .action(async () => {
      const config = loadConfig();
      const chosen = await select({
        message: 'Select Claude model:',
        choices: [
          { value: '', name: '(default — CLI built-in)' },
          ...CLAUDE_MODELS.map((m) => ({
            value: m.value,
            name:
              config.claudeModel === m.value ? `${m.name} ${chalk.green('← current')}` : m.name,
          })),
        ],
        default: config.claudeModel,
      });

      saveConfig({ claudeModel: chosen });
      const label = chosen || '(default)';
      console.log(`\n  ${chalk.green('✓')} Claude model set to ${chalk.bold(label)}\n`);
    });

  modelCmd
    .command('list')
    .description('Show currently configured models')
    .action(() => {
      const config = loadConfig();
      console.log(chalk.bold('\n  Current Models:\n'));
      console.log(
        `  ${chalk.cyan('Codex')}:  ${config.codexModel || chalk.dim('(default — CLI built-in)')}`,
      );
      console.log(
        `  ${chalk.cyan('Claude')}: ${config.claudeModel || chalk.dim('(default — CLI built-in)')}`,
      );
      console.log('');
    });
}
