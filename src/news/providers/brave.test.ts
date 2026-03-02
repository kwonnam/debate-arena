import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BraveNewsProvider } from './brave.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const braveResponse = {
  results: [
    {
      title: 'Test Article',
      url: 'https://example.com/1',
      description: 'Test description',
      age: '2026-02-28T12:00:00Z',
      source: { name: 'Example News' },
      extra_snippets: [],
    },
  ],
};

describe('BraveNewsProvider', () => {
  beforeEach(() => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(braveResponse),
    });
  });

  it('Brave API를 올바른 헤더로 호출한다', async () => {
    const provider = new BraveNewsProvider('test-api-key');
    await provider.search('Trump tariffs');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('api.search.brave.com'),
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Subscription-Token': 'test-api-key' }),
      })
    );
  });

  it('응답을 NewsArticle 형식으로 변환한다', async () => {
    const provider = new BraveNewsProvider('test-api-key');
    const articles = await provider.search('Trump tariffs');
    expect(articles).toHaveLength(1);
    expect(articles[0].title).toBe('Test Article');
    expect(articles[0].url).toBe('https://example.com/1');
    expect(articles[0].source).toBe('Example News');
  });

  it('API 오류 시 명확한 메시지를 던진다', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 429, statusText: 'Too Many Requests' });
    const provider = new BraveNewsProvider('test-api-key');
    await expect(provider.search('query')).rejects.toThrow('Brave Search API error: 429');
  });

  it('빈 API 키로는 생성할 수 없다', () => {
    expect(() => new BraveNewsProvider('')).toThrow('BRAVE_API_KEY is required');
  });
});
