import { describe, expect, it } from 'vitest';
import { buildResumePlan, hydrateParticipantsForResume } from './resume.js';
import type { DebateSession } from './session-store.js';

function createSession(events: DebateSession['events'], status: DebateSession['status'] = 'FAILED'): DebateSession {
  return {
    metadata: {
      sessionId: 'session-1',
      question: 'Resume this debate',
      participants: [
        { id: 'p1', label: 'Codex', provider: 'codex' },
        { id: 'p2', label: 'Claude', provider: 'claude' },
      ],
      rounds: 3,
      createdAt: Date.now(),
      judge: 'claude',
      workflowKind: 'project',
    },
    status,
    events,
    updatedAt: Date.now(),
  };
}

describe('buildResumePlan', () => {
  it('다음 라운드부터 재개할 계획을 만든다', () => {
    const session = createSession([
      {
        sequence: 1,
        sessionId: 'session-1',
        timestamp: 1,
        event: {
          type: 'round_finished',
          sessionId: 'session-1',
          timestamp: 1,
          payload: {
            round: 1,
            messages: [
              { provider: 'codex', participantId: 'p1', label: 'Codex', phase: 'opening', content: 'C1' },
              { provider: 'claude', participantId: 'p2', label: 'Claude', phase: 'opening', content: 'A1' },
            ],
          },
        },
      },
      {
        sequence: 2,
        sessionId: 'session-1',
        timestamp: 2,
        event: {
          type: 'round_state_ready',
          sessionId: 'session-1',
          timestamp: 2,
          payload: {
            round: 1,
            summary: 'Round 1',
            keyIssues: ['issue'],
            agreements: [],
            nextFocus: ['focus'],
            shouldSuggestStop: false,
            source: 'judge',
            transcriptFallbackUsed: false,
          },
        },
      },
      {
        sequence: 3,
        sessionId: 'session-1',
        timestamp: 3,
        event: {
          type: 'cancelled',
          sessionId: 'session-1',
          timestamp: 3,
          payload: { reason: 'timeout', lastRound: 2, lastProvider: 'codex' },
        },
      },
    ]);

    const plan = buildResumePlan(session);

    expect(plan.startRound).toBe(2);
    expect(plan.synthesisOnly).toBe(false);
    expect(plan.resumeStage).toBe('Round 2');
    expect(plan.completedRounds).toEqual([1]);
    expect(plan.initialMessages).toHaveLength(2);
    expect(plan.initialRoundStates).toHaveLength(1);
  });

  it('모든 라운드가 끝났으면 synthesis부터 재개한다', () => {
    const session = createSession([
      {
        sequence: 1,
        sessionId: 'session-1',
        timestamp: 1,
        event: {
          type: 'round_finished',
          sessionId: 'session-1',
          timestamp: 1,
          payload: {
            round: 1,
            messages: [
              { provider: 'codex', participantId: 'p1', label: 'Codex', phase: 'opening', content: 'C1' },
              { provider: 'claude', participantId: 'p2', label: 'Claude', phase: 'opening', content: 'A1' },
            ],
          },
        },
      },
      {
        sequence: 2,
        sessionId: 'session-1',
        timestamp: 2,
        event: {
          type: 'round_state_ready',
          sessionId: 'session-1',
          timestamp: 2,
          payload: {
            round: 1,
            summary: 'Round 1',
            keyIssues: ['issue 1'],
            agreements: [],
            nextFocus: ['focus 1'],
            shouldSuggestStop: false,
            source: 'judge',
            transcriptFallbackUsed: false,
          },
        },
      },
      {
        sequence: 3,
        sessionId: 'session-1',
        timestamp: 3,
        event: {
          type: 'round_finished',
          sessionId: 'session-1',
          timestamp: 3,
          payload: {
            round: 2,
            messages: [
              { provider: 'codex', participantId: 'p1', label: 'Codex', phase: 'rebuttal', content: 'C2' },
              { provider: 'claude', participantId: 'p2', label: 'Claude', phase: 'rebuttal', content: 'A2' },
            ],
          },
        },
      },
      {
        sequence: 4,
        sessionId: 'session-1',
        timestamp: 4,
        event: {
          type: 'cancelled',
          sessionId: 'session-1',
          timestamp: 4,
          payload: { reason: 'timeout', lastRound: 2, lastProvider: 'claude' },
        },
      },
    ], 'FAILED');

    session.metadata.rounds = 2;

    const plan = buildResumePlan(session);

    expect(plan.startRound).toBe(3);
    expect(plan.synthesisOnly).toBe(true);
    expect(plan.resumeStage).toBe('Synthesis');
    expect(plan.initialRoundStates).toHaveLength(2);
    expect(plan.initialRoundStates[1].source).toBe('fallback');
  });
});

describe('hydrateParticipantsForResume', () => {
  it('세부 참가자 정보가 없으면 fallback role을 만든다', () => {
    const participants = hydrateParticipantsForResume(createSession([]).metadata);
    expect(participants).toHaveLength(2);
    expect(participants[0].role.roleId).toBe('p1');
    expect(participants[0].role.focus).toContain('Codex');
  });
});
