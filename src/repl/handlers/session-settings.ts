import chalk from 'chalk';
import type { JudgeOption, OutputFormat, ProviderName } from '../../types/debate.js';
import type { SessionState } from '../session.js';
import { updateSession } from '../session.js';

export type SessionUpdateResult =
  | { updated: true; state: SessionState; message: string }
  | { updated: false; message: string };

export function handleRounds(args: string, state: SessionState): SessionUpdateResult {
  const n = parseInt(args, 10);
  if (isNaN(n) || n < 1 || n > 20) {
    return { updated: false, message: 'Usage: /rounds <1-20>' };
  }
  return {
    updated: true,
    state: updateSession(state, { rounds: n }),
    message: `Rounds set to ${chalk.bold(String(n))}`,
  };
}

const PROVIDER_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,62}$/i;

export function handleJudge(args: string, state: SessionState): SessionUpdateResult {
  const judge = args.trim().toLowerCase();
  if (!judge) {
    return { updated: false, message: 'Usage: /judge <provider-id|both>' };
  }
  if (judge !== 'both' && !PROVIDER_ID_PATTERN.test(judge)) {
    return { updated: false, message: 'Judge must be a provider id (letters/numbers/._-)' };
  }
  return {
    updated: true,
    state: updateSession(state, { judge: judge as JudgeOption }),
    message: `Judge set to ${chalk.bold(judge)}`,
  };
}

const VALID_FORMATS: readonly OutputFormat[] = ['pretty', 'json', 'markdown'];

export function handleFormat(args: string, state: SessionState): SessionUpdateResult {
  const format = args.toLowerCase() as OutputFormat;
  if (!VALID_FORMATS.includes(format)) {
    return { updated: false, message: `Usage: /format <${VALID_FORMATS.join('|')}>` };
  }
  return {
    updated: true,
    state: updateSession(state, { format }),
    message: `Format set to ${chalk.bold(format)}`,
  };
}

export function handleStream(state: SessionState): SessionUpdateResult {
  const stream = !state.stream;
  return {
    updated: true,
    state: updateSession(state, { stream }),
    message: `Streaming ${stream ? chalk.green('enabled') : chalk.red('disabled')}`,
  };
}

export function handleFiles(args: string, state: SessionState): SessionUpdateResult {
  if (!args) {
    if (state.files.length === 0) {
      return { updated: false, message: 'No context files set. Usage: /files <path1> [path2] ...' };
    }
    return { updated: false, message: `Context files: ${state.files.join(', ')}` };
  }
  const files = args.split(/\s+/).filter(Boolean);
  return {
    updated: true,
    state: updateSession(state, { files }),
    message: `Context files: ${chalk.bold(files.join(', '))}`,
  };
}

export function handleNoContext(state: SessionState): SessionUpdateResult {
  const noContext = !state.noContext;
  return {
    updated: true,
    state: updateSession(state, { noContext }),
    message: `Project context collection ${noContext ? chalk.red('disabled') : chalk.green('enabled')}`,
  };
}

export function handleOutput(args: string, state: SessionState): SessionUpdateResult {
  const trimmed = args.trim();
  if (trimmed === '' || trimmed === 'reset' || trimmed === 'off') {
    return {
      updated: true,
      state: updateSession(state, { output: undefined }),
      message: 'File output disabled',
    };
  }
  return {
    updated: true,
    state: updateSession(state, { output: trimmed }),
    message: `Debate will be saved to ${chalk.bold(trimmed)}`,
  };
}

export function handleParticipants(args: string, state: SessionState): SessionUpdateResult {
  if (args.trim() === 'reset') {
    return {
      updated: true,
      state: updateSession(state, { participants: undefined }),
      message: `Participants reset to default (${chalk.bold('codex')} vs ${chalk.bold('claude')})`,
    };
  }

  const parts = args.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (parts.length !== 2) {
    return { updated: false, message: 'Usage: /participants <p1> <p2> | reset  (e.g. codex ollama-local)' };
  }

  const [p1, p2] = parts;
  if (!PROVIDER_ID_PATTERN.test(p1) || !PROVIDER_ID_PATTERN.test(p2)) {
    return { updated: false, message: 'Provider ids must use letters/numbers/._-' };
  }
  if (p1 === p2) {
    return { updated: false, message: 'Participants must be different providers' };
  }

  const participants: [ProviderName, ProviderName] = [p1 as ProviderName, p2 as ProviderName];
  return {
    updated: true,
    state: updateSession(state, { participants }),
    message: `Participants set to ${chalk.bold(p1)} vs ${chalk.bold(p2)}`,
  };
}
