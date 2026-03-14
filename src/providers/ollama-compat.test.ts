import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OllamaCompatProvider } from './ollama-compat.js';

describe('OllamaCompatProvider tool calling', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    delete process.env.OLLAMA_API_KEY;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    delete process.env.OLLAMA_API_KEY;
  });

  it('executes web_search tool calls and re-enters the chat completion loop', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{
          message: {
            content: '',
            tool_calls: [{
              id: 'call_1',
              type: 'function',
              function: {
                name: 'web_search',
                arguments: JSON.stringify({
                  query: 'latest ollama news',
                  max_results: 2,
                }),
              },
            }],
          },
        }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        results: [
          {
            title: 'Ollama ships web search',
            url: 'https://ollama.com/blog/web-search',
            content: 'Ollama announced web search support.',
            source: 'Ollama',
            published_at: '2025-09-24',
          },
        ],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{
          message: {
            content: 'Ollama now supports web search through a built-in tool API.',
          },
        }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    globalThis.fetch = fetchMock;
    process.env.OLLAMA_API_KEY = 'tool-key';

    const provider = new OllamaCompatProvider(
      'ollama-local',
      'http://127.0.0.1:11434',
      '',
      60_000,
      undefined,
      'qwen3',
      { webSearch: true },
    );

    const result = await provider.generate([
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'What changed recently in Ollama?' },
    ]);

    expect(result).toContain('web search');
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const firstRequest = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? '{}')) as {
      tools?: Array<{ function?: { name?: string } }>;
    };
    expect(firstRequest.tools?.map((tool) => tool.function?.name)).toEqual(['web_search', 'web_fetch']);

    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://ollama.com/api/web_search');
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toMatchObject({
      Authorization: 'Bearer tool-key',
    });

    const secondRequest = JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body ?? '{}')) as {
      messages?: Array<{ role?: string; tool_name?: string }>;
    };
    expect(secondRequest.messages?.some((message) => message.role === 'tool' && message.tool_name === 'web_search')).toBe(true);
  });

  it('falls back to plain chat completions when tool auth is unavailable', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{
          message: {
            content: 'No tools were available, so this is a plain response.',
          },
        }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    globalThis.fetch = fetchMock;

    const provider = new OllamaCompatProvider(
      'ollama-local',
      'http://127.0.0.1:11434',
      '',
      60_000,
      undefined,
      'qwen3',
      { webSearch: true },
    );

    const result = await provider.generate([
      { role: 'user', content: 'Hello' },
    ]);

    expect(result).toContain('plain response');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const firstRequest = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? '{}')) as {
      tools?: unknown[];
    };
    expect(firstRequest.tools).toBeUndefined();
  });
});
