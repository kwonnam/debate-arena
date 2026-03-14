import type { EvidenceSnapshot } from '../news/snapshot.js';
import type { DebateParticipant } from './roles.js';

export type { EvidenceSnapshot };

export type ProviderName = string;

export type ParticipantName = string | 'user';

export type OutputFormat = 'pretty' | 'json' | 'markdown';

export type JudgeOption = ProviderName | 'both';

export type DebateMode = 'debate' | 'discussion' | 'plan';

export type NewsMode = 'unified' | 'split';

export type ApplyTarget = ProviderName | 'both';

export type WorkflowKind = 'news' | 'project' | 'general';

export interface DebateAttachment {
  name: string;
  kind: 'text' | 'image';
  mimeType: string;
  content: string;
}

export interface PreviousDebateParticipant {
  label: string;
  provider: ProviderName;
}

export interface PreviousDebateContext {
  sourceSessionId: string;
  question: string;
  judge?: string;
  participants: PreviousDebateParticipant[];
  synthesis?: string;
  latestRoundState?: DebateRoundState;
}

export interface DebateRoundState {
  round: number;
  summary: string;
  keyIssues: string[];
  agreements: string[];
  nextFocus: string[];
  shouldSuggestStop: boolean;
  stopReason?: string;
  source: 'judge' | 'fallback';
  transcriptFallbackUsed: boolean;
  warning?: string;
}

export interface DebateOptions {
  sessionId?: string;
  question: string;
  rounds: number;
  stream: boolean;
  synthesis: boolean;
  judge: JudgeOption;
  format: OutputFormat;
  projectContext?: string;
  mode?: DebateMode;
  interactive?: boolean;
  participants?: Array<ProviderName | DebateParticipant>;
  signal?: AbortSignal;
  executionCwd?: string;
  noContext?: boolean;
  attachments?: DebateAttachment[];
  snapshot?: EvidenceSnapshot;
  newsMode?: NewsMode;
  workflowKind?: WorkflowKind;
  ollamaModel?: string;
  previousDebate?: PreviousDebateContext;
  initialMessages?: DebateMessage[];
  initialRoundStates?: DebateRoundState[];
  resumeFromRound?: number;
  resumeFromSessionId?: string;
  resumeStage?: string;
  continuedFromSessionId?: string;
}

export interface DebateMessage {
  participantId: string;
  label: string;
  provider: ProviderName | 'user';
  round: number;
  phase: 'opening' | 'rebuttal';
  content: string;
}

export interface DebateResult {
  question: string;
  messages: DebateMessage[];
  roundStates: DebateRoundState[];
  synthesis: string | null;
  rounds: number;
  mode: DebateMode;
}

export interface DebateCallbacks {
  onRoundStart(round: number, total: number): void;
  onTurnStart(participant: DebateParticipant, phase: 'opening' | 'rebuttal'): void;
  onToken(participant: DebateParticipant, token: string): void;
  onTurnEnd(participant: DebateParticipant, content: string): void;
  onSynthesisStart(): void;
  onSynthesisToken(token: string): void;
  onSynthesisEnd(content: string): void;
  onRetry(participant: DebateParticipant, attempt: number, maxAttempts: number, error: Error): void;
  onUserTurnStart?(): void;
  onUserTurnEnd?(content: string): void;
  onUserInput?(): Promise<string>;
}
