import { describe, it, expect } from 'vitest';
import { buildSynthesisPrompt, buildSynthesisPromptWithEvidence, buildRoundEvidenceSection } from './prompt-builder.js';
import type { EvidenceSnapshot, NewsArticle } from '../news/snapshot.js';
import type { DebateRoundState } from '../types/debate.js';

describe('buildSynthesisPromptWithEvidence', () => {
  const mockSnapshot: EvidenceSnapshot = {
    id: 'abc123',
    query: '트럼프 관세',
    collectedAt: '2026-03-02T00:00:00Z',
    sources: ['Brave Search'],
    articles: [
      {
        title: 'Trump tariffs explained',
        source: 'Reuters',
        url: 'https://reuters.com/1',
        publishedAt: '2026-02-28',
        summary: 'Trump announced new tariffs...',
        relevanceScore: 0.9,
      },
    ],
    excludedCount: 2,
  };

  it('출처 인용 강제 지시를 포함한다', () => {
    const prompt = buildSynthesisPromptWithEvidence('트럼프 관세', [], mockSnapshot);
    expect(prompt).toContain('출처 인용');
  });

  it('단기/중기/장기 시나리오 분리를 포함한다', () => {
    const prompt = buildSynthesisPromptWithEvidence('트럼프 관세', [], mockSnapshot);
    expect(prompt).toContain('단기');
    expect(prompt).toContain('중기');
    expect(prompt).toContain('장기');
  });

  it('기사 제목과 출처를 포함한다', () => {
    const prompt = buildSynthesisPromptWithEvidence('트럼프 관세', [], mockSnapshot);
    expect(prompt).toContain('Trump tariffs explained');
    expect(prompt).toContain('Reuters');
  });

  it('snapshot 없이는 기존 buildSynthesisPrompt와 동일하게 동작한다', () => {
    const debateLog = [{ label: '백엔드 개발자' as const, round: 1, content: 'test' }];
    const withEvidence = buildSynthesisPromptWithEvidence('question', debateLog, undefined);
    const original = buildSynthesisPrompt('question', debateLog);
    expect(withEvidence).toBe(original);
  });

  it('round state가 있으면 synthesis prompt에 압축 상태를 포함한다', () => {
    const debateLog = [{ label: '백엔드 개발자' as const, round: 1, content: 'test' }];
    const roundStates: DebateRoundState[] = [{
      round: 1,
      summary: '요약',
      keyIssues: ['쟁점 1'],
      agreements: ['합의 1'],
      nextFocus: ['다음 초점'],
      shouldSuggestStop: false,
      source: 'judge',
      transcriptFallbackUsed: false,
    }];

    const prompt = buildSynthesisPrompt('question', debateLog, roundStates);
    expect(prompt).toContain('Compressed Round States');
    expect(prompt).toContain('쟁점 1');
  });
});

const mockArticles: NewsArticle[] = [
  {
    title: 'Test Article',
    source: 'Reuters',
    url: 'https://reuters.com/test',
    publishedAt: '2026-03-02',
    summary: 'Test summary',
    relevanceScore: 0.9,
  },
  {
    title: 'Second Article',
    source: 'Bloomberg',
    url: 'https://bloomberg.com/test',
    publishedAt: '2026-03-01',
    summary: 'Second summary',
    relevanceScore: 0.5,
  },
];

describe('buildRoundEvidenceSection', () => {
  it('unified 모드: 전체 기사를 반환한다', () => {
    const result = buildRoundEvidenceSection('unified', mockArticles);
    expect(result).toContain('Test Article');
    expect(result).toContain('Second Article');
  });

  it('split-first: 상위 절반 기사만 반환한다', () => {
    const result = buildRoundEvidenceSection('split-first', mockArticles);
    expect(result).toContain('Test Article');
    expect(result).not.toContain('Second Article');
  });

  it('split-second: 하위 절반 기사만 반환한다', () => {
    const result = buildRoundEvidenceSection('split-second', mockArticles);
    expect(result).not.toContain('Test Article');
    expect(result).toContain('Second Article');
  });

  it('기사가 없으면 빈 문자열을 반환한다', () => {
    const result = buildRoundEvidenceSection('unified', []);
    expect(result).toBe('');
  });

  it('라운드 증거는 상위 일부 기사만 남기고 나머지는 생략 표시한다', () => {
    const articles = Array.from({ length: 6 }, (_, index) => ({
      title: `Article ${index + 1}`,
      source: 'Reuters',
      url: `https://example.com/${index + 1}`,
      publishedAt: '2026-03-02',
      summary: 'A'.repeat(220),
      relevanceScore: 1 - index * 0.1,
    }));

    const result = buildRoundEvidenceSection('unified', articles);

    expect(result).toContain('Article 1');
    expect(result).toContain('Article 4');
    expect(result).not.toContain('Article 5');
    expect(result).toContain('추가 기사 2건');
  });
});
