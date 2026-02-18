import type { JudgeOption, OutputFormat } from '../types/debate.js';

export interface SessionState {
  readonly rounds: number;
  readonly judge: JudgeOption;
  readonly format: OutputFormat;
  readonly stream: boolean;
  readonly files: readonly string[];
  readonly noContext: boolean;
}

export function createDefaultSession(overrides?: Partial<SessionState>): SessionState {
  return {
    rounds: 3,
    judge: 'claude',
    format: 'pretty',
    stream: true,
    files: [],
    noContext: false,
    ...overrides,
  };
}

export function updateSession(
  state: SessionState,
  patch: Partial<SessionState>,
): SessionState {
  return { ...state, ...patch };
}
