import type { NewsArticle } from '../snapshot.js';

export interface SearchOptions {
  maxArticles?: number;  // 기본값 10
  language?: string;     // 기본값 'en'
  freshness?: 'day' | 'week' | 'month';  // 기본값 'week'
}

export interface NewsProvider {
  readonly name: string;
  search(query: string, options?: SearchOptions): Promise<NewsArticle[]>;
}
