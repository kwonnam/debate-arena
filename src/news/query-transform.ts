import { loadConfigV2 } from '../config/manager.js';
import { createProviderMap, listProviderOptions } from '../providers/factory.js';
import type { AIProvider, Message } from '../providers/types.js';
import type {
  DetectedSearchLanguage,
  QueryTransformMode,
  QueryTransformOptions,
  SearchLanguageScope,
  SearchPlan,
  SearchQueryLanguage,
  SearchQueryVariant,
} from './search-plan.js';

interface QueryTransformResponse {
  detectedLanguage?: string;
  queries?: Array<{
    language?: string;
    query?: string;
  }>;
}

const HANGUL_REGEX = /[\uac00-\ud7a3]/g;
const LATIN_REGEX = /[A-Za-z]/g;

export function detectQueryLanguage(query: string): DetectedSearchLanguage {
  const hangulMatches = query.match(HANGUL_REGEX)?.length ?? 0;
  const latinMatches = query.match(LATIN_REGEX)?.length ?? 0;

  if (hangulMatches === 0 && latinMatches === 0) {
    return 'other';
  }
  if (hangulMatches >= latinMatches) {
    return 'ko';
  }
  return 'en';
}

export async function buildSearchPlan(
  query: string,
  options?: QueryTransformOptions,
  deps?: { provider?: AIProvider | null },
): Promise<SearchPlan> {
  const normalizedQuery = query.trim();
  const scope = options?.scope === 'web' ? 'web' : 'news';
  const mode: QueryTransformMode = options?.mode === 'expand' ? 'expand' : 'off';
  const languageScope: SearchLanguageScope = isSearchLanguageScope(options?.languageScope)
    ? options.languageScope
    : 'input';
  const detectedLanguage = detectQueryLanguage(normalizedQuery);
  const targetLanguages = resolveTargetLanguages(detectedLanguage, languageScope);
  const fallbackQueries = buildFallbackQueries(normalizedQuery, targetLanguages);
  const needsLlm = mode === 'expand'
    || targetLanguages.some((language) => language !== detectedLanguage);

  if (!needsLlm) {
    return {
      detectedLanguage,
      llmApplied: false,
      queries: fallbackQueries,
    };
  }

  const provider = deps?.provider ?? resolveQueryTransformProvider(options?.provider);
  if (!provider) {
    return {
      detectedLanguage,
      llmApplied: false,
      queries: fallbackQueries,
    };
  }

  try {
    const raw = await provider.generate(
      buildTransformMessages(normalizedQuery, detectedLanguage, targetLanguages, mode, scope),
    );
    const parsed = parseTransformResponse(raw);
    const llmDetectedLanguage = normalizeDetectedLanguage(parsed.detectedLanguage) ?? detectedLanguage;
    const normalizedQueries = normalizeLlmQueries(
      parsed.queries,
      normalizedQuery,
      llmDetectedLanguage,
      targetLanguages,
      mode,
    );

    if (normalizedQueries.length === 0) {
      return {
        detectedLanguage,
        llmApplied: false,
        queries: fallbackQueries,
      };
    }

    return {
      detectedLanguage: llmDetectedLanguage,
      llmApplied: true,
      queries: normalizedQueries,
    };
  } catch {
    return {
      detectedLanguage,
      llmApplied: false,
      queries: fallbackQueries,
    };
  }
}

function isSearchLanguageScope(value: unknown): value is SearchLanguageScope {
  return value === 'input' || value === 'ko' || value === 'en' || value === 'both';
}

function resolveTargetLanguages(
  detectedLanguage: DetectedSearchLanguage,
  languageScope: SearchLanguageScope,
): SearchQueryLanguage[] {
  if (languageScope === 'ko') return ['ko'];
  if (languageScope === 'en') return ['en'];
  if (languageScope === 'both') {
    if (detectedLanguage === 'ko') return ['ko', 'en'];
    if (detectedLanguage === 'en') return ['en', 'ko'];
    return ['en', 'ko'];
  }

  if (detectedLanguage === 'ko') return ['ko'];
  if (detectedLanguage === 'en') return ['en'];
  return ['en'];
}

function buildFallbackQueries(
  query: string,
  targetLanguages: SearchQueryLanguage[],
): SearchQueryVariant[] {
  return dedupeQueries(
    targetLanguages.map((language) => ({
      query,
      language,
      source: 'original' as const,
    })),
  );
}

function normalizeDetectedLanguage(value: unknown): DetectedSearchLanguage | undefined {
  if (value === 'ko' || value === 'en' || value === 'other') {
    return value;
  }
  return undefined;
}

