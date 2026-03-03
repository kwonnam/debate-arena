import chalk from 'chalk';
import { startDashboardServer } from '../../server/index.js';

export function handleDashboard(): void {
  const { url } = startDashboardServer();
  console.log(chalk.green(`\n  Dashboard running at ${url}\n`));
  console.log(chalk.dim('  Open this URL in your browser.'));
  console.log('');
}
