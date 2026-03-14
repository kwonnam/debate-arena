import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NewsApiProvider } from './newsapi.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('NewsApiProvider', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('API 응답을 NewsArticle 배열로 변환한다', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        articles: [
          {
            title: 'Test Article',
            url: 'https://test.com',
            description: 'Test description',
            publishedAt: '2026-03-02T00:00:00Z',
            source: { name: 'Test Source' },
          },
        ],
      }),
    });

    const provider = new NewsApiProvider('test-key');
    const result = await provider.search('test query');

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Test Article');
    expect(result[0].source).toBe('Test Source');
    expect(result[0].url).toBe('https://test.com');
    expect(result[0].summary).toBe('Test description');
  });

  it('API 키 없으면 에러를 던진다', () => {
    expect(() => new NewsApiProvider('')).toThrow('NEWS_API_KEY');
  });

  it('API 응답이 실패하면 에러를 던진다', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    });

    const provider = new NewsApiProvider('bad-key');
    await expect(provider.search('query')).rejects.toThrow('NewsAPI error: 401');
  });

  it('articles가 없으면 빈 배열을 반환한다', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const provider = new NewsApiProvider('test-key');
    const result = await provider.search('query');
    expect(result).toEqual([]);
  });

  it('지원되지 않는 언어 코드는 language 파라미터를 생략한다', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ articles: [] }),
    });

    const provider = new NewsApiProvider('test-key');
    await provider.search('한국 AI 규제', { language: 'ko' });

    const requestUrl = String(mockFetch.mock.calls[0]?.[0] || '');
    expect(requestUrl).toContain('q=%ED%95%9C%EA%B5%AD+AI+%EA%B7%9C%EC%A0%9C');
    expect(requestUrl).not.toContain('language=ko');
  });
});
