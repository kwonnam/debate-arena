import type { EvidenceSnapshot } from '../news/snapshot.js';
import type { AIProvider, Message } from '../providers/types.js';
import type { TelegramResponseLanguage } from './stock-utils.js';

export interface TelegramVerdictNewsItem {
  source: string;
  date: string;
  headline: string;
}

export interface TelegramVerdictSummary {
  answer: string;
  verdict?: string;
  horizon?: string;
  confidence?: string;
  thesis: string[];
  risks: string[];
  news: TelegramVerdictNewsItem[];
}

function truncateText(value: string, maxLength: number): string {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function buildFallbackSummary(
  synthesis: string,
  snapshot?: EvidenceSnapshot,
): TelegramVerdictSummary {
  const answer = truncateText(synthesis, 700);
  const news = (snapshot?.articles ?? []).slice(0, 3).map((article) => ({
    source: article.source,
    date: article.publishedAt.slice(0, 10),
    headline: article.title,
  }));

  return {
    answer,
    thesis: [],
    risks: [],
    news,
  };
}

function sanitizeStringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => truncateText(String(item ?? ''), maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function sanitizeNewsItems(value: unknown, fallbackSnapshot?: EvidenceSnapshot): TelegramVerdictNewsItem[] {
  if (!Array.isArray(value)) {
    return buildFallbackSummary('', fallbackSnapshot).news;
  }

  const items = value
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item) => ({
      source: truncateText(String(item.source ?? ''), 60),
      date: truncateText(String(item.date ?? ''), 16),
      headline: truncateText(String(item.headline ?? ''), 180),
    }))
    .filter((item) => item.source || item.headline)
    .slice(0, 3);

  if (items.length > 0) {
    return items;
  }

  return buildFallbackSummary('', fallbackSnapshot).news;
}

function extractJsonBlock(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }

  const fencedMatch = trimmed.match(/```json\s*([\s\S]*?)```/i) ?? trimmed.match(/```\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return null;
}

function parseSummary(raw: string, fallback: TelegramVerdictSummary): TelegramVerdictSummary {
  const jsonBlock = extractJsonBlock(raw);
  if (!jsonBlock) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(jsonBlock) as Record<string, unknown>;
    const answer = truncateText(String(parsed.answer ?? fallback.answer), 700);

    return {
      answer: answer || fallback.answer,
      verdict: truncateText(String(parsed.verdict ?? ''), 80) || fallback.verdict,
      horizon: truncateText(String(parsed.horizon ?? ''), 80) || fallback.horizon,
      confidence: truncateText(String(parsed.confidence ?? ''), 80) || fallback.confidence,
      thesis: sanitizeStringArray(parsed.thesis, 3, 180),
      risks: sanitizeStringArray(parsed.risks, 3, 180),
      news: sanitizeNewsItems(parsed.news, undefined),
    };
  } catch {
    return fallback;
  }
}

function buildPrompt(input: {
  question: string;
  templateLabel: string;
  language: TelegramResponseLanguage;
  synthesis: string;
  snapshot?: EvidenceSnapshot;
}): Message[] {
  const evidenceLines = (input.snapshot?.articles ?? [])
    .slice(0, 5)
    .map((article) => (
      `- [${article.source}] ${article.title} (${article.publishedAt})\n` +
      `  Summary: ${article.summary}`
    ))
    .join('\n');

  const languageLabel = input.language === 'ko' ? 'Korean' : 'English';

  return [
    {
      role: 'system',
      content: [
        'You are a Telegram stock debate summarizer.',
        'Return JSON only.',
        'Do not mention the debate process, rounds, or speaker-by-speaker arguments.',
        'Summarize only the final investment conclusion and the evidence-backed reasons.',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `Question: ${input.question}`,
        `Template: ${input.templateLabel}`,
        `Response language: ${languageLabel}`,
        '',
        'Final synthesis:',
        input.synthesis,
        '',
        'Evidence snapshot:',
        evidenceLines || '- No external evidence available',
        '',
        'Return one JSON object with this exact shape:',
        '{',
        '  "answer": "2-4 sentence final conclusion for the user",',
        '  "verdict": "bullish|bearish|neutral|mixed or equivalent phrasing",',
        '  "horizon": "short-term|mid-term|long-term|mixed or equivalent phrasing",',
        '  "confidence": "high|medium|low or equivalent phrasing",',
        '  "thesis": ["up to 3 concise supporting points"],',
        '  "risks": ["up to 3 concise risk points"],',
        '  "news": [',
        '    { "source": "Reuters", "date": "2026-03-17", "headline": "..." }',
        '  ]',
        '}',
      ].join('\n'),
    },
  ];
}

export async function summarizeTelegramVerdict(input: {
  provider: AIProvider;
  question: string;
  templateLabel: string;
  language: TelegramResponseLanguage;
  synthesis: string;
  snapshot?: EvidenceSnapshot;
}): Promise<TelegramVerdictSummary> {
  const fallback = buildFallbackSummary(input.synthesis, input.snapshot);
  const raw = await input.provider.generate(buildPrompt(input));
  const parsed = parseSummary(raw, fallback);

  return {
    ...parsed,
    thesis: parsed.thesis.length > 0 ? parsed.thesis : fallback.thesis,
    risks: parsed.risks.length > 0 ? parsed.risks : fallback.risks,
    news: parsed.news.length > 0 ? parsed.news : fallback.news,
  };
}

export function parseTelegramVerdictSummary(raw: string, fallback: TelegramVerdictSummary): TelegramVerdictSummary {
  return parseSummary(raw, fallback);
}
