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
}

export const CATEGORY_LABELS: Record<CommandCategory, string> = {
  debate: 'Debate Commands',
  session: 'Session Settings',
  management: 'Management',
};

export const COMMAND_REGISTRY: readonly CommandMeta[] = [
  // Debate
  {
    command: 'plan',
    description: 'Plan mode (토론 후 구현 적용 제안)',
    category: 'debate',
    args: { kind: 'required', placeholder: '<topic>' },
  },
  {
    command: 'i',
    description: 'Interactive 3-way debate (You + Codex + Claude)',
    category: 'debate',
    args: { kind: 'required', placeholder: '<topic>' },
  },
  {
    command: 'apply',
    description: 'Debate then apply code changes',
    category: 'debate',
    args: { kind: 'required', placeholder: '<topic>' },
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
    description: 'Set judge: codex, claude, both',
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
    description: 'Set context files',
    category: 'session',
    args: { kind: 'required', placeholder: '<paths...>' },
  },
  {
    command: 'nocontext',
    description: 'Toggle project context collection',
    category: 'session',
    args: { kind: 'none' },
  },

  // Management
  {
    command: 'config',
    description: 'Manage persistent configuration',
    category: 'management',
    args: { kind: 'optional', placeholder: '[list|set|get]' },
  },
  {
    command: 'model',
    description: 'Select agent model',
    category: 'management',
    args: { kind: 'optional', placeholder: '[codex|claude]' },
  },
  {
    command: 'status',
    description: 'Check agent CLI status',
    category: 'management',
    args: { kind: 'none' },
  },
  {
    command: 'stop',
    description: 'Stop running fight-for-me processes',
    category: 'management',
    args: { kind: 'none' },
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
