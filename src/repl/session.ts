import type { JudgeOption, OutputFormat, ProviderName } from '../types/debate.js';
import type { EvidenceSnapshot } from '../news/snapshot.js';

export interface SessionState {
  readonly rounds: number;
  readonly judge: JudgeOption;
  readonly format: OutputFormat;
  readonly stream: boolean;
  readonly files: readonly string[];
  readonly noContext: boolean;
  readonly participants?: readonly [ProviderName, ProviderName];
  readonly output?: string;
  readonly snapshot?: EvidenceSnapshot;
  readonly newsQuiet?: boolean;
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