function normalizeQueryLanguage(value: unknown): SearchQueryLanguage | undefined {
  if (value === 'ko' || value === 'en') {
    return value;
  }
  return undefined;
}

function normalizeLlmQueries(
  queries: QueryTransformResponse['queries'],
  originalQuery: string,
  detectedLanguage: DetectedSearchLanguage,
  targetLanguages: SearchQueryLanguage[],
  mode: QueryTransformMode,
): SearchQueryVariant[] {
  if (!Array.isArray(queries)) {
    return [];
  }

  const expectedLanguages = new Set<SearchQueryLanguage>(targetLanguages);
  const normalized: SearchQueryVariant[] = [];

  for (const entry of queries) {
    const query = typeof entry?.query === 'string' ? entry.query.trim() : '';
    if (!query) continue;

    let language = normalizeQueryLanguage(entry?.language);
    if (!language && targetLanguages.length === 1) {
      language = targetLanguages[0];
    }
    if (!language) continue;
    if (expectedLanguages.size > 0 && !expectedLanguages.has(language)) continue;

    const isOriginal = language === detectedLanguage && query === originalQuery;
    normalized.push({
      query,
      language,
      source: isOriginal
        ? 'original'
        : mode === 'expand'
          ? 'expanded'
          : 'translated',
    });
  }

  return dedupeQueries(normalized);
}

function dedupeQueries(queries: SearchQueryVariant[]): SearchQueryVariant[] {
  const seen = new Set<string>();
  const unique: SearchQueryVariant[] = [];

  for (const query of queries) {
    const normalizedQuery = query.query.trim();
    if (!normalizedQuery) continue;

    const key = `${query.language ?? 'auto'}::${normalizedQuery.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({
      ...query,
      query: normalizedQuery,
    });
  }

  return unique;
}

function buildTransformMessages(
  query: string,
  detectedLanguage: DetectedSearchLanguage,
  targetLanguages: SearchQueryLanguage[],
  mode: QueryTransformMode,
  scope: 'news' | 'web',
): Message[] {
  const transformRule = mode === 'expand'
    ? scope === 'web'
      ? 'Translate/adapt the query and add 1-3 high-signal web search keywords that improve recall without changing intent.'
      : 'Translate/adapt the query and add 1-3 high-signal news search keywords that improve recall without changing intent.'
    : 'Translate/adapt the query only. Do not add unrelated concepts or commentary.';
  const scopeRule = scope === 'web'
    ? '- Preserve technical nouns, versions, products, APIs, errors, regions, and dates when they matter.'
    : '- Preserve event, policy, company, region, and date terms that matter for recent reporting.';

  return [
    {
      role: 'system',
      content: [
        `You rewrite ${scope} search input into short search-engine queries.`,
        'Return JSON only.',
        'Schema: {"detectedLanguage":"ko|en|other","queries":[{"language":"ko|en","query":"..."}]}',
        'Rules:',
        '- Keep companies, products, people, regions, laws, and dates.',
        scopeRule,
        '- Each query must be a short search phrase, not a full sentence.',
        '- Each query should stay under 12 words when possible.',
        '- Do not include markdown, explanations, or extra keys.',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `Input query: ${JSON.stringify(query)}`,
        `Detected language hint: ${detectedLanguage}`,
        `Target languages: ${targetLanguages.join(', ')}`,
        `Scope: ${scope}`,
        `Mode: ${mode}`,
        transformRule,
      ].join('\n'),
    },
  ];
}

function parseTransformResponse(raw: string): QueryTransformResponse {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const candidate = fenced ?? trimmed;

  try {
    return JSON.parse(candidate) as QueryTransformResponse;
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1)) as QueryTransformResponse;
    }
    throw new Error('Invalid query transform response');
  }
}

function resolveQueryTransformProvider(preferredProvider?: string): AIProvider | null {
  const config = loadConfigV2();
  const availableProviders = listProviderOptions()
    .filter((provider) => provider.available)
    .map((provider) => provider.name);
  const candidates = uniqueStrings([
    preferredProvider?.trim(),
    config.defaultProvider?.trim(),
    'codex',
    'claude',
    'gemini',
    ...availableProviders,
  ]);

  for (const candidate of candidates) {
    try {
      const providers = createProviderMap([candidate], candidate);
      const provider = providers.get(candidate);
      if (provider) {
        return provider;
      }
    } catch {
      // Skip unavailable providers and keep trying the next candidate.
    }
  }

  return null;
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const value of values) {
    const normalized = value?.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(normalized);
  }

  return unique;
}
