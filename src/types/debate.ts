export type ProviderName = 'codex' | 'claude';

export type OutputFormat = 'pretty' | 'json' | 'markdown';

export type JudgeOption = 'codex' | 'claude' | 'both';

export type DebateMode = 'debate' | 'plan';

export type ApplyTarget = ProviderName | 'both';

export interface DebateOptions {
  question: string;
  rounds: number;
  stream: boolean;
  synthesis: boolean;
  judge: JudgeOption;
  format: OutputFormat;
  projectContext?: string;
  mode?: DebateMode;
}

export interface DebateMessage {
  provider: ProviderName;
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
}
