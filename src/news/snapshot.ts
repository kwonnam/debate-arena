import { createHash } from 'node:crypto';

export interface NewsArticle {
  title: string;
  source: string;       // "Brave Search", "NewsAPI" 등
  url: string;
  publishedAt: string;  // ISO 8601
  summary: string;      // 200자 이내
  relevanceScore: number; // 0~1
}

export interface EvidenceSnapshot {
  id: string;           // SHA-256 해시 (재현성 보장)
  query: string;
  collectedAt: string;  // ISO 8601
  sources: string[];    // 사용된 provider 이름 목록
  articles: NewsArticle[];
  excludedCount: number;
}

export function createSnapshotId(query: string, urls: string[]): string {
  const input = [query, ...urls.sort()].join('|');
  return createHash('sha256').update(input).digest('hex').slice(0, 12);
}
