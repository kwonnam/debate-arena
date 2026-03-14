import { getModelCompletions } from './handlers/model.js';

export type CommandCategory = 'debate' | 'session' | 'management';

export type ArgSpec =
  | { readonly kind: 'none' }
  | { readonly kind: 'required'; readonly placeholder: string }
  | { readonly kind: 'optional'; readonly placeholder: string };

export interface CommandMeta {
  readonly command: string;
  readonly description: string;
  readonly category: CommandCategory;
  readonly args: ArgSpec;
  readonly aliases?: readonly string[];
  readonly getCompletions?: (input: string) => readonly string[];
}

export const CATEGORY_LABELS: Record<CommandCategory, string> = {
  debate: 'Debate Modes',
  session: 'Session Settings',
  management: 'Management',
};

export const COMMAND_REGISTRY: readonly CommandMeta[] = [
  // Debate
  {
    command: 'plan',
    description: 'Debate & apply code changes',
    category: 'debate',
    args: { kind: 'required', placeholder: '<topic>' },
  },
  {
    command: 'join',
    description: 'Interactive 3-way debate (You + Codex + Claude)',
    category: 'debate',
    args: { kind: 'required', placeholder: '<topic>' },
    aliases: ['i'],
  },
  // Session
  {
    command: 'rounds',
    description: 'Set number of debate rounds',
    category: 'session',
    args: { kind: 'required', placeholder: '<n>' },
  },
  {
    command: 'judge',
    description: 'Set judge: <provider-id> or both',
    category: 'session',
    args: { kind: 'required', placeholder: '<provider>' },
  },
  {
    command: 'format',
    description: 'Output format: pretty, json, markdown',
    category: 'session',
    args: { kind: 'required', placeholder: '<format>' },
  },
  {
    command: 'stream',
    description: 'Toggle streaming output',
    category: 'session',
    args: { kind: 'none' },
  },
  {
    command: 'files',
    description: 'Set context files (replaces current)',
    category: 'session',
    args: { kind: 'required', placeholder: '<paths...>' },
  },
  {
    command: 'context',
    description: 'Toggle project context collection',
    category: 'session',
    args: { kind: 'none' },
    aliases: ['nocontext'],
  },
  {
    command: 'participants',
    description: 'Set debate participants by provider id: /participants <p1> <p2> or /participants reset',
    category: 'session',
    args: { kind: 'required', placeholder: '<p1> <p2> | reset' },
  },
  {
    command: 'output',
    description: 'Save debate to a markdown file: /output <path>  or /output reset',
    category: 'session',
    args: { kind: 'required', placeholder: '<path> | reset' },
  },

  // Management
  {
    command: 'news',
    description: 'Collect news evidence: /news [--expand] [--lang input|ko|en|both] <query>',
    category: 'management',
    args: { kind: 'required', placeholder: '<query>' },
  },
  {
    command: 'web',
    description: 'Collect general web evidence: /web [--expand] [--lang input|ko|en|both] <query>',
    category: 'management',
    args: { kind: 'required', placeholder: '<query>' },
  },
  {
    command: 'config',
    description: 'Manage persistent configuration',
    category: 'management',
    args: { kind: 'optional', placeholder: '[list|set|get]' },
  },
  {
    command: 'model',
    description: 'Set agent model',
    category: 'management',
    args: { kind: 'optional', placeholder: '<codex|claude|gemini> [model]' },
    getCompletions: getModelCompletions,
  },
  {
    command: 'status',
    description: 'Check agent CLI status',
    category: 'management',
    args: { kind: 'none' },
  },
  {
    command: 'dashboard',
    description: 'Start local dashboard server',
    category: 'management',
    args: { kind: 'none' },
  },
  {
    command: 'stop',
    description: 'Stop running processes or /stop team for local dashboard sessions',
    category: 'management',
    args: { kind: 'optional', placeholder: '[team|--dry-run|--force]' },
  },
  {
    command: 'help',
    description: 'Show this help',
    category: 'management',
    args: { kind: 'none' },
  },
  {
    command: 'exit',
    description: 'Exit the REPL',
    category: 'management',
    args: { kind: 'none' },
    aliases: ['quit'],
  },
];
