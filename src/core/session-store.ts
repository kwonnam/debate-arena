import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { DebateAttachment, DebateMode } from '../types/debate.js';
import type { DebateEvent, DebateEventEnvelope } from '../types/debate-events.js';
import type { DebateParticipant } from '../types/roles.js';

export interface SessionParticipantSummary {
  id: DebateParticipant['id'];
  label: DebateParticipant['label'];
  provider: DebateParticipant['provider'];
}

// 세션 메타데이터
export interface SessionMetadata {
  sessionId: string;
  question: string;
  participants: SessionParticipantSummary[];
  participantDetails?: DebateParticipant[];
  rounds: number;
  createdAt: number; // Unix ms
  judge?: string;
  mode?: DebateMode;
  workflowKind?: 'news' | 'project' | 'general';
  executionCwd?: string;
  noContext?: boolean;
  attachments?: DebateAttachment[];
  evidence?: SessionEvidenceSummary;
  ollamaModel?: string;
  resumedFromSessionId?: string;
  resumeStage?: string;
  continuedFromSessionId?: string;
}

export interface SessionEvidenceSummary {
  id: string;
  kind: 'news' | 'web';
  query: string;
  collectedAt: string;
  articleCount: number;
  sources: string[];
  topDomains: string[];
  excludedCount: number;
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
  rounds: number;
  createdAt: number;
  updatedAt: number;
  eventCount: number;
  participants: SessionParticipantSummary[];
  judge?: string;
  mode?: DebateMode;
  workflowKind?: 'news' | 'project' | 'general';
  executionCwd?: string;
  evidence?: SessionEvidenceSummary;
  ollamaModel?: string;
  resumedFromSessionId?: string;
  resumeStage?: string;
  continuedFromSessionId?: string;
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

  hydrate(session: DebateSession): void {
    this.sessions.set(session.metadata.sessionId, session);
    const nextSequence = session.events.reduce((max, event) => Math.max(max, event.sequence), 0);
    this.sequenceCounters.set(session.metadata.sessionId, nextSequence);
  }

  list(): SessionSummary[] {
    return Array.from(this.sessions.values())
      .map((session) => ({
        sessionId: session.metadata.sessionId,
        question: session.metadata.question,
        status: session.status,
        rounds: session.metadata.rounds,
        createdAt: session.metadata.createdAt,
        updatedAt: session.updatedAt,
        eventCount: session.events.length,
        participants: session.metadata.participants,
        judge: session.metadata.judge,
        mode: session.metadata.mode,
        workflowKind: session.metadata.workflowKind,
        executionCwd: session.metadata.executionCwd,
        evidence: session.metadata.evidence,
        ollamaModel: session.metadata.ollamaModel,
        resumedFromSessionId: session.metadata.resumedFromSessionId,
        resumeStage: session.metadata.resumeStage,
        continuedFromSessionId: session.metadata.continuedFromSessionId,
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

interface PersistedSessionRecord {
  version: 1;
  session: DebateSession;
}

const DEFAULT_SESSION_STORE_DIR = resolve(process.cwd(), '.omc/sessions');

export class PersistentSessionStore implements SessionStore {
  private readonly store: InMemorySessionStore;
  private readonly rootDir: string;

  constructor(rootDir = DEFAULT_SESSION_STORE_DIR) {
    this.rootDir = resolve(rootDir);
    this.store = new InMemorySessionStore();
    this.loadFromDisk();
    this.recoverInterruptedSessions();
  }

  create(sessionId: string, metadata: SessionMetadata): void {
    this.store.create(sessionId, metadata);
    this.persist(sessionId);
  }

  append(sessionId: string, event: DebateEvent): DebateEventEnvelope {
    const envelope = this.store.append(sessionId, event);
    if (event.type !== 'agent_chunk') {
      this.persist(sessionId);
    }
    return envelope;
  }

  get(sessionId: string): DebateSession | undefined {
    return this.store.get(sessionId);
  }

  list(): SessionSummary[] {
    return this.store.list();
  }

  delete(sessionId: string): void {
    this.store.delete(sessionId);
    const filePath = this.getSessionFilePath(sessionId);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  }

  updateStatus(sessionId: string, status: SessionStatus): void {
    this.store.updateStatus(sessionId, status);
    this.persist(sessionId);
  }

  private loadFromDisk(): void {
    mkdirSync(this.rootDir, { recursive: true });

    for (const entry of readdirSync(this.rootDir)) {
      if (!entry.endsWith('.json')) continue;

      const filePath = join(this.rootDir, entry);
      try {
        const raw = readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw) as PersistedSessionRecord | DebateSession;
        const session = isPersistedSessionRecord(parsed) ? parsed.session : parsed;
        if (!isDebateSession(session)) continue;
        this.store.hydrate(session);
      } catch {
        // Ignore unreadable session files and keep loading others.
      }
    }
  }

  private recoverInterruptedSessions(): void {
    for (const summary of this.store.list()) {
      if (isTerminalStatus(summary.status)) {
        continue;
      }

      const session = this.store.get(summary.sessionId);
      if (!session) continue;

      this.store.append(summary.sessionId, {
        type: 'cancelled',
        sessionId: summary.sessionId,
        timestamp: Date.now(),
        payload: {
          reason: 'server_shutdown',
          lastRound: getLastKnownRound(session),
          lastProvider: getLastKnownProvider(session),
        },
      });
      this.store.updateStatus(summary.sessionId, 'CANCELLED');
      this.persist(summary.sessionId);
    }
  }

  private persist(sessionId: string): void {
    const session = this.store.get(sessionId);
    if (!session) return;

    mkdirSync(this.rootDir, { recursive: true });
    const record: PersistedSessionRecord = {
      version: 1,
      session,
    };
    writeFileSync(this.getSessionFilePath(sessionId), JSON.stringify(record, null, 2), 'utf-8');
  }

  private getSessionFilePath(sessionId: string): string {
    const safeSessionId = sanitizeSessionId(sessionId);
    return join(this.rootDir, `${safeSessionId}.json`);
  }
}

function isTerminalStatus(status: SessionStatus): boolean {
  return status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED';
}

function getLastKnownRound(session: DebateSession): number | undefined {
  for (let index = session.events.length - 1; index >= 0; index -= 1) {
    const event = session.events[index].event;
    if (event.type === 'round_state_ready') return event.payload.round;
    if (event.type === 'round_finished') return event.payload.round;
    if (event.type === 'round_started') return event.payload.round;
    if (event.type === 'agent_chunk') return event.payload.round;
  }

  return undefined;
}

function getLastKnownProvider(session: DebateSession): string | undefined {
  for (let index = session.events.length - 1; index >= 0; index -= 1) {
    const event = session.events[index].event;
    if (event.type === 'agent_chunk') return event.payload.provider;
    if (event.type === 'error') return event.payload.provider;
    if (event.type === 'synthesis_ready') return event.payload.judge;
  }

  return undefined;
}

function isPersistedSessionRecord(value: unknown): value is PersistedSessionRecord {
  return Boolean(
    value
    && typeof value === 'object'
    && 'version' in value
    && 'session' in value,
  );
}

function isDebateSession(value: unknown): value is DebateSession {
  return Boolean(
    value
    && typeof value === 'object'
    && 'metadata' in value
    && 'status' in value
    && 'events' in value
    && typeof (value as DebateSession).metadata?.sessionId === 'string',
  );
}

function sanitizeSessionId(sessionId: string): string {
  return sessionId.replace(/[^a-z0-9._-]+/gi, '-').slice(0, 80) || 'unknown-session';
}
