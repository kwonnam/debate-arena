import type { NewsArticle } from '../snapshot.js';
import type { NewsProvider, SearchOptions } from './types.js';

const BRAVE_NEWS_API = 'https://api.search.brave.com/res/v1/news/search';

const FRESHNESS_MAP: Record<NonNullable<SearchOptions['freshness']>, string> = {
  day: 'pd',
  week: 'pw',
  month: 'pm',
};

interface BraveNewsResponse {
  results?: Array<{
    title: string;
    url: string;
    description?: string;
    age?: string;
    source?: { name: string };
    extra_snippets?: string[];
  }>;
}

export class BraveNewsProvider implements NewsProvider {
  readonly name = 'Brave Search';

  constructor(private apiKey: string) {
    if (!apiKey) throw new Error('BRAVE_API_KEY is required');
  }

  async search(query: string, options?: SearchOptions): Promise<NewsArticle[]> {
    const params = new URLSearchParams({
      q: query,
      count: String(options?.maxArticles ?? 10),
      search_lang: options?.language ?? 'en',
      ...(options?.freshness ? { freshness: FRESHNESS_MAP[options.freshness] } : {}),
    });

    const response = await fetch(`${BRAVE_NEWS_API}?${params}`, {
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Brave Search API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as BraveNewsResponse;
    return (data.results ?? []).map((r) => ({
      title: r.title,
      source: r.source?.name ?? 'Unknown',
      url: r.url,
      publishedAt: r.age ?? new Date().toISOString(),
      summary: r.description ?? r.extra_snippets?.[0] ?? '',
      relevanceScore: 0.8,
    }));
  }
}
