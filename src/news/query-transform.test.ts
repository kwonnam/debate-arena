import { describe, it, expect, vi } from 'vitest';
import type { AIProvider, Message } from '../providers/types.js';
import { buildSearchPlan, detectQueryLanguage } from './query-transform.js';

function createProvider(output: string): AIProvider {
  return {
    name: 'test-provider',
    generate: vi.fn().mockResolvedValue(output),
    stream(_messages: Message[]) {
      return (async function* empty() {})();
    },
  };
}

function getProviderMessages(provider: AIProvider): Message[] {
  const generate = provider.generate as ReturnType<typeof vi.fn>;
  return generate.mock.calls[0]?.[0] as Message[];
}

describe('detectQueryLanguage', () => {
  it('한글 비중이 높으면 ko를 반환한다', () => {
    expect(detectQueryLanguage('삼성 반도체 수출 규제')).toBe('ko');
  });

  it('영문 비중이 높으면 en을 반환한다', () => {
    expect(detectQueryLanguage('AI chip export restrictions')).toBe('en');
  });
});

describe('buildSearchPlan', () => {
  it('기본 모드에서는 입력 언어 기준 쿼리 하나를 유지한다', async () => {
    const plan = await buildSearchPlan('삼성 반도체 수출 규제');
    expect(plan.llmApplied).toBe(false);
    expect(plan.queries).toEqual([
      { query: '삼성 반도체 수출 규제', language: 'ko', source: 'original' },
    ]);
  });

  it('확장 + 양언어 모드에서는 LLM 응답을 search plan으로 정규화한다', async () => {
    const provider = createProvider(JSON.stringify({
      detectedLanguage: 'ko',
      queries: [
        { language: 'ko', query: '삼성 반도체 수출 규제 중국' },
        { language: 'en', query: 'Samsung chip export restrictions China' },
      ],
    }));

    const plan = await buildSearchPlan('삼성 반도체 수출 규제', {
      mode: 'expand',
      languageScope: 'both',
    }, { provider });

    expect(plan.llmApplied).toBe(true);
    expect(plan.queries).toEqual([
      { query: '삼성 반도체 수출 규제 중국', language: 'ko', source: 'expanded' },
      { query: 'Samsung chip export restrictions China', language: 'en', source: 'expanded' },
    ]);
  });

  it('LLM 응답이 깨지면 원본 쿼리로 폴백한다', async () => {
    const provider = createProvider('not-json');

    const plan = await buildSearchPlan('AI chip export restrictions', {
      mode: 'expand',
      languageScope: 'both',
    }, { provider });

    expect(plan.llmApplied).toBe(false);
    expect(plan.queries).toEqual([
      { query: 'AI chip export restrictions', language: 'en', source: 'original' },
      { query: 'AI chip export restrictions', language: 'ko', source: 'original' },
    ]);
  });

  it('web scope면 웹 검색용 지시를 포함한다', async () => {
    const provider = createProvider(JSON.stringify({
      detectedLanguage: 'en',
      queries: [{ language: 'en', query: 'bun install peer deps' }],
    }));

    await buildSearchPlan('bun install peer deps', {
      mode: 'expand',
      scope: 'web',
    }, { provider });

    const messages = getProviderMessages(provider);
    expect(messages[0]?.content).toContain('web search input');
    expect(messages[1]?.content).toContain('Scope: web');
  });
});
