import { describe, expect, it } from 'vitest';
import { DebateContext } from './context.js';
import type { DebateParticipant } from '../types/roles.js';

const codexParticipant: DebateParticipant = {
  id: 'ux',
  provider: 'codex',
  label: 'UX 전문가',
  role: {
    roleId: 'ux',
    roleLabel: 'UX 전문가',
    focus: '사용자 여정과 정보 구조를 점검한다.',
    instructions: [],
  },
};

const claudeParticipant: DebateParticipant = {
  id: 'backend',
  provider: 'claude',
  label: '백엔드 개발자',
  role: {
    roleId: 'backend',
    roleLabel: '백엔드 개발자',
    focus: '구현 비용과 운영 복잡도를 점검한다.',
    instructions: [],
  },
};

describe('DebateContext', () => {
  it('round 1 opening은 상대 오프닝을 주입하지 않는다', () => {
    const context = new DebateContext('REST vs GraphQL?', undefined, undefined, [], [codexParticipant, claudeParticipant]);

    context.addMessage({
      participantId: 'ux',
      label: 'UX 전문가',
      provider: 'codex',
      round: 1,
      phase: 'opening',
      content: 'REST is simpler.',
    });

    const messages = context.buildMessagesFor(claudeParticipant, 1, 'opening');
    const userContent = messages
      .filter((message) => message.role === 'user')
      .map((message) => message.content)
      .join('\n');

    expect(userContent).not.toContain('REST is simpler.');
  });

  it('rebuttal은 round state를 우선 컨텍스트로 사용한다', () => {
    const context = new DebateContext('REST vs GraphQL?', undefined, undefined, [], [codexParticipant, claudeParticipant]);

    context.addMessage({
      participantId: 'ux',
      label: 'UX 전문가',
      provider: 'codex',
      round: 1,
      phase: 'opening',
      content: 'REST is simpler.',
    });
    context.addMessage({
      participantId: 'backend',
      label: '백엔드 개발자',
      provider: 'claude',
      round: 1,
      phase: 'opening',
      content: 'GraphQL is more flexible.',
    });
    context.addMessage({
      participantId: 'user',
      label: 'User',
      provider: 'user',
      round: 1,
      phase: 'rebuttal',
      content: '실무에서는 운영 복잡도가 가장 중요합니다.',
    });
    context.addRoundState({
      round: 1,
      summary: '양측은 단순성과 유연성의 교환관계를 두고 대립했다.',
      keyIssues: ['운영 복잡도', '클라이언트 유연성'],
      agreements: ['스키마 품질이 중요하다'],
      nextFocus: ['운영 비용 비교'],
      shouldSuggestStop: false,
      source: 'judge',
      transcriptFallbackUsed: false,
    });

    const messages = context.buildMessagesFor(claudeParticipant, 2, 'rebuttal');
    const userMessages = messages.filter((message) => message.role === 'user').map((message) => message.content);

    expect(userMessages.join('\n')).toContain('## Debate State So Far');
    expect(userMessages.join('\n')).toContain('운영 비용 비교');
    expect(userMessages.join('\n')).toContain('UX 전문가 has responded with the following argument');
    expect(userMessages.join('\n')).toContain('## Latest User Guidance');
    expect(userMessages.join('\n')).toContain('운영 복잡도가 가장 중요합니다');
    expect(userMessages.at(-1)).toContain('## Your Task');
  });

  it('fallback transcript에는 user 메시지도 포함한다', () => {
    const context = new DebateContext('REST vs GraphQL?', undefined, undefined, [], [codexParticipant, claudeParticipant]);

    context.addMessage({
      participantId: 'ux',
      label: 'UX 전문가',
      provider: 'codex',
      round: 1,
      phase: 'opening',
      content: 'REST is simpler.',
    });
    context.addMessage({
      participantId: 'user',
      label: 'User',
      provider: 'user',
      round: 1,
      phase: 'rebuttal',
      content: '운영팀 인력이 적습니다.',
    });
    context.addRoundState({
      round: 1,
      summary: 'fallback summary',
      keyIssues: [],
      agreements: [],
      nextFocus: [],
      shouldSuggestStop: false,
      source: 'fallback',
      transcriptFallbackUsed: true,
      warning: 'parser failed',
    });

    const messages = context.buildMessagesFor(claudeParticipant, 2, 'rebuttal');
    const fallbackSection = messages
      .filter((message) => message.role === 'user')
      .map((message) => message.content)
      .find((content) => content.includes('## Transcript Fallback For Round 1'));

    expect(fallbackSection).toContain('### User');
    expect(fallbackSection).toContain('운영팀 인력이 적습니다.');
  });
});
