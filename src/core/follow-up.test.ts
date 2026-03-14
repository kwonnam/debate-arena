import { describe, expect, it } from 'vitest';
import { buildFollowUpContext } from './follow-up.js';
import type { DebateSession } from './session-store.js';

describe('buildFollowUpContext', () => {
  it('완료된 세션의 synthesis와 마지막 round state를 후속 토론 컨텍스트로 변환한다', () => {
    const session: DebateSession = {
      metadata: {
        sessionId: 'session-1',
        question: 'REST vs GraphQL?',
        participants: [
          { id: 'ux', label: 'UX 전문가', provider: 'codex' },
          { id: 'backend', label: '백엔드 개발자', provider: 'claude' },
        ],
        rounds: 2,
        createdAt: 0,
        judge: 'claude',
      },
      status: 'COMPLETED',
      updatedAt: 1,
      events: [
        {
          sessionId: 'session-1',
          sequence: 1,
          timestamp: 1,
          event: {
            type: 'round_state_ready',
            sessionId: 'session-1',
            timestamp: 1,
            payload: {
              round: 2,
              summary: '운영 복잡도와 클라이언트 유연성이 핵심이었다.',
              keyIssues: ['운영 복잡도'],
              agreements: ['스키마 품질은 중요하다'],
              nextFocus: ['팀 역량별 선택 기준 정리'],
              shouldSuggestStop: true,
              stopReason: '핵심 쟁점이 충분히 수렴했다.',
              source: 'judge',
              transcriptFallbackUsed: false,
            },
          },
        },
        {
          sessionId: 'session-1',
          sequence: 2,
          timestamp: 2,
          event: {
            type: 'synthesis_ready',
            sessionId: 'session-1',
            timestamp: 2,
            payload: {
              status: 'completed',
              judge: 'claude',
              content: '상황에 따라 다르지만 운영 복잡도와 팀 역량이 가장 큰 분기점이다.',
            },
          },
        },
      ],
    };

    const context = buildFollowUpContext(session);
    expect(context.sourceSessionId).toBe('session-1');
    expect(context.question).toBe('REST vs GraphQL?');
    expect(context.synthesis).toContain('운영 복잡도');
    expect(context.latestRoundState?.round).toBe(2);
    expect(context.participants).toHaveLength(2);
  });

  it('재사용 가능한 출력이 없으면 오류를 던진다', () => {
    const session: DebateSession = {
      metadata: {
        sessionId: 'session-1',
        question: 'REST vs GraphQL?',
        participants: [],
        rounds: 2,
        createdAt: 0,
      },
      status: 'COMPLETED',
      updatedAt: 1,
      events: [],
    };

    expect(() => buildFollowUpContext(session)).toThrow('reusable debate output');
  });
});
