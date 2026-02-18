import chalk from 'chalk';
import {
  COMMAND_REGISTRY,
  CATEGORY_LABELS,
  type CommandCategory,
  type CommandMeta,
} from '../command-meta.js';

function formatCommand(meta: CommandMeta): string {
  const argLabel = meta.args.kind === 'none'
    ? ''
    : ` ${meta.args.placeholder}`;
  const aliasLabel = meta.aliases?.length
    ? `, /${meta.aliases.join(', /')}`
    : '';
  const cmd = `/${meta.command}${aliasLabel}${argLabel}`;
  return `  ${chalk.cyan(cmd.padEnd(26))}${meta.description}`;
}

export function handleHelp(): void {
  const categories: CommandCategory[] = ['debate', 'session', 'management'];
  const lines: string[] = [''];

  for (const cat of categories) {
    lines.push(chalk.bold.yellow(CATEGORY_LABELS[cat]));

    const isDebate = cat === 'debate';
    if (isDebate) {
      lines.push(`  ${chalk.cyan('<topic>'.padEnd(26))}Start a debate on the topic`);
    }

    for (const meta of COMMAND_REGISTRY.filter((m) => m.category === cat)) {
      lines.push(formatCommand(meta));
    }

    lines.push('');
  }

  console.log(lines.join('\n'));
}
