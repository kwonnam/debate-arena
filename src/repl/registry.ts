import type { SessionState } from './session.js';
import { handleHelp } from './handlers/help.js';
import { handleExit } from './handlers/exit.js';
import { handleConfig } from './handlers/config.js';
import { handleStatus } from './handlers/status.js';
import { handleStop } from './handlers/stop.js';
import { handleModel } from './handlers/model.js';
import { handleDebate } from './handlers/debate.js';
import {
  handleRounds,
  handleJudge,
  handleFormat,
  handleStream,
  handleFiles,
  handleNoContext,
  type SessionUpdateResult,
} from './handlers/session-settings.js';

export interface CommandContext {
  session: SessionState;
}

export interface CommandResult {
  session: SessionState;
}

type CommandHandler = (
  args: string,
  ctx: CommandContext,
) => CommandResult | Promise<CommandResult>;

function wrapVoid(fn: (args: string) => void | Promise<void>): CommandHandler {
  return async (args, ctx) => {
    await fn(args);
    return { session: ctx.session };
  };
}

function applySessionUpdate(result: SessionUpdateResult, ctx: CommandContext): CommandResult {
  console.log(`  ${result.message}`);
  return { session: result.updated ? result.state : ctx.session };
}

const DEBATE_SLASH_MODES: Record<string, 'plan' | 'interactive'> = {
  plan: 'plan',
  join: 'interactive',
  i: 'interactive',
};

const handlers = new Map<string, CommandHandler>();

handlers.set('help', wrapVoid(() => handleHelp()));
handlers.set('exit', wrapVoid(() => handleExit()));
handlers.set('quit', wrapVoid(() => handleExit()));
handlers.set('config', wrapVoid((args) => handleConfig(args)));
handlers.set('status', wrapVoid(() => handleStatus()));
handlers.set('stop', wrapVoid((args) => handleStop(args)));
handlers.set('model', wrapVoid((args) => handleModel(args)));

handlers.set('rounds', (args, ctx) => applySessionUpdate(handleRounds(args, ctx.session), ctx));
handlers.set('judge', (args, ctx) => applySessionUpdate(handleJudge(args, ctx.session), ctx));
handlers.set('format', (args, ctx) => applySessionUpdate(handleFormat(args, ctx.session), ctx));
handlers.set('stream', (_args, ctx) => applySessionUpdate(handleStream(ctx.session), ctx));
handlers.set('files', (args, ctx) => applySessionUpdate(handleFiles(args, ctx.session), ctx));
handlers.set('context', (_args, ctx) => applySessionUpdate(handleNoContext(ctx.session), ctx));
handlers.set('nocontext', (_args, ctx) => applySessionUpdate(handleNoContext(ctx.session), ctx));

for (const cmd of Object.keys(DEBATE_SLASH_MODES)) {
  handlers.set(cmd, wrapVoid((args) => {
    if (!args) {
      console.log(`Usage: /${cmd} <topic>`);
    }
  }));
}

export function getHandler(command: string): CommandHandler | undefined {
  return handlers.get(command);
}

export function isDebateCommand(command: string): boolean {
  return command in DEBATE_SLASH_MODES;
}

export async function runDebateFromSlash(
  command: string,
  args: string,
  ctx: CommandContext,
): Promise<CommandResult> {
  await handleDebate(args, DEBATE_SLASH_MODES[command], ctx.session);
  return { session: ctx.session };
}
