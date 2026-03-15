import { describe, expect, it } from 'vitest';
import {
  applySessionStatusPatch,
  deriveSessionStatusPatchFromEnvelope,
  isTerminalSessionStatus,
} from './session-status.js';

describe('deriveSessionStatusPatchFromEnvelope', () => {
  it('maps synthesis completion to COMPLETED', () => {
    expect(deriveSessionStatusPatchFromEnvelope({
      sessionId: 'session-1',
      timestamp: 100,
      event: {
        type: 'synthesis_ready',
        payload: { status: 'completed', judge: 'claude' },
      },
    })).toEqual({
      sessionId: 'session-1',
      status: 'COMPLETED',
      updatedAt: 100,
    });
  });

  it('keeps synthesis chunks in SYNTHESIZING', () => {
    expect(deriveSessionStatusPatchFromEnvelope({
      sessionId: 'session-1',
      timestamp: 120,
      event: {
        type: 'agent_chunk',
        payload: { phase: 'synthesis' },
      },
    })?.status).toBe('SYNTHESIZING');
  });

  it('maps timeout cancellations to FAILED', () => {
    expect(deriveSessionStatusPatchFromEnvelope({
      sessionId: 'session-1',
      timestamp: 140,
      event: {
        type: 'cancelled',
        payload: { reason: 'timeout' },
      },
    })?.status).toBe('FAILED');
  });
});

describe('applySessionStatusPatch', () => {
  it('updates only the matching session and advances updatedAt', () => {
    const sessions = [
      { sessionId: 'session-1', status: 'RUNNING', updatedAt: 10 },
      { sessionId: 'session-2', status: 'RUNNING', updatedAt: 15 },
    ];

    expect(applySessionStatusPatch(sessions, {
      sessionId: 'session-1',
      status: 'COMPLETED',
      updatedAt: 20,
    })).toEqual([
      { sessionId: 'session-1', status: 'COMPLETED', updatedAt: 20 },
      { sessionId: 'session-2', status: 'RUNNING', updatedAt: 15 },
    ]);
  });
});

describe('isTerminalSessionStatus', () => {
  it('detects terminal states', () => {
    expect(isTerminalSessionStatus('COMPLETED')).toBe(true);
    expect(isTerminalSessionStatus('FAILED')).toBe(true);
    expect(isTerminalSessionStatus('CANCELLED')).toBe(true);
    expect(isTerminalSessionStatus('RUNNING')).toBe(false);
  });
});
