import chalk from 'chalk';
import boxen from 'boxen';

export function showBanner(): void {
  const title = chalk.bold.white('DEBATE ARENA');
  const subtitle = chalk.gray('Multi-model structured debates and collaborative discussions');

  const banner = boxen(`${title}\n${subtitle}`, {
    padding: 1,
    margin: { top: 1, bottom: 1, left: 0, right: 0 },
    borderStyle: 'double',
    borderColor: 'yellow',
    textAlignment: 'center',
  });

  console.log(banner);
}

export function showQuestion(question: string): void {
  console.log(chalk.bold.cyan('\n  Question: ') + chalk.white(question) + '\n');
}
