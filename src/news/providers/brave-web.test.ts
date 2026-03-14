import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BraveWebProvider } from './brave-web.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('BraveWebProvider', () => {
  beforeEach(() => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        web: {
          results: [
            {
              title: 'Bun 1.0 release notes',
              url: 'https://bun.sh/blog/bun-v1.0',
              description: 'Bun 1.0 is available.',
              age: '2026-03-01T00:00:00Z',
              profile: { name: 'bun.sh' },
              meta_url: { hostname: 'bun.sh' },
            },
          ],
        },
      }),
    });
  });

  it('calls the Brave web endpoint with the API key', async () => {
    const provider = new BraveWebProvider('test-api-key');
    await provider.search('bun release notes');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('api.search.brave.com/res/v1/web/search'),
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Subscription-Token': 'test-api-key' }),
      }),
    );
  });

  it('maps Brave web results into evidence items', async () => {
    const provider = new BraveWebProvider('test-api-key');
    const items = await provider.search('bun release notes');

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Bun 1.0 release notes');
    expect(items[0].source).toBe('bun.sh');
    expect(items[0].url).toBe('https://bun.sh/blog/bun-v1.0');
  });

  it('throws a clear error for API failures', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error' });
    const provider = new BraveWebProvider('test-api-key');

    await expect(provider.search('query')).rejects.toThrow('Brave Web API error: 500');
  });
});
