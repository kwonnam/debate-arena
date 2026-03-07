import type { AIProvider, Message } from '../providers/types.js';
import type { DebateMessage, DebateRoundState } from '../types/debate.js';
import { buildRoundStatePrompt } from './prompt-builder.js';

export class RoundStateExtractor {
  constructor(private readonly provider: AIProvider) {}

  async extract(question: string, messages: DebateMessage[], round: number): Promise<DebateRoundState> {
    const debateLog = messages.map((message) => ({
      label: message.label,
      round: message.round,
      content: message.content,
    }));
    const prompt = buildRoundStatePrompt(question, round, debateLog);
    const apiMessages: Message[] = [{ role: 'user', content: prompt }];
    const raw = await this.provider.generate(apiMessages);
    const parsed = parseRoundState(raw, round);
    if (!parsed) {
      throw new Error('Round state extraction returned an unparseable response');
    }
    return parsed;
  }
}

export function parseRoundState(raw: string, round: number): DebateRoundState | null {
  const normalized = raw.replace(/\r\n/g, '\n').trim();
  if (!normalized) return null;

  const summary = extractInlineValue(normalized, 'SUMMARY');
  const keyIssues = extractBullets(normalized, 'ISSUES');
  const agreements = extractBullets(normalized, 'AGREEMENTS');
  const nextFocus = extractBullets(normalized, 'NEXT_FOCUS');
  const stopSuggested = extractInlineValue(normalized, 'STOP_SUGGESTED');
  const stopReason = extractInlineValue(normalized, 'STOP_REASON');

  const hasStructuredSignal =
    normalized.includes('SUMMARY:') ||
    normalized.includes('ISSUES:') ||
    normalized.includes('AGREEMENTS:') ||
    normalized.includes('NEXT_FOCUS:');

  if (!hasStructuredSignal) return null;

  return {
    round,
    summary: summary || fallbackSummary(normalized),
    keyIssues,
    agreements,
    nextFocus,
    shouldSuggestStop: /^y(es)?$/i.test(stopSuggested ?? ''),
    stopReason: stopReason && stopReason.toLowerCase() !== 'none' ? stopReason : undefined,
    source: 'judge',
    transcriptFallbackUsed: false,
  };
}

export function buildFallbackRoundState(messages: DebateMessage[], round: number, warning?: string): DebateRoundState {
  const snippets = messages
    .map((message) => `${message.label}: ${compactText(message.content, 180)}`)
    .join(' | ');

  return {
    round,
    summary: compactText(snippets || 'Round completed without a reusable summary.', 320),
    keyIssues: messages.map((message) => `${message.label} position: ${compactText(message.content, 120)}`),
    agreements: [],
    nextFocus: ['Address the strongest unresolved disagreements from the latest round.'],
    shouldSuggestStop: false,
    source: 'fallback',
    transcriptFallbackUsed: true,
    warning,
  };
}

function extractInlineValue(raw: string, label: string): string | undefined {
  const match = raw.match(new RegExp(`^${label}:\\s*(.+)$`, 'im'));
  return match?.[1]?.trim() || undefined;
}

function extractBullets(raw: string, label: string): string[] {
  const lines = raw.split('\n');
  const start = lines.findIndex((line) => line.trim().toUpperCase() === `${label}:`);
  if (start === -1) return [];

  const items: string[] = [];
  for (let index = start + 1; index < lines.length; index++) {
    const line = lines[index].trim();
    if (!line) {
      if (items.length > 0) break;
      continue;
    }
    if (/^[A-Z_]+:/.test(line)) break;
    if (line.startsWith('- ')) {
      items.push(line.slice(2).trim());
    }
  }
  return items;
}

function fallbackSummary(raw: string): string {
  return compactText(raw.split('\n').filter(Boolean)[0] ?? raw, 240);
}

function compactText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}
