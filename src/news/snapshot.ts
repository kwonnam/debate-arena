import { createHash } from 'node:crypto';
import type { SearchPlan } from './search-plan.js';

export type EvidenceKind = 'news' | 'web';

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
  kind?: EvidenceKind;
  query: string;
  collectedAt: string;  // ISO 8601
  sources: string[];    // 사용된 provider 이름 목록
  articles: NewsArticle[];
  excludedCount: number;
  searchPlan?: SearchPlan;
}

export interface EvidenceSnapshotSummary {
  id: string;
  kind: EvidenceKind;
  query: string;
  collectedAt: string;
  articleCount: number;
  sources: string[];
  topDomains: string[];
  excludedCount: number;
  searchPlan?: SearchPlan;
}

export function createSnapshotId(query: string, urls: string[], kind: EvidenceKind = 'news'): string {
  const input = [kind, query, ...urls.sort()].join('|');
  return createHash('sha256').update(input).digest('hex').slice(0, 12);
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function summarizeSnapshot(snapshot: EvidenceSnapshot): EvidenceSnapshotSummary {
  const articles = Array.isArray(snapshot.articles) ? snapshot.articles : [];
  const domainCounts = new Map<string, number>();

  for (const article of articles) {
    const domain = extractDomain(article.url);
    if (!domain) continue;
    domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
  }

  const topDomains = [...domainCounts.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    })
    .slice(0, 3)
    .map(([domain]) => domain);

  return {
    id: snapshot.id,
    kind: normalizeEvidenceKind(snapshot.kind),
    query: snapshot.query,
    collectedAt: snapshot.collectedAt,
    articleCount: articles.length,
    sources: Array.isArray(snapshot.sources) ? snapshot.sources.map((source) => String(source)).filter(Boolean) : [],
    topDomains,
    excludedCount: Number.isFinite(snapshot.excludedCount) ? snapshot.excludedCount : 0,
    searchPlan: normalizeSearchPlan(snapshot.searchPlan),
  };
}

export function createCuratedSnapshot(
  snapshot: EvidenceSnapshot,
  articleUrls: string[],
  queryOverride?: string,
): EvidenceSnapshot {
  const normalizedKind = normalizeEvidenceKind(snapshot.kind);
  const selectedUrlSet = new Set(
    articleUrls
      .map((url) => String(url || '').trim())
      .filter(Boolean),
  );
  const selectedArticles = snapshot.articles.filter((article) => selectedUrlSet.has(String(article.url || '').trim()));

  if (selectedArticles.length === 0) {
    throw new Error('At least one article must be selected to create a curated snapshot.');
  }

  const nextQuery = queryOverride?.trim()
    || `${snapshot.query} [selected ${selectedArticles.length}/${snapshot.articles.length}]`;
  const nextSources = Array.from(new Set([
    ...(Array.isArray(snapshot.sources) ? snapshot.sources.map((source) => String(source)).filter(Boolean) : []),
    'manual-selection',
  ]));

  return {
    ...snapshot,
    id: createSnapshotId(nextQuery, selectedArticles.map((article) => article.url), normalizedKind),
    kind: normalizedKind,
    query: nextQuery,
    collectedAt: new Date().toISOString(),
    sources: nextSources,
    articles: selectedArticles,
    excludedCount: Math.max(0, Number(snapshot.excludedCount) || 0) + Math.max(0, snapshot.articles.length - selectedArticles.length),
  };
}

export function normalizeEvidenceKind(kind?: string): EvidenceKind {
  return kind === 'web' ? 'web' : 'news';
}

function normalizeSearchPlan(searchPlan?: SearchPlan): SearchPlan | undefined {
  if (!searchPlan || !Array.isArray(searchPlan.queries)) {
    return undefined;
  }

  return {
    detectedLanguage: searchPlan.detectedLanguage === 'ko' || searchPlan.detectedLanguage === 'en'
      ? searchPlan.detectedLanguage
      : 'other',
    llmApplied: Boolean(searchPlan.llmApplied),
    queries: searchPlan.queries
      .map((query) => ({
        query: String(query?.query ?? '').trim(),
        language: query?.language === 'ko' || query?.language === 'en' ? query.language : undefined,
        source: query?.source === 'translated' || query?.source === 'expanded' ? query.source : 'original',
      }))
      .filter((query) => Boolean(query.query)),
  };
}
