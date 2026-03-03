import type { NewsArticle } from '../snapshot.js';
import type { NewsProvider, SearchOptions } from './types.js';

function extractTagContent(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? match[1].trim() : '';
}

function parseItems(xml: string, feedUrl: string): NewsArticle[] {
  const itemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
  const articles: NewsArticle[] = [];
  let match: RegExpExecArray | null;

  let hostname = feedUrl;
  try {
    hostname = new URL(feedUrl).hostname;
  } catch {
    // fallback to feedUrl if invalid
  }

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = extractTagContent(block, 'title');
    const link = extractTagContent(block, 'link');
    const description = extractTagContent(block, 'description');
    const pubDate = extractTagContent(block, 'pubDate');
    const sourceTag = extractTagContent(block, 'source');

    if (!title && !link) continue;

    let publishedAt: string;
    try {
      publishedAt = pubDate ? new Date(pubDate).toISOString() : new Date().toISOString();
    } catch {
      publishedAt = new Date().toISOString();
    }

    articles.push({
      title: title || '(no title)',
      source: sourceTag || hostname,
      url: link || feedUrl,
      publishedAt,
      summary: description.slice(0, 200),
      relevanceScore: 0.5,
    });
  }

  return articles;
}

export class RssProvider implements NewsProvider {
  readonly name = 'rss';

  constructor(private feedUrls: string[]) {}

  async search(query: string, _options?: SearchOptions): Promise<NewsArticle[]> {
    if (this.feedUrls.length === 0) return [];

    const results = await Promise.all(
      this.feedUrls.map(async (url) => {
        try {
          const response = await fetch(url);
          if (!response.ok) return [];
          const xml = await response.text();
          return parseItems(xml, url);
        } catch {
          return [];
        }
      }),
    );

    const allArticles = results.flat();

    if (query.trim()) {
      const keywords = query.toLowerCase().split(/\s+/).filter((k) => k.length > 2);
      if (keywords.length > 0) {
        const filtered = allArticles.filter((article) =>
          keywords.some(
            (kw) =>
              article.title.toLowerCase().includes(kw) ||
              article.summary.toLowerCase().includes(kw),
          ),
        );
        if (filtered.length > 0) return filtered;
      }
    }

    return allArticles;
  }
}
