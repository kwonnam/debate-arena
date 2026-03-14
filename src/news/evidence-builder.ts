import type { NewsProvider, SearchOptions } from './providers/types.js';
import type { EvidenceKind, EvidenceSnapshot, NewsArticle } from './snapshot.js';
import { createSnapshotId, normalizeEvidenceKind } from './snapshot.js';
import type { SearchPlan, SearchQueryVariant } from './search-plan.js';

export class EvidenceBuilder {
  constructor(private providers: NewsProvider[]) {}

  async build(
    query: string,
    options?: SearchOptions & { deduplication?: boolean; searchPlan?: SearchPlan; kind?: EvidenceKind },
  ): Promise<EvidenceSnapshot> {
    const maxArticles = options?.maxArticles ?? 10;
    const deduplication = options?.deduplication ?? true;
    const kind = normalizeEvidenceKind(options?.kind);
    const searchQueries = resolveSearchQueries(query, options);

    // 1. 모든 provider에서 병렬 수집
    const results = await Promise.allSettled(
      searchQueries.flatMap((searchQuery) =>
        this.providers.map((provider) =>
          provider.search(searchQuery.query, {
            maxArticles,
            freshness: options?.freshness,
            language: searchQuery.language ?? options?.language,
          }),
        ),
      ),
    );

    const allArticles: NewsArticle[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        allArticles.push(...result.value);
      }
    }

    // 2. URL 기준 중복 제거 (deduplication 플래그에 따라)
    let unique: NewsArticle[];
    let excludedCount: number;
    if (deduplication) {
      const seen = new Set<string>();
      unique = [];
      for (const article of allArticles) {
        if (!seen.has(article.url)) {
          seen.add(article.url);
          unique.push(article);
        }
      }
      excludedCount = allArticles.length - unique.length;
    } else {
      unique = allArticles;
      excludedCount = 0;
    }

    // 3. relevanceScore 내림차순 정렬, 상위 N개
    const sorted = unique
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxArticles);

    // 4. SHA-256 해시 ID
    const id = createSnapshotId(query, sorted.map((a) => a.url), kind);

    return {
      id,
      kind,
      query,
      collectedAt: new Date().toISOString(),
      sources: this.providers.map((p) => p.name),
      articles: sorted,
      excludedCount,
      searchPlan: options?.searchPlan ?? {
        detectedLanguage: options?.language === 'ko' || options?.language === 'en' ? options.language : 'other',
        llmApplied: false,
        queries: searchQueries,
      },
    };
  }
}

function resolveSearchQueries(
  query: string,
  options?: SearchOptions & { searchPlan?: SearchPlan },
): SearchQueryVariant[] {
  const fromPlan = options?.searchPlan?.queries
    ?.map((item) => ({
      query: String(item.query ?? '').trim(),
      language: item.language,
      source: item.source ?? 'original',
    }))
    .filter((item) => Boolean(item.query));

  if (fromPlan && fromPlan.length > 0) {
    return dedupeQueries(fromPlan);
  }

  return [{
    query,
    language: options?.language === 'ko' || options?.language === 'en' ? options.language : undefined,
    source: 'original',
  }];
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
