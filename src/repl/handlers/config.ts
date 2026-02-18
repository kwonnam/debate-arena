import chalk from 'chalk';
import { getConfigValue, loadConfig, setConfigValue } from '../../config/manager.js';

export function handleConfig(args: string): void {
  const parts = args.split(/\s+/).filter(Boolean);
  const subcommand = parts[0] || 'list';

  switch (subcommand) {
    case 'list': {
      const config = loadConfig();
      console.log(chalk.bold('\nCurrent Configuration:\n'));
      for (const [key, value] of Object.entries(config)) {
        console.log(`  ${chalk.cyan(key)}: ${String(value)}`);
      }
      console.log('');
      break;
    }
    case 'set': {
      const key = parts[1];
      const value = parts[2];
      if (!key || !value) {
        console.log('Usage: /config set <key> <value>');
        return;
      }
      setConfigValue(key, value);
      console.log(chalk.green(`Set ${key} = ${value}`));
      break;
    }
    case 'get': {
      const key = parts[1];
      if (!key) {
        console.log('Usage: /config get <key>');
        return;
      }
      const value = getConfigValue(key);
      if (value === undefined) {
        console.log(chalk.yellow(`Key "${key}" is not set.`));
        return;
      }
      console.log(`${key} = ${value}`);
      break;
    }
    default:
      console.log('Usage: /config [list|set <key> <value>|get <key>]');
  }
}
