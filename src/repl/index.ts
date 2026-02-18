import chalk from 'chalk';
import { showBanner } from '../ui/banner.js';
import { loadConfig } from '../config/manager.js';
import { parseInput, type ParsedCommand } from './parser.js';
import { createDefaultSession, type SessionState } from './session.js';
import { getHandler, isDebateCommand, runDebateFromSlash } from './registry.js';
import { handleDebate } from './handlers/debate.js';
import { inkPrompt } from '../ink/ink-prompt.js';
import { COMMAND_REGISTRY } from './command-meta.js';
import { resetTTYInputState } from './tty-state.js';
import type { CommandContext } from './registry.js';

declare const PKG_VERSION: string;

async function dispatchCommand(
  parsed: ParsedCommand,
  deps: { readonly session: SessionState },
): Promise<SessionState> {
  const { session } = deps;

  switch (parsed.kind) {
    case 'empty':
      return session;

    case 'debate': {
      await handleDebate(parsed.topic, parsed.mode, session);
      return session;
    }

    case 'slash': {
      const { command, args } = parsed;

      if (isDebateCommand(command) && args) {
        const result = await runDebateFromSlash(command, args, { session });
        return result.session;
      }

      const handler = getHandler(command);
      if (!handler) {
        console.log(chalk.yellow(`  Unknown command: /${command}. Type /help for available commands.`));
        return session;
      }

      const ctx: CommandContext = { session };
      const result = await handler(args, ctx);
      return result.session;
    }
  }
}

export async function startRepl(): Promise<void> {
  showBanner();
  console.log(chalk.dim(`  v${PKG_VERSION} Type /help for commands, /exit to quit.\n`));

  const config = loadConfig();
  let session = createDefaultSession({
    rounds: config.defaultRounds,
    judge: config.defaultJudge,
    format: config.defaultFormat,
    stream: config.stream,
  });

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = await inkPrompt({
      commands: COMMAND_REGISTRY,
      session: {
        rounds: session.rounds,
        judge: session.judge,
        format: session.format,
        stream: session.stream,
      },
    });

    try {
      switch (result.kind) {
        case 'empty':
        case 'interrupt':
          continue;

        case 'eof':
          console.log(chalk.dim('\nGoodbye!\n'));
          process.exit(0);
          break;

        case 'slash': {
          const line = result.args
            ? `/${result.command} ${result.args}`
            : `/${result.command}`;
          session = await dispatchCommand(parseInput(line), { session });
          continue;
        }

        case 'line': {
          session = await dispatchCommand(parseInput(result.line), { session });
          continue;
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unknown error occurred';
      console.error(`\n${chalk.red('Command error:')} ${message}\n`);
      resetTTYInputState();
    }
  }
}
