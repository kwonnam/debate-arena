import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { InMemorySessionStore, PersistentSessionStore } from './session-store.js';

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

describe('PersistentSessionStore', () => {
  it('세션을 디스크에 저장하고 재시작 후 다시 불러온다', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'debate-arena-sessions-'));

    try {
      const firstStore = new PersistentSessionStore(rootDir);
      firstStore.create('session-1', {
        sessionId: 'session-1',
        question: '디스크에 저장되는가?',
        participants: [
          { id: 'ux', label: 'UX 전문가', provider: 'codex' },
          { id: 'backend', label: '백엔드 개발자', provider: 'claude' },
        ],
        rounds: 2,
        createdAt: 1_700_000_000_000,
        judge: 'claude',
        mode: 'debate',
        executionCwd: '/workspace/debate-arena',
      });
      firstStore.updateStatus('session-1', 'FAILED');

      const secondStore = new PersistentSessionStore(rootDir);
      const restored = secondStore.get('session-1');

      expect(restored?.metadata.question).toBe('디스크에 저장되는가?');
      expect(restored?.status).toBe('FAILED');
      expect(secondStore.list()[0]?.sessionId).toBe('session-1');
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('재시작 시 미완료 세션을 server_shutdown 취소 상태로 복구한다', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'debate-arena-sessions-'));

    try {
      const firstStore = new PersistentSessionStore(rootDir);
      firstStore.create('session-1', {
        sessionId: 'session-1',
        question: '복구 가능한가?',
        participants: [
          { id: 'ux', label: 'UX 전문가', provider: 'codex' },
          { id: 'backend', label: '백엔드 개발자', provider: 'claude' },
        ],
        rounds: 3,
        createdAt: 1_700_000_000_000,
        judge: 'claude',
      });
      firstStore.append('session-1', {
        type: 'round_started',
        sessionId: 'session-1',
        timestamp: 1_700_000_000_100,
        payload: {
          round: 1,
          total: 3,
          totalRounds: 3,
          participants: [
            { id: 'ux', label: 'UX 전문가', provider: 'codex' },
            { id: 'backend', label: '백엔드 개발자', provider: 'claude' },
          ],
        },
      });
      firstStore.updateStatus('session-1', 'RUNNING');

      const secondStore = new PersistentSessionStore(rootDir);
      const restored = secondStore.get('session-1');
      const lastEvent = restored?.events.at(-1)?.event;

      expect(restored?.status).toBe('CANCELLED');
      expect(lastEvent?.type).toBe('cancelled');
      expect(lastEvent?.payload.reason).toBe('server_shutdown');
      expect(lastEvent?.payload.lastRound).toBe(1);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
