import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RssProvider } from './rss.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const SAMPLE_RSS = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>Article Title</title>
      <link>https://example.com/article</link>
      <description>Article summary here</description>
      <pubDate>Mon, 01 Mar 2026 10:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Second Article</title>
      <link>https://example.com/article2</link>
      <description>Second summary</description>
      <pubDate>Tue, 02 Mar 2026 10:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

describe('RssProvider', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('provider.name is rss', () => {
    const provider = new RssProvider([]);
    expect(provider.name).toBe('rss');
  });

  it('유효한 RSS 피드를 파싱해 NewsArticle 배열을 반환한다', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => SAMPLE_RSS,
    });

    const provider = new RssProvider(['https://example.com/feed.rss']);
    const result = await provider.search('test');

    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Article Title');
    expect(result[0].url).toBe('https://example.com/article');
    expect(result[0].summary).toBe('Article summary here');
    expect(result[0].relevanceScore).toBe(0.5);
    expect(result[1].title).toBe('Second Article');
  });

  it('피드 fetch 실패 시 해당 피드를 건너뛰고 나머지 피드 결과를 반환한다', async () => {
    // First feed fails
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    // Second feed succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => SAMPLE_RSS,
    });

    const provider = new RssProvider([
      'https://failing.com/feed.rss',
      'https://example.com/feed.rss',
    ]);
    const result = await provider.search('test');

    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Article Title');
  });

  it('피드 목록이 비어있으면 빈 배열을 반환한다', async () => {
    const provider = new RssProvider([]);
    const result = await provider.search('test');
    expect(result).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('item 태그가 없는 잘못된 XML은 빈 배열을 반환한다', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => '<rss><channel><title>Empty Feed</title></channel></rss>',
    });

    const provider = new RssProvider(['https://example.com/feed.rss']);
    const result = await provider.search('test');
    expect(result).toEqual([]);
  });

  it('source를 피드 URL 호스트명에서 추출한다', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => SAMPLE_RSS,
    });

    const provider = new RssProvider(['https://example.com/feed.rss']);
    const result = await provider.search('test');

    expect(result[0].source).toBe('example.com');
  });

  it('HTTP 오류 응답 피드를 건너뛰고 계속 처리한다', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => SAMPLE_RSS,
    });

    const provider = new RssProvider([
      'https://notfound.com/feed.rss',
      'https://example.com/feed.rss',
    ]);
    const result = await provider.search('test');

    expect(result).toHaveLength(2);
  });

  it('쿼리 키워드로 기사를 필터링한다', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => SAMPLE_RSS,
    });

    const provider = new RssProvider(['https://example.com/feed.rss']);
    // "Article" appears in first article title only — "second" in second article title
    const result = await provider.search('second');

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Second Article');
  });

  it('쿼리가 매칭되는 기사가 없으면 모든 기사를 반환한다', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => SAMPLE_RSS,
    });

    const provider = new RssProvider(['https://example.com/feed.rss']);
    const result = await provider.search('xyznotexist');

    // No match → return all articles as fallback
    expect(result).toHaveLength(2);
  });
});
