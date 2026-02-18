export type ParsedCommand =
  | { kind: 'debate'; topic: string; mode: 'debate' }
  | { kind: 'debate'; topic: string; mode: 'plan' }
  | { kind: 'debate'; topic: string; mode: 'interactive' }
  | { kind: 'slash'; command: string; args: string }
  | { kind: 'empty' };

const DEBATE_ALIASES: Record<string, ParsedCommand['kind'] extends 'debate' ? ParsedCommand['mode'] : never> = {
  '/plan': 'plan',
  '/i': 'interactive',
};

export function parseInput(raw: string): ParsedCommand {
  const trimmed = raw.trim();
  if (trimmed === '') return { kind: 'empty' };

  if (!trimmed.startsWith('/')) {
    return { kind: 'debate', topic: trimmed, mode: 'debate' };
  }

  const spaceIdx = trimmed.indexOf(' ');
  const command = spaceIdx === -1 ? trimmed.toLowerCase() : trimmed.slice(0, spaceIdx).toLowerCase();
  const args = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1).trim();

  const debateMode = DEBATE_ALIASES[command];
  if (debateMode) {
    if (!args) {
      return { kind: 'slash', command: command.slice(1), args: '' };
    }
    return { kind: 'debate', topic: args, mode: debateMode };
  }

  return { kind: 'slash', command: command.slice(1), args };
}
