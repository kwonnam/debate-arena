import type { DebateEvent, DebateEventEnvelope } from '../types/debate-events.js';

// 세션 메타데이터
export interface SessionMetadata {
  sessionId: string;
  question: string;
  participants: [string, string];
  rounds: number;
  createdAt: number; // Unix ms
}

// 세션 상태 (상태 머신 상태)
export type SessionStatus =
  | 'IDLE'
  | 'RUNNING'
  | 'STREAMING'
  | 'ROUND_COMPLETE'
  | 'SYNTHESIZING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

// 전체 세션 데이터
export interface DebateSession {
  metadata: SessionMetadata;
  status: SessionStatus;
  events: DebateEventEnvelope[]; // append-only event log
  updatedAt: number;
}

// 목록 조회용 요약 (events 제외)
export interface SessionSummary {
  sessionId: string;
  question: string;
  status: SessionStatus;
  createdAt: number;
  updatedAt: number;
  eventCount: number;
}

// SessionStore 인터페이스
export interface SessionStore {
  create(sessionId: string, metadata: SessionMetadata): void;
  append(sessionId: string, event: DebateEvent): DebateEventEnvelope;
  get(sessionId: string): DebateSession | undefined;
  list(): SessionSummary[];
  delete(sessionId: string): void;
  updateStatus(sessionId: string, status: SessionStatus): void;
}

// InMemorySessionStore 구현
export class InMemorySessionStore implements SessionStore {
  private sessions = new Map<string, DebateSession>();
  private sequenceCounters = new Map<string, number>();

  create(sessionId: string, metadata: SessionMetadata): void {
    this.sessions.set(sessionId, {
      metadata,
      status: 'IDLE',
      events: [],
      updatedAt: metadata.createdAt,
    });
    this.sequenceCounters.set(sessionId, 0);
  }

  append(sessionId: string, event: DebateEvent): DebateEventEnvelope {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const current = this.sequenceCounters.get(sessionId) ?? 0;
    const sequence = current + 1;
    this.sequenceCounters.set(sessionId, sequence);

    const now = Date.now();
    const envelope: DebateEventEnvelope = {
      event,
      sequence,
      sessionId,
      timestamp: now,
    };

    session.events.push(envelope);
    session.updatedAt = now;

    return envelope;
  }

  get(sessionId: string): DebateSession | undefined {
    return this.sessions.get(sessionId);
  }

  list(): SessionSummary[] {
    return Array.from(this.sessions.values())
      .map((session) => ({
        sessionId: session.metadata.sessionId,
        question: session.metadata.question,
        status: session.status,
        createdAt: session.metadata.createdAt,
        updatedAt: session.updatedAt,
        eventCount: session.events.length,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  delete(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.sequenceCounters.delete(sessionId);
  }

  updateStatus(sessionId: string, status: SessionStatus): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    session.status = status;
    session.updatedAt = Date.now();
  }
}