import type { NewsArticle } from '../snapshot.js';
import type { NewsProvider, SearchOptions } from './types.js';

const BRAVE_WEB_API = 'https://api.search.brave.com/res/v1/web/search';

const FRESHNESS_MAP: Record<NonNullable<SearchOptions['freshness']>, string> = {
  day: 'pd',
  week: 'pw',
  month: 'pm',
};

interface BraveWebResponse {
  web?: {
    results?: BraveWebResult[];
  };
}

interface BraveWebResult {
  title: string;
  url: string;
  description?: string;
  age?: string;
  extra_snippets?: string[];
  profile?: { name?: string };
  meta_url?: { hostname?: string };
}

export class BraveWebProvider implements NewsProvider {
  readonly name = 'Brave Web';

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

    const response = await fetch(`${BRAVE_WEB_API}?${params}`, {
      headers: {
        Accept: 'application/json',
        'X-Subscription-Token': this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Brave Web API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as BraveWebResponse;
    return (data.web?.results ?? []).map((result) => ({
      title: result.title,
      source: normalizeSource(result),
      url: result.url,
      publishedAt: result.age ?? new Date().toISOString(),
      summary: result.description ?? result.extra_snippets?.[0] ?? '',
      relevanceScore: 0.75,
    }));
  }
}

function normalizeSource(result: BraveWebResult): string {
  if (result.profile?.name?.trim()) {
    return result.profile.name.trim();
  }

  if (result.meta_url?.hostname?.trim()) {
    return result.meta_url.hostname.trim();
  }

  try {
    return new URL(result.url).hostname;
  } catch {
    return 'Unknown';
  }
}
