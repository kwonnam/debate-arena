import { describe, expect, it } from 'vitest';
import { buildFallbackRoundState, parseRoundState } from './round-state.js';

describe('parseRoundState', () => {
  it('태그된 텍스트를 round state로 파싱한다', () => {
    const parsed = parseRoundState(
      [
        'SUMMARY: 양측은 비용과 단순성의 균형을 두고 다툰다.',
        'ISSUES:',
        '- 초기 구현 복잡도',
        '- 장기 유지보수 비용',
        'AGREEMENTS:',
        '- 관측 가능성은 중요하다',
        'NEXT_FOCUS:',
        '- 운영 비용 비교를 더 구체화한다',
        'STOP_SUGGESTED: no',
        'STOP_REASON: none',
      ].join('\n'),
      2,
    );

    expect(parsed).toMatchObject({
      round: 2,
      summary: '양측은 비용과 단순성의 균형을 두고 다툰다.',
      keyIssues: ['초기 구현 복잡도', '장기 유지보수 비용'],
      agreements: ['관측 가능성은 중요하다'],
      nextFocus: ['운영 비용 비교를 더 구체화한다'],
      shouldSuggestStop: false,
      source: 'judge',
      transcriptFallbackUsed: false,
    });
  });
});

describe('buildFallbackRoundState', () => {
  it('fallback 메타데이터를 포함한 round state를 만든다', () => {
    const state = buildFallbackRoundState(
      [
        { participantId: 'ux', label: 'UX 전문가', provider: 'codex', round: 1, phase: 'opening', content: 'REST가 더 단순하다.' },
        { participantId: 'backend', label: '백엔드 개발자', provider: 'claude', round: 1, phase: 'opening', content: 'GraphQL이 더 유연하다.' },
      ],
      1,
      'parser failed',
    );

    expect(state.round).toBe(1);
    expect(state.transcriptFallbackUsed).toBe(true);
    expect(state.source).toBe('fallback');
    expect(state.warning).toContain('parser failed');
    expect(state.keyIssues).toHaveLength(2);
  });
});
