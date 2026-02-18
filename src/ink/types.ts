import type { DebateMode } from '../types/debate.js';

export type PromptResult =
  | { readonly kind: 'line'; readonly line: string }
  | { readonly kind: 'slash'; readonly command: string; readonly args: string }
  | { readonly kind: 'empty' }
  | { readonly kind: 'interrupt' }
  | { readonly kind: 'eof' }
  | { readonly kind: 'mode-toggle' };

export interface SessionDisplayInfo {
  readonly rounds: number;
  readonly judge: string;
  readonly format: string;
  readonly stream: boolean;
}

export interface CommandItem {
  readonly command: string;
  readonly description: string;
  readonly args:
    | { readonly kind: 'none' }
    | { readonly kind: 'required'; readonly placeholder: string }
    | { readonly kind: 'optional'; readonly placeholder: string };
  readonly aliases?: readonly string[];
  readonly getCompletions?: (input: string) => readonly string[];
}

export interface PromptConfig {
  readonly commands: readonly CommandItem[];
  readonly session?: SessionDisplayInfo;
  readonly debateMode: DebateMode;
}
