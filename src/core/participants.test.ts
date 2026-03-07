import { describe, expect, it } from 'vitest';
import { normalizeDebateParticipants } from './participants.js';

describe('normalizeDebateParticipants', () => {
  it('같은 provider를 다른 역할에 반복 배치할 수 있다', () => {
    const participants = normalizeDebateParticipants([
      {
        id: 'ux-role',
        provider: 'claude',
        label: 'UX 전문가',
        role: {
          roleId: 'ux-role',
          roleLabel: 'UX 전문가',
          focus: '사용자 과업 흐름을 본다.',
          instructions: ['첫 과업 진입점을 점검한다.'],
        },
      },
      {
        id: 'qa-role',
        provider: 'claude',
        label: 'QA',
        role: {
          roleId: 'qa-role',
          roleLabel: 'QA',
          focus: '회귀 위험을 본다.',
          instructions: ['테스트 누락을 찾는다.'],
        },
      },
    ]);

    expect(participants).toHaveLength(2);
    expect(participants[0].provider).toBe('claude');
    expect(participants[1].provider).toBe('claude');
    expect(participants[0].label).toBe('UX 전문가');
    expect(participants[1].label).toBe('QA');
  });

  it('역할이 4개 이상이면 오류를 던진다', () => {
    expect(() => normalizeDebateParticipants([
      'codex',
      'claude',
      'gemini',
      'ollama',
    ])).toThrow('2 to 3');
  });

  it('동일한 라벨이 들어오면 세션 표시용 라벨을 고유하게 만든다', () => {
    const participants = normalizeDebateParticipants([
      {
        id: 'first',
        provider: 'codex',
        label: '전문가',
        role: {
          roleId: 'first',
          roleLabel: '전문가',
          focus: '첫 관점',
          instructions: [],
        },
      },
      {
        id: 'second',
        provider: 'claude',
        label: '전문가',
        role: {
          roleId: 'second',
          roleLabel: '전문가',
          focus: '둘째 관점',
          instructions: [],
        },
      },
    ]);

    expect(participants[0].label).toBe('전문가');
    expect(participants[1].label).toBe('전문가 2');
  });
});
