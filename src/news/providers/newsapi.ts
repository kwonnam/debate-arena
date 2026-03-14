import type { NewsArticle } from '../snapshot.js';
import type { NewsProvider, SearchOptions } from './types.js';

const NEWSAPI_URL = 'https://newsapi.org/v2/everything';
const SUPPORTED_NEWSAPI_LANGUAGES = new Set([
  'ar',
  'de',
  'en',
  'es',
  'fr',
  'he',
  'it',
  'nl',
  'no',
  'pt',
  'ru',
  'sv',
  'ud',
  'zh',
]);

interface NewsApiResponse {
  articles?: Array<{
    title: string;
    url: string;
    description?: string;
    publishedAt?: string;
    source?: { name?: string };
  }>;
}

export class NewsApiProvider implements NewsProvider {
  readonly name = 'NewsAPI';

  constructor(private apiKey: string) {
    if (!apiKey) throw new Error('NEWS_API_KEY is required');
  }

  async search(query: string, options?: SearchOptions): Promise<NewsArticle[]> {
    const params = new URLSearchParams({
      q: query,
      pageSize: String(options?.maxArticles ?? 10),
      sortBy: 'publishedAt',
    });
    const normalizedLanguage = normalizeNewsApiLanguage(options?.language);
    if (normalizedLanguage) {
      params.set('language', normalizedLanguage);
    }

    const response = await fetch(`${NEWSAPI_URL}?${params}`, {
      headers: { 'X-Api-Key': this.apiKey },
    });

    if (!response.ok) {
      throw new Error(`NewsAPI error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as NewsApiResponse;
    return (data.articles ?? []).map((a) => ({
      title: a.title,
      source: a.source?.name ?? 'NewsAPI',
      url: a.url,
      publishedAt: a.publishedAt ?? new Date().toISOString(),
      summary: a.description ?? '',
      relevanceScore: 0.7,
    }));
  }
}

function normalizeNewsApiLanguage(language?: string): string | undefined {
  const normalized = language?.trim().toLowerCase();
  if (!normalized) return 'en';
  if (!SUPPORTED_NEWSAPI_LANGUAGES.has(normalized)) {
    return undefined;
  }
  return normalized;
}
