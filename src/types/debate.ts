import type { EvidenceSnapshot } from '../news/snapshot.js';

export type { EvidenceSnapshot };

export type ProviderName = string;

export type ParticipantName = ProviderName | 'user';

export type OutputFormat = 'pretty' | 'json' | 'markdown';

export type JudgeOption = ProviderName | 'both';

export type DebateMode = 'debate' | 'plan';

export type ApplyTarget = ProviderName | 'both';

export interface DebateAttachment {
  name: string;
  kind: 'text' | 'image';
  mimeType: string;
  content: string;
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
  participants?: [ProviderName, ProviderName];
  signal?: AbortSignal;
  executionCwd?: string;
  attachments?: DebateAttachment[];
  snapshot?: EvidenceSnapshot;
}

export interface DebateMessage {
  provider: ParticipantName;
  round: number;
  phase: 'opening' | 'rebuttal';
  content: string;
}

export interface DebateResult {
  question: string;
  messages: DebateMessage[];
  synthesis: string | null;
  rounds: number;
}

export interface DebateCallbacks {
  onRoundStart(round: number, total: number): void;
  onTurnStart(provider: ProviderName, phase: 'opening' | 'rebuttal'): void;
  onToken(provider: ProviderName, token: string): void;
  onTurnEnd(provider: ProviderName, content: string): void;
  onSynthesisStart(): void;
  onSynthesisToken(token: string): void;
  onSynthesisEnd(content: string): void;
  onRetry(provider: ProviderName, attempt: number, maxAttempts: number, error: Error): void;
  onUserTurnStart?(): void;
  onUserTurnEnd?(content: string): void;
  onUserInput?(): Promise<string>;
}
