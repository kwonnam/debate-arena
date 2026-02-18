import chalk from 'chalk';
import type { ProviderStatus } from '../../core/status-checker.js';
import { checkAllProviders } from '../../core/status-checker.js';

function renderProviderStatus(status: ProviderStatus): void {
  const icon = status.cliInstalled ? chalk.green('●') : chalk.yellow('●');
  console.log(`\n  ${icon} ${chalk.bold(status.displayName)}`);

  if (status.cliInstalled) {
    const version = status.cliVersion !== 'unknown' ? ` ${status.cliVersion}` : '';
    console.log(`    CLI:      ${chalk.green('✓')} ${status.cliBinary}${version}`);
  } else {
    console.log(`    CLI:      ${chalk.red('✗')} ${status.cliBinary} (not found)`);
  }

  console.log(`    Command:  ${status.configuredCommand}`);
}

export function handleStatus(): void {
  console.log(chalk.bold('\n  FIGHT FOR ME — Agent Status\n'));

  const providers = checkAllProviders();
  for (const provider of providers) {
    renderProviderStatus(provider);
  }

  console.log('');
}
