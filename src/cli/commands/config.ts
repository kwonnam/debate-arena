import { Command } from 'commander';
import chalk from 'chalk';
import { getConfigValue, loadConfig, setConfigValue } from '../../config/manager.js';

export function registerConfigCommand(program: Command): void {
  const configCmd = program.command('config').description('Manage configuration');

  configCmd
    .command('set <key> <value>')
    .description('Set a configuration value')
    .action((key: string, value: string) => {
      setConfigValue(key, value);
      console.log(chalk.green(`Set ${key} = ${value}`));
    });

  configCmd
    .command('get <key>')
    .description('Get a configuration value')
    .action((key: string) => {
      const value = getConfigValue(key);
      if (value === undefined) {
        console.log(chalk.yellow(`Key "${key}" is not set.`));
        return;
      }
      console.log(`${key} = ${value}`);
    });

  configCmd
    .command('list')
    .description('List all configuration values')
    .action(() => {
      const config = loadConfig();
      console.log(chalk.bold('\nCurrent Configuration:\n'));
      for (const [key, value] of Object.entries(config)) {
        console.log(`  ${chalk.cyan(key)}: ${String(value)}`);
      }
      console.log('');
    });
}
