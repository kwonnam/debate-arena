import { Command } from 'commander';
import { registerDebateCommand } from './commands/debate.js';
import { registerConfigCommand } from './commands/config.js';
import { registerStatusCommand } from './commands/status.js';
import { registerStopCommand } from './commands/stop.js';
import { registerModelCommand } from './commands/model.js';

declare const PKG_VERSION: string;

export function createProgram(): Command {
  const program = new Command();

  program
    .name('fight-for-me')
    .description('AI Debate CLI - Codex vs Claude multi-round debates')
    .version(PKG_VERSION);

  registerDebateCommand(program);
  registerConfigCommand(program);
  registerStatusCommand(program);
  registerStopCommand(program);
  registerModelCommand(program);

  return program;
}
