import chalk from 'chalk';

export function handleExit(): never {
  console.log(chalk.dim('\nGoodbye!\n'));
  process.exit(0);
}
