import chalk from 'chalk';
import type { JudgeOption, OutputFormat } from '../../types/debate.js';
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

const VALID_JUDGES: readonly JudgeOption[] = ['codex', 'claude', 'both'];

export function handleJudge(args: string, state: SessionState): SessionUpdateResult {
  const judge = args.toLowerCase() as JudgeOption;
  if (!VALID_JUDGES.includes(judge)) {
    return { updated: false, message: `Usage: /judge <${VALID_JUDGES.join('|')}>` };
  }
  return {
    updated: true,
    state: updateSession(state, { judge }),
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
