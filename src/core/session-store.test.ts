import { describe, expect, it } from 'vitest';
import { InMemorySessionStore } from './session-store.js';

describe('InMemorySessionStore', () => {
  it('세션 목록에 워크벤치 메타데이터를 유지한다', () => {
    const store = new InMemorySessionStore();

    store.create('session-1', {
      sessionId: 'session-1',
      question: '이 기능을 이번 분기에 출시해야 하는가?',
      participants: [
        { id: 'ux', label: 'UX 전문가', provider: 'codex' },
        { id: 'backend', label: '백엔드 개발자', provider: 'claude' },
      ],
      rounds: 4,
      createdAt: 1_700_000_000_000,
      judge: 'claude',
      mode: 'debate',
      executionCwd: '/workspace/debate-arena',
      evidence: {
        id: 'snap-abc123',
        query: 'AI regulation 2026',
        collectedAt: '2026-03-07T01:00:00.000Z',
        articleCount: 6,
        sources: ['Brave', 'RSS'],
        excludedCount: 2,
      },
    });

    const [summary] = store.list();

    expect(summary).toMatchObject({
      sessionId: 'session-1',
      question: '이 기능을 이번 분기에 출시해야 하는가?',
      participants: [
        { id: 'ux', label: 'UX 전문가', provider: 'codex' },
        { id: 'backend', label: '백엔드 개발자', provider: 'claude' },
      ],
      rounds: 4,
      judge: 'claude',
      mode: 'debate',
      executionCwd: '/workspace/debate-arena',
      evidence: {
        id: 'snap-abc123',
        articleCount: 6,
      },
    });
  });
});
