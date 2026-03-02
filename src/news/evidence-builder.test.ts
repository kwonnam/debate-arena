import { describe, it, expect, vi } from 'vitest';
import { EvidenceBuilder } from './evidence-builder.js';
import type { NewsProvider } from './providers/types.js';
import type { NewsArticle } from './snapshot.js';

const makeArticle = (url: string, score = 0.8): NewsArticle => ({
  title: `Article at ${url}`,
  source: 'Test',
  url,
  publishedAt: '2026-03-01',
  summary: 'Test summary',
  relevanceScore: score,
});

describe('EvidenceBuilder', () => {
  it('여러 provider에서 병렬로 수집한다', async () => {
    const p1: NewsProvider = { name: 'A', search: vi.fn().mockResolvedValue([makeArticle('url1')]) };
    const p2: NewsProvider = { name: 'B', search: vi.fn().mockResolvedValue([makeArticle('url2')]) };
    const builder = new EvidenceBuilder([p1, p2]);
    const snapshot = await builder.build('query');
    expect(snapshot.articles).toHaveLength(2);
    expect(p1.search).toHaveBeenCalledOnce();
    expect(p2.search).toHaveBeenCalledOnce();
  });

  it('URL 기준으로 중복을 제거한다', async () => {
    const p1: NewsProvider = { name: 'A', search: vi.fn().mockResolvedValue([makeArticle('url1'), makeArticle('url1')]) };
    const builder = new EvidenceBuilder([p1]);
    const snapshot = await builder.build('query');
    expect(snapshot.articles).toHaveLength(1);
    expect(snapshot.excludedCount).toBe(1);
  });

  it('relevanceScore 내림차순으로 정렬한다', async () => {
    const articles = [makeArticle('url1', 0.3), makeArticle('url2', 0.9), makeArticle('url3', 0.6)];
    const p1: NewsProvider = { name: 'A', search: vi.fn().mockResolvedValue(articles) };
    const builder = new EvidenceBuilder([p1]);
    const snapshot = await builder.build('query');
    expect(snapshot.articles[0].url).toBe('url2');
    expect(snapshot.articles[1].url).toBe('url3');
  });

  it('동일한 쿼리·URL 조합은 동일한 id를 생성한다', async () => {
    const b1 = new EvidenceBuilder([{ name: 'A', search: vi.fn().mockResolvedValue([makeArticle('url1')]) }]);
    const b2 = new EvidenceBuilder([{ name: 'A', search: vi.fn().mockResolvedValue([makeArticle('url1')]) }]);
    const s1 = await b1.build('query');
    const s2 = await b2.build('query');
    expect(s1.id).toBe(s2.id);
  });

  it('sources 목록에 사용된 provider 이름이 포함된다', async () => {
    const p1: NewsProvider = { name: 'Brave', search: vi.fn().mockResolvedValue([makeArticle('url1')]) };
    const builder = new EvidenceBuilder([p1]);
    const snapshot = await builder.build('query');
    expect(snapshot.sources).toContain('Brave');
  });
});
