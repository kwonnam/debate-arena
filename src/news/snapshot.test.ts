import { describe, it, expect } from 'vitest';
import { createSnapshotId, summarizeSnapshot } from './snapshot.js';

describe('createSnapshotId', () => {
  it('동일한 입력에 동일한 해시를 반환한다', () => {
    const id1 = createSnapshotId('트럼프 관세', ['url1', 'url2']);
    const id2 = createSnapshotId('트럼프 관세', ['url1', 'url2']);
    expect(id1).toBe(id2);
  });

  it('다른 쿼리에 다른 해시를 반환한다', () => {
    const id1 = createSnapshotId('트럼프 관세', ['url1']);
    const id2 = createSnapshotId('반도체 수출', ['url1']);
    expect(id1).not.toBe(id2);
  });

  it('해시는 8자 이상이다', () => {
    const id = createSnapshotId('test', ['url1']);
    expect(id.length).toBeGreaterThanOrEqual(8);
  });

  it('스냅샷 요약에서 기사 수와 상위 도메인을 계산한다', () => {
    const summary = summarizeSnapshot({
      id: 'snap-1',
      query: 'ai regulation',
      collectedAt: '2026-03-07T00:00:00.000Z',
      sources: ['rss', 'newsapi'],
      excludedCount: 1,
      articles: [
        {
          title: 'A',
          source: 'RSS',
          url: 'https://www.example.com/a',
          publishedAt: '2026-03-07T00:00:00.000Z',
          summary: 'A',
          relevanceScore: 0.9,
        },
        {
          title: 'B',
          source: 'RSS',
          url: 'https://example.com/b',
          publishedAt: '2026-03-07T00:00:00.000Z',
          summary: 'B',
          relevanceScore: 0.8,
        },
        {
          title: 'C',
          source: 'NewsAPI',
          url: 'https://news.example.org/c',
          publishedAt: '2026-03-07T00:00:00.000Z',
          summary: 'C',
          relevanceScore: 0.7,
        },
      ],
    });

    expect(summary.articleCount).toBe(3);
    expect(summary.sources).toEqual(['rss', 'newsapi']);
    expect(summary.topDomains).toEqual(['example.com', 'news.example.org']);
    expect(summary.excludedCount).toBe(1);
  });
});
