import chalk from 'chalk';
import boxen from 'boxen';

export function showBanner(): void {
  const title = chalk.bold.white('FIGHT FOR ME');
  const subtitle = chalk.gray('AI Debate Arena - Codex vs Claude');

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
