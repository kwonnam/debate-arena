import type { NewsProvider, SearchOptions } from './providers/types.js';
import type { EvidenceSnapshot, NewsArticle } from './snapshot.js';
import { createSnapshotId } from './snapshot.js';

export class EvidenceBuilder {
  constructor(private providers: NewsProvider[]) {}

  async build(query: string, options?: SearchOptions & { deduplication?: boolean }): Promise<EvidenceSnapshot> {
    const maxArticles = options?.maxArticles ?? 10;
    const deduplication = options?.deduplication ?? true;

    // 1. 모든 provider에서 병렬 수집
    const results = await Promise.allSettled(
      this.providers.map((p) => p.search(query, options))
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
    const id = createSnapshotId(query, sorted.map((a) => a.url));

    return {
      id,
      query,
      collectedAt: new Date().toISOString(),
      sources: this.providers.map((p) => p.name),
      articles: sorted,
      excludedCount,
    };
  }
}
