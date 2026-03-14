import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { streamSSE, type SSEStreamingApi } from 'hono/streaming';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { readdir, readFile, unlink } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { collectEvidence } from '../news/index.js';
import type { EvidenceKind, EvidenceSnapshot } from '../news/snapshot.js';
import { summarizeSnapshot } from '../news/snapshot.js';
import type { QueryTransformMode, SearchLanguageScope } from '../news/search-plan.js';
import type { DebateMode, DebateOptions, ProviderName, WorkflowKind } from '../types/debate.js';
import type { DebateEvent, DebateEventEnvelope } from '../types/debate-events.js';
import type { DebateParticipant, DebateParticipantRole } from '../types/roles.js';
import { DebateOrchestrator } from '../core/orchestrator.js';
import { normalizeDebateParticipants } from '../core/participants.js';
import { buildFollowUpContext } from '../core/follow-up.js';
import { buildResumePlan, hydrateParticipantsForResume } from '../core/resume.js';
import { PersistentSessionStore, type SessionStore } from '../core/session-store.js';
import { collectProjectContext } from '../core/project-context.js';
import { createProviderMap, listProviderModels, listProviderOptions } from '../providers/factory.js';
import { createSilentCallbacks } from '../ui/renderer.js';
import { EventHub } from './event-hub.js';
import {
  getDashboardLogPath,
  getSessionLogPath,
  logDashboard,
  logSession,
  readLogTail,
} from './runtime-log.js';
import { DEFAULT_DASHBOARD_CONFIG, DEFAULT_NEWS_CONFIG, type NewsConfig } from '../config/defaults.js';
import {
  applyValidationResult,
  getConfigEvents,
  getConfigState,
  getPendingSecret,
  registerPendingModel,
} from '../config/state.js';
import { OllamaCompatProvider } from '../providers/ollama-compat.js';
import { getDefaultRoleConfigYaml, getRoleConfigTemplateDefaults, loadRoleConfig, saveRoleConfig } from '../roles/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface RunSessionEntry {
  controller: AbortController;
  startedAt: number;
  timeoutMs: number;
  timeoutTimer: NodeJS.Timeout;
}

type StopReason = 'user_cancelled' | 'timeout' | 'server_shutdown';

type ExecuteCommand = 'run_debate';

interface DebateExecutionInput {
  question?: string;
  rounds?: number;
  judge?: ProviderName | 'both';
  mode?: DebateMode;
  participants?: DebateParticipantInput[];
  noContext?: boolean;
  executionCwd?: string;
  attachments?: DebateAttachmentInput[];
  snapshotId?: string;
  workflowKind?: WorkflowKind;
  ollamaModel?: string;
  previousSessionId?: string;
}

interface ExecuteRequestBody {
  command?: string;
  input?: DebateExecutionInput;
  timeoutMs?: number;
}

type AttachmentKind = 'text' | 'image';

interface DebateAttachmentInput {
  name?: string;
  kind?: AttachmentKind;
  mimeType?: string;
  content?: string;
}

interface DebateParticipantRoleInput {
  roleId?: string;
  roleLabel?: string;
  focus?: string;
  instructions?: string[];
  requiredQuestions?: string[];
}

interface DebateParticipantInput {
  id?: string;
  provider?: string;
  label?: string;
  role?: DebateParticipantRoleInput;
}

const EXECUTION_ALLOWLIST = new Set<ExecuteCommand>(['run_debate']);
const DEFAULT_EXECUTION_TIMEOUT_MS = 30 * 60 * 1000;
const MIN_EXECUTION_TIMEOUT_MS = 30 * 1000;
const MAX_EXECUTION_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_CONCURRENT_SESSIONS = 2;
const MAX_ATTACHMENTS = 6;
const MAX_ATTACHMENT_TEXT_CHARS = 12_000;
const MAX_ATTACHMENT_IMAGE_CHARS = 180_000;

class DashboardSessionStore implements SessionStore {
  constructor(
    private readonly store: SessionStore,
    private readonly hub: EventHub,
  ) {}

  create(sessionId: string, metadata: Parameters<SessionStore['create']>[1]): void {
    this.store.create(sessionId, metadata);
    logDashboard('INFO', 'session_created', {
      sessionId,
      question: metadata.question,
      workflowKind: metadata.workflowKind,
      rounds: metadata.rounds,
      judge: metadata.judge,
      participants: metadata.participants.map((participant) => ({
        id: participant.id,
        provider: participant.provider,
      })),
      executionCwd: metadata.executionCwd,
    });
    logSession(sessionId, 'INFO', 'session_created', {
      workflowKind: metadata.workflowKind,
      rounds: metadata.rounds,
      judge: metadata.judge,
      question: metadata.question,
      executionCwd: metadata.executionCwd,
      evidenceId: metadata.evidence?.id,
    });
  }

  append(sessionId: string, event: Parameters<SessionStore['append']>[1]): DebateEventEnvelope {
    const envelope = this.store.append(sessionId, event);
    this.hub.publish(envelope);
    if (event.type !== 'agent_chunk') {
      const eventSummary = summarizeEventForLog(event);
      logDashboard('DEBUG', 'session_event', { sessionId, ...eventSummary });
      logSession(sessionId, 'DEBUG', 'session_event', eventSummary);
    }
    return envelope;
  }

  get(sessionId: string) {
    return this.store.get(sessionId);
  }

  list() {
    return this.store.list();
  }

  delete(sessionId: string): void {
    this.store.delete(sessionId);
    logDashboard('INFO', 'session_deleted', { sessionId });
    logSession(sessionId, 'INFO', 'session_deleted');
  }

  updateStatus(sessionId: string, status: Parameters<SessionStore['updateStatus']>[1]): void {
    this.store.updateStatus(sessionId, status);
    logDashboard('INFO', 'session_status_changed', { sessionId, status });
    logSession(sessionId, 'INFO', 'session_status_changed', { status });
  }
}

let serverInstance: { close: () => void } | null = null;
const runningSessions = new Map<string, RunSessionEntry>();

export function getDashboardRuntimeStatus(): {
  serverRunning: boolean;
  runningSessionCount: number;
} {
  return {
    serverRunning: serverInstance !== null,
    runningSessionCount: runningSessions.size,
  };
}

export function stopDashboardRuntime(options?: {
  stopServer?: boolean;
  reason?: StopReason;
}): {
  stoppedSessions: number;
  serverStopped: boolean;
} {
  const reason: StopReason = options?.reason ?? 'user_cancelled';
  let stoppedSessions = 0;

  for (const [sessionId, entry] of runningSessions.entries()) {
    clearTimeout(entry.timeoutTimer);
    if (!entry.controller.signal.aborted) {
      entry.controller.abort(reason);
      stoppedSessions += 1;
      logDashboard('WARN', 'session_abort_requested', { sessionId, reason });
      logSession(sessionId, 'WARN', 'session_abort_requested', { reason });
    }
    runningSessions.delete(sessionId);
  }

  let serverStopped = false;
  if (options?.stopServer && serverInstance) {
    serverInstance.close();
    serverInstance = null;
    serverStopped = true;
    logDashboard('INFO', 'dashboard_server_stopped', { reason, stoppedSessions });
  }

  return { stoppedSessions, serverStopped };
}

export function startDashboardServer(): { url: string; port: number; close: () => void } {
  if (serverInstance) {
    logDashboard('INFO', 'dashboard_server_reused', { port: DEFAULT_DASHBOARD_CONFIG.port });
    return { url: getBaseUrl(DEFAULT_DASHBOARD_CONFIG.port), port: DEFAULT_DASHBOARD_CONFIG.port, close: serverInstance.close };
  }

  const config = DEFAULT_DASHBOARD_CONFIG;
  const hub = new EventHub();
  const baseStore = new PersistentSessionStore();
  const sessionStore = new DashboardSessionStore(baseStore, hub);
  const cleanupRunSession = (sessionId: string): void => {
    const entry = runningSessions.get(sessionId);
    if (!entry) return;
    clearTimeout(entry.timeoutTimer);
    runningSessions.delete(sessionId);
    logDashboard('DEBUG', 'session_runtime_cleaned', {
      sessionId,
      elapsedMs: Date.now() - entry.startedAt,
      timeoutMs: entry.timeoutMs,
    });
    logSession(sessionId, 'DEBUG', 'session_runtime_cleaned', {
      elapsedMs: Date.now() - entry.startedAt,
      timeoutMs: entry.timeoutMs,
    });
  };

  const parseDebateInput = (input: DebateExecutionInput): {
    question: string;
    rounds: number;
    judge: ProviderName | 'both';
    mode: DebateMode;
    participants?: DebateParticipant[];
    noContext: boolean;
    executionCwd?: string;
    attachments: ParsedAttachment[];
    ollamaModel?: string;
  } | null => {
    const question = input.question?.trim();
    if (!question) {
      return null;
    }

    const rounds = clampInteger(input.rounds, 1, 8, 3);
    const judge = parseJudge(input.judge) ?? 'claude';
    const mode = parseDebateMode(input.mode) ?? 'debate';
    const participants = parseParticipants(input.participants);
    if (input.participants && !participants) {
      return null;
    }

    const noContext = Boolean(input.noContext);
    const executionCwd = typeof input.executionCwd === 'string' ? input.executionCwd.trim() : '';
    const attachments = parseAttachments(input.attachments);
    const ollamaModel = typeof input.ollamaModel === 'string' ? input.ollamaModel.trim() : '';

    return {
      question,
      rounds,
      judge,
      mode,
      participants,
      noContext,
      executionCwd: executionCwd || undefined,
      attachments,
      ollamaModel: ollamaModel || undefined,
    };
  };

  const loadSnapshotById = async (snapshotId?: string): Promise<EvidenceSnapshot | undefined> => {
    if (!snapshotId || !/^[\w-]{1,64}$/.test(snapshotId)) {
      return undefined;
    }

    try {
      const snapPath = join(SNAPSHOT_DIR, `snap-${snapshotId}.json`);
      if (!resolve(snapPath).startsWith(resolve(SNAPSHOT_DIR))) {
        return undefined;
      }

      const raw = await readFile(snapPath, 'utf-8');
      return JSON.parse(raw) as EvidenceSnapshot;
    } catch {
      return undefined;
    }
  };

  const startDebateRun = (
    providerMap: ReturnType<typeof createProviderMap>,
    options: DebateOptions,
    participantProviders: string[],
    timeoutMsRaw?: number,
  ): (
    | {
      ok: true;
      sessionId: string;
      timeoutMs: number;
      resumedFromSessionId?: string;
      resumeStage?: string;
      continuedFromSessionId?: string;
    }
    | { ok: false; status: 429; error: string }
  ) => {
    if (runningSessions.size >= MAX_CONCURRENT_SESSIONS) {
      return {
        ok: false,
        status: 429,
        error: `Maximum concurrent sessions reached (${MAX_CONCURRENT_SESSIONS})`,
      };
    }

    const timeoutMs = normalizeTimeoutMs(timeoutMsRaw);
    const controller = new AbortController();
    const sessionId = randomUUID();
    const runOptions: DebateOptions = {
      ...options,
      sessionId,
      signal: controller.signal,
    };

    logDashboard('INFO', 'debate_request_accepted', {
      sessionId,
      rounds: runOptions.rounds,
      judge: runOptions.judge,
      workflowKind: runOptions.workflowKind,
      participantProviders,
      executionCwd: runOptions.executionCwd,
      timeoutMs,
      snapshotId: runOptions.snapshot?.id,
      resumedFromSessionId: runOptions.resumeFromSessionId,
      resumeStage: runOptions.resumeStage,
      continuedFromSessionId: runOptions.continuedFromSessionId,
    });
    logSession(sessionId, 'INFO', 'debate_request_accepted', {
      rounds: runOptions.rounds,
      judge: runOptions.judge,
      workflowKind: runOptions.workflowKind,
      participantProviders,
      executionCwd: runOptions.executionCwd,
      timeoutMs,
      snapshotId: runOptions.snapshot?.id,
      resumedFromSessionId: runOptions.resumeFromSessionId,
      resumeStage: runOptions.resumeStage,
      continuedFromSessionId: runOptions.continuedFromSessionId,
    });

    const timeoutTimer = setTimeout(() => {
      const running = runningSessions.get(sessionId);
      if (!running || running.controller.signal.aborted) return;
      logDashboard('WARN', 'session_timeout_triggered', {
        sessionId,
        elapsedMs: Date.now() - running.startedAt,
        timeoutMs: running.timeoutMs,
      });
      logSession(sessionId, 'WARN', 'session_timeout_triggered', {
        elapsedMs: Date.now() - running.startedAt,
        timeoutMs: running.timeoutMs,
      });
      running.controller.abort('timeout');
    }, timeoutMs);
    timeoutTimer.unref();

    runningSessions.set(sessionId, {
      controller,
      startedAt: Date.now(),
      timeoutMs,
      timeoutTimer,
    });

    const orchestrator = new DebateOrchestrator(
      providerMap,
      sessionStore,
      undefined,
      (message, meta) => {
        logDashboard('DEBUG', message, meta);
        const sessionLogId = typeof meta?.sessionId === 'string' ? meta.sessionId : sessionId;
        logSession(sessionLogId, 'DEBUG', message, meta);
      },
    );

    orchestrator
      .run(runOptions, createSilentCallbacks())
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        logDashboard('ERROR', 'debate_run_rejected', { sessionId, error: message });
        logSession(sessionId, 'ERROR', 'debate_run_rejected', { error: message });
        return null;
      })
      .finally(() => {
        cleanupRunSession(sessionId);
      });

    return {
      ok: true,
      sessionId,
      timeoutMs,
      resumedFromSessionId: runOptions.resumeFromSessionId,
      resumeStage: runOptions.resumeStage,
      continuedFromSessionId: runOptions.continuedFromSessionId,
    };
  };

  const loadPreviousDebateContext = (
    sourceSessionId?: string,
  ): (
    | { ok: true; previousDebate?: DebateOptions['previousDebate'] }
    | { ok: false; status: 400 | 404 | 409; error: string }
  ) => {
    const normalizedId = typeof sourceSessionId === 'string' ? sourceSessionId.trim() : '';
    if (!normalizedId) {
      return { ok: true };
    }

    if (!/^[\w.-]{1,80}$/.test(normalizedId)) {
      return { ok: false, status: 400, error: 'Invalid previousSessionId' };
    }

    const sourceSession = sessionStore.get(normalizedId);
    if (!sourceSession) {
      return { ok: false, status: 404, error: 'Previous session not found' };
    }

    if (runningSessions.has(normalizedId)) {
      return { ok: false, status: 409, error: 'The selected previous session is still running.' };
    }

    if (sourceSession.status !== 'COMPLETED') {
      return {
        ok: false,
        status: 409,
        error: `Only COMPLETED sessions can seed a follow-up debate (current: ${sourceSession.status}).`,
      };
    }

    try {
      return { ok: true, previousDebate: buildFollowUpContext(sourceSession) };
    } catch (error) {
      return {
        ok: false,
        status: 409,
        error: error instanceof Error ? error.message : 'Previous session cannot seed a follow-up debate.',
      };
    }
  };

  const runDebateFromInput = async (
    input: DebateExecutionInput,
    timeoutMsRaw?: number,
  ): Promise<
    | {
      ok: true;
      sessionId: string;
      timeoutMs: number;
      resumedFromSessionId?: string;
      resumeStage?: string;
      continuedFromSessionId?: string;
    }
    | { ok: false; status: 400 | 404 | 409 | 429; error: string }
  > => {
    const parsed = parseDebateInput(input);
    if (!parsed) {
      return { ok: false, status: 400, error: 'Invalid debate input payload' };
    }

    const executionCwdResult = resolveExecutionCwd(parsed.executionCwd);
    if (!executionCwdResult.ok) {
      return { ok: false, status: 400, error: executionCwdResult.error };
    }
    const executionCwd = executionCwdResult.cwd;

    const projectContext = parsed.noContext
      ? undefined
      : await collectProjectContext({ cwd: executionCwd });

    const questionWithAttachments = mergeQuestionWithAttachments(parsed.question, parsed.attachments);

    const snapshot = await loadSnapshotById(input.snapshotId);
    const previousDebateResult = loadPreviousDebateContext(input.previousSessionId);
    if (!previousDebateResult.ok) {
      return previousDebateResult;
    }

    const workflowKind = input.workflowKind
      ?? (snapshot?.kind === 'news' ? 'news' : 'general');
    const providerWorkflowError = validateWorkflowProviders(workflowKind, parsed.participants, parsed.judge);
    if (providerWorkflowError) {
      return { ok: false, status: 400, error: providerWorkflowError };
    }

    let providerMap: ReturnType<typeof createProviderMap>;
    try {
      providerMap = createProviderMap(parsed.participants, parsed.judge, {
        ollamaModel: parsed.ollamaModel,
      });
    } catch (error) {
      return {
        ok: false,
        status: 400,
        error: error instanceof Error ? error.message : 'Provider configuration error',
      };
    }

    return startDebateRun(
      providerMap,
      {
        question: questionWithAttachments,
        rounds: parsed.rounds,
        stream: true,
        synthesis: true,
        judge: parsed.judge,
        format: 'pretty',
        mode: parsed.mode,
        interactive: false,
        participants: parsed.participants,
        executionCwd,
        projectContext,
        noContext: parsed.noContext,
        attachments: parsed.attachments,
        snapshot,
        workflowKind,
        ollamaModel: parsed.ollamaModel,
        previousDebate: previousDebateResult.previousDebate,
        continuedFromSessionId: previousDebateResult.previousDebate?.sourceSessionId,
      },
      (parsed.participants ?? []).map((participant) => participant.provider),
      timeoutMsRaw,
    );
  };

  const resumeDebateSession = async (
    sourceSessionId: string,
    timeoutMsRaw?: number,
  ): Promise<
    | {
      ok: true;
      sessionId: string;
      timeoutMs: number;
      resumedFromSessionId?: string;
      resumeStage?: string;
      continuedFromSessionId?: string;
    }
    | { ok: false; status: 400 | 404 | 409 | 429; error: string }
  > => {
    const sourceSession = sessionStore.get(sourceSessionId);
    if (!sourceSession) {
      return { ok: false, status: 404, error: 'Session not found' };
    }

    if (runningSessions.has(sourceSessionId)) {
      return { ok: false, status: 409, error: 'The selected session is still running.' };
    }

    if (sourceSession.status !== 'FAILED' && sourceSession.status !== 'CANCELLED') {
      return {
        ok: false,
        status: 409,
        error: `Only FAILED or CANCELLED sessions can be resumed (current: ${sourceSession.status}).`,
      };
    }

    let resumePlan: ReturnType<typeof buildResumePlan>;
    try {
      resumePlan = buildResumePlan(sourceSession);
    } catch (error) {
      return {
        ok: false,
        status: 409,
        error: error instanceof Error ? error.message : 'Session cannot be resumed.',
      };
    }

    const executionCwdResult = resolveExecutionCwd(sourceSession.metadata.executionCwd);
    if (!executionCwdResult.ok) {
      return { ok: false, status: 400, error: executionCwdResult.error };
    }
    const executionCwd = executionCwdResult.cwd;

    const participants = hydrateParticipantsForResume(sourceSession.metadata);
    const snapshot = await loadSnapshotById(sourceSession.metadata.evidence?.id);
    const workflowKind = sourceSession.metadata.workflowKind
      ?? (snapshot?.kind === 'news' ? 'news' : 'general');
    const judge = parseJudge(sourceSession.metadata.judge) ?? 'claude';
    const providerWorkflowError = validateWorkflowProviders(workflowKind, participants, judge);
    if (providerWorkflowError) {
      return { ok: false, status: 400, error: providerWorkflowError };
    }

    let providerMap: ReturnType<typeof createProviderMap>;
    try {
      providerMap = createProviderMap(participants, judge, {
        ollamaModel: sourceSession.metadata.ollamaModel,
      });
    } catch (error) {
      return {
        ok: false,
        status: 400,
        error: error instanceof Error ? error.message : 'Provider configuration error',
      };
    }

    const projectContext = sourceSession.metadata.noContext
      ? undefined
      : await collectProjectContext({ cwd: executionCwd });

    return startDebateRun(
      providerMap,
      {
        question: sourceSession.metadata.question,
        rounds: sourceSession.metadata.rounds,
        stream: true,
        synthesis: true,
        judge,
        format: 'pretty',
        mode: sourceSession.metadata.mode ?? 'debate',
        interactive: false,
        participants,
        executionCwd,
        projectContext,
        noContext: sourceSession.metadata.noContext,
        attachments: sourceSession.metadata.attachments ?? [],
        snapshot,
        workflowKind,
        ollamaModel: sourceSession.metadata.ollamaModel,
        initialMessages: resumePlan.initialMessages,
        initialRoundStates: resumePlan.initialRoundStates,
        resumeFromRound: resumePlan.startRound,
        resumeFromSessionId: sourceSession.metadata.sessionId,
        resumeStage: resumePlan.resumeStage,
      },
      participants.map((participant) => participant.provider),
      timeoutMsRaw,
    );
  };

  const app = new Hono();
  app.use('*', cors({ origin: config.corsOrigin, credentials: false }));

  const dashboardDir = resolveDashboardDir();
  const dashboardIndex = readFileSync(join(dashboardDir, 'index.html'), 'utf-8');
  logDashboard('INFO', 'dashboard_assets_resolved', { dashboardDir, logFile: getDashboardLogPath() });
  app.get('/', (c: Context) => c.html(dashboardIndex));
  app.use('/*', serveStatic({ root: dashboardDir }));

  const SNAPSHOT_DIR = './ffm-snapshots';

  app.get('/api/snapshots', async (c: Context) => {
    try {
      let files: string[];
      try {
        files = await readdir(SNAPSHOT_DIR);
      } catch {
        return c.json({ snapshots: [] });
      }
      const jsonFiles = files.filter((f) => f.startsWith('snap-') && f.endsWith('.json'));
      const snapshots = await Promise.all(
        jsonFiles.map(async (file) => {
          const raw = await readFile(join(SNAPSHOT_DIR, file), 'utf-8');
          const snap = JSON.parse(raw) as EvidenceSnapshot;
          const summary = summarizeSnapshot(snap);
          return {
            ...summary,
            createdAt: summary.collectedAt,
          };
        }),
      );
      snapshots.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return c.json({ snapshots });
    } catch (err) {
      return c.json({ error: 'Failed to list snapshots' }, 500);
    }
  });

  app.get('/api/snapshots/:id', async (c: Context) => {
    const id = c.req.param('id');
    if (!/^[\w-]{1,64}$/.test(id)) {
      return c.json({ error: 'Invalid snapshot ID' }, 400);
    }
    const filePath = join(SNAPSHOT_DIR, `snap-${id}.json`);
    if (!resolve(filePath).startsWith(resolve(SNAPSHOT_DIR))) {
      return c.json({ error: 'Invalid snapshot ID' }, 400);
    }
    try {
      const raw = await readFile(filePath, 'utf-8');
      const snap = JSON.parse(raw) as EvidenceSnapshot;
      return c.json(snap);
    } catch {
      return c.json({ error: 'Snapshot not found' }, 404);
    }
  });

  app.post('/api/snapshots/collect', async (c: Context) => {
    let body: {
      query?: string;
      kind?: string;
      scope?: string;
      newsMode?: string;
      sources?: string[];
      queryTransformMode?: string;
      queryLanguageScope?: string;
    };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }
    const query = body.query?.trim();
    if (!query) {
      return c.json({ error: 'query is required' }, 400);
    }
    const evidenceKind = parseEvidenceKind(body.kind ?? body.scope);
    const newsConfig = createNewsConfig(body.sources, evidenceKind);
    const queryTransformMode = parseQueryTransformMode(body.queryTransformMode);
    const queryLanguageScope = parseSearchLanguageScope(body.queryLanguageScope);
    logDashboard('INFO', 'snapshot_collect_requested', {
      query,
      kind: evidenceKind,
      sources: body.sources,
      queryTransformMode,
      queryLanguageScope,
    });
    try {
      const snapshot = await collectEvidence(query, {
        kind: evidenceKind,
        snapshotDir: SNAPSHOT_DIR,
        queryTransform: {
          mode: queryTransformMode,
          languageScope: queryLanguageScope,
        },
      }, newsConfig);
      const summary = summarizeSnapshot(snapshot);
      logDashboard('INFO', 'snapshot_collect_completed', {
        query,
        kind: summary.kind,
        snapshotId: summary.id,
        articleCount: summary.articleCount,
        sourceCount: summary.sources.length,
      });
      return c.json({
        ...summary,
        snapshotId: summary.id,
        createdAt: summary.collectedAt,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to collect evidence';
      logDashboard('ERROR', 'snapshot_collect_failed', {
        query,
        kind: evidenceKind,
        error: message,
      });
      return c.json({ error: message }, 500);
    }
  });

  app.delete('/api/snapshots/:id', async (c: Context) => {
    const id = c.req.param('id');
    if (!/^[\w-]{1,64}$/.test(id)) {
      return c.json({ error: 'Invalid snapshot ID' }, 400);
    }
    const filePath = join(SNAPSHOT_DIR, `snap-${id}.json`);
    if (!resolve(filePath).startsWith(resolve(SNAPSHOT_DIR))) {
      return c.json({ error: 'Invalid snapshot ID' }, 400);
    }
    try {
      await unlink(filePath);
      return c.json({ ok: true });
    } catch {
      return c.json({ error: 'Snapshot not found' }, 404);
    }
  });

  app.get('/api/sessions', (c: Context) => c.json({ sessions: sessionStore.list() }));

  app.get('/api/roles', (c: Context) => {
    try {
      const loaded = loadRoleConfig();
      return c.json({
        path: loaded.path,
        config: loaded.config,
        defaults: getRoleConfigTemplateDefaults(loaded.config),
        defaultRaw: getDefaultRoleConfigYaml(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '역할 설정을 불러오지 못했습니다.';
      return c.json({ error: message }, 500);
    }
  });

  app.get('/api/roles/config', (c: Context) => {
    try {
      const loaded = loadRoleConfig();
      return c.json({
        path: loaded.path,
        raw: loaded.raw,
        config: loaded.config,
        defaults: getRoleConfigTemplateDefaults(loaded.config),
        defaultRaw: getDefaultRoleConfigYaml(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '역할 설정 YAML을 불러오지 못했습니다.';
      return c.json({ error: message }, 500);
    }
  });

  app.put('/api/roles/config', async (c: Context) => {
    let body: { raw?: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    if (typeof body.raw !== 'string' || !body.raw.trim()) {
      return c.json({ error: 'raw YAML is required' }, 400);
    }

    try {
      const saved = saveRoleConfig(body.raw);
      return c.json({
        ok: true,
        path: saved.path,
        raw: saved.raw,
        config: saved.config,
        defaults: getRoleConfigTemplateDefaults(saved.config),
        defaultRaw: getDefaultRoleConfigYaml(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '역할 설정 YAML 저장에 실패했습니다.';
      return c.json({ error: message }, 400);
    }
  });

  app.get('/api/providers', (c: Context) => {
    const options = listProviderOptions();
    return c.json({
      providers: options,
      judgeOptions: [...options.map((provider) => provider.name), 'both'],
    });
  });

  app.get('/api/providers/:id/models', async (c: Context) => {
    const providerId = c.req.param('id');

    try {
      const models = await listProviderModels(providerId);
      return c.json({ providerId, models });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load provider models';
      return c.json({ error: message }, 400);
    }
  });

  app.get('/api/runtime', (c: Context) => {
    return c.json({
      cwd: process.cwd(),
      dashboardLogPath: getDashboardLogPath(),
    });
  });

  app.get('/api/logs/dashboard', (c: Context) => {
    const lines = clampInteger(Number(c.req.query('lines') ?? '200'), 1, 1000, 200);
    const path = getDashboardLogPath();
    return c.json({
      path,
      lines: readLogTail(path, lines),
    });
  });

  app.get('/api/logs/sessions/:id', (c: Context) => {
    const sessionId = c.req.param('id');
    if (!/^[\w.-]{1,80}$/.test(sessionId)) {
      return c.json({ error: 'Invalid session ID' }, 400);
    }

    const lines = clampInteger(Number(c.req.query('lines') ?? '200'), 1, 1000, 200);
    const path = getSessionLogPath(sessionId);
    return c.json({
      path,
      lines: readLogTail(path, lines),
    });
  });

  app.get('/api/sessions/:id/events', (c: Context) => {
    const sessionId = c.req.param('id');
    const fromSequence = Number(c.req.query('fromSequence') ?? '1');
    const session = sessionStore.get(sessionId);
    if (!session) {
      return c.json({ error: 'Session not found' }, 404);
    }

    const events = session.events.filter((event) => event.sequence >= fromSequence);
    const lastSequence = session.events.at(-1)?.sequence ?? 0;
    const firstSequence = events.at(0)?.sequence;
    const hasGap = fromSequence > lastSequence + 1 || Boolean(firstSequence && firstSequence > fromSequence);
    const nextSequence = lastSequence + 1;

    return c.json({ events, nextSequence, hasGap });
  });

  app.get('/api/sessions/:id/stream', (c: Context) => {
    const sessionId = c.req.param('id');
    const session = sessionStore.get(sessionId);
    if (!session) {
      return c.json({ error: 'Session not found' }, 404);
    }

    return streamSSE(c, async (stream: SSEStreamingApi) => {
      const unsubscribe = hub.subscribe(sessionId, (event) => {
        stream.writeSSE({
          event: 'debate',
          data: JSON.stringify(event),
        });
      });

      const keepAlive = setInterval(() => {
        stream.writeSSE({ event: 'ping', data: String(Date.now()) });
      }, 15000);

      stream.writeSSE({
        event: 'hello',
        data: JSON.stringify({ sessionId, nextSequence: session.events.at(-1)?.sequence ?? 0 }),
      });

      await new Promise<void>((resolve) => {
        stream.onAbort(() => resolve());
      });

      clearInterval(keepAlive);
      unsubscribe();
    });
  });

  app.post('/api/sessions/:id/stop', (c: Context) => {
    const sessionId = c.req.param('id');
    const entry = runningSessions.get(sessionId);
    if (!entry) {
      return c.json({ error: 'Session not running here' }, 404);
    }
    entry.controller.abort('user_cancelled');
    logDashboard('WARN', 'session_stop_requested', { sessionId });
    logSession(sessionId, 'WARN', 'session_stop_requested');
    return c.json({ ok: true });
  });

  app.post('/api/sessions/:id/resume', async (c: Context) => {
    const sessionId = c.req.param('id');
    let body: { timeoutMs?: number } = {};

    try {
      body = await c.req.json<{ timeoutMs?: number }>();
    } catch {
      // Allow empty body.
    }

    const result = await resumeDebateSession(sessionId, body.timeoutMs);
    if (!result.ok) {
      return c.json({ error: result.error }, result.status);
    }

    return c.json({
      ok: true,
      sessionId: result.sessionId,
      timeoutMs: result.timeoutMs,
      resumedFromSessionId: result.resumedFromSessionId,
      resumeStage: result.resumeStage,
      continuedFromSessionId: result.continuedFromSessionId,
    });
  });

  app.post('/api/sessions/:id/follow-up', async (c: Context) => {
    const sessionId = c.req.param('id');
    const sourceSession = sessionStore.get(sessionId);
    if (!sourceSession) {
      return c.json({ error: 'Session not found' }, 404);
    }

    let body: DebateExecutionInput & { timeoutMs?: number } = {};
    try {
      body = await c.req.json<DebateExecutionInput & { timeoutMs?: number }>();
    } catch {
      // Allow empty body.
    }

    const participants = body.participants ?? hydrateParticipantsForResume(sourceSession.metadata);
    const result = await runDebateFromInput({
      question: body.question,
      rounds: body.rounds ?? sourceSession.metadata.rounds,
      judge: body.judge ?? (parseJudge(sourceSession.metadata.judge) ?? 'claude'),
      mode: body.mode ?? sourceSession.metadata.mode,
      participants,
      noContext: body.noContext ?? sourceSession.metadata.noContext,
      executionCwd: body.executionCwd ?? sourceSession.metadata.executionCwd,
      attachments: body.attachments ?? sourceSession.metadata.attachments,
      snapshotId: body.snapshotId ?? sourceSession.metadata.evidence?.id,
      workflowKind: body.workflowKind ?? sourceSession.metadata.workflowKind,
      ollamaModel: body.ollamaModel ?? sourceSession.metadata.ollamaModel,
      previousSessionId: sessionId,
    }, body.timeoutMs);

    if (!result.ok) {
      return c.json({ error: result.error }, result.status);
    }

    return c.json({
      ok: true,
      sessionId: result.sessionId,
      timeoutMs: result.timeoutMs,
      continuedFromSessionId: result.continuedFromSessionId,
    });
  });

  app.post('/api/sessions/stop', (c: Context) => {
    const { stoppedSessions } = stopDashboardRuntime({ reason: 'user_cancelled' });
    return c.json({ ok: true, stoppedSessions });
  });

  app.post('/api/execute', async (c: Context) => {
    const body = await c.req.json<ExecuteRequestBody>();
    const command = body.command as ExecuteCommand | undefined;

    if (!command || !EXECUTION_ALLOWLIST.has(command)) {
      return c.json({
        error: 'Command is not allowed',
        allowlist: Array.from(EXECUTION_ALLOWLIST),
      }, 400);
    }

    if (command === 'run_debate') {
      const result = await runDebateFromInput(body.input ?? {}, body.timeoutMs);
      if (!result.ok) {
        return c.json({ error: result.error }, result.status);
      }

      return c.json({
        ok: true,
        command,
        sessionId: result.sessionId,
        timeoutMs: result.timeoutMs,
        continuedFromSessionId: result.continuedFromSessionId,
      });
    }

    return c.json({ error: 'Unsupported command' }, 400);
  });

  app.post('/api/debates', async (c: Context) => {
    const body = await c.req.json<DebateExecutionInput & { timeoutMs?: number }>();
    const result = await runDebateFromInput(body, body.timeoutMs);
    if (!result.ok) {
      return c.json({ error: result.error }, result.status);
    }
    return c.json({
      sessionId: result.sessionId,
      timeoutMs: result.timeoutMs,
      continuedFromSessionId: result.continuedFromSessionId,
    });
  });

  app.get('/api/config/state', (c: Context) => c.json(getConfigState()));

  app.get('/api/config/events', (c: Context) => {
    const fromRevision = Number(c.req.query('fromRevision') ?? '0');
    return c.json({ events: getConfigEvents(fromRevision) });
  });

  app.post('/api/models', async (c: Context) => {
    const body = await c.req.json<{
      id?: string;
      type?: 'ollama-compat' | 'anthropic' | 'cli';
      baseUrl?: string;
      model?: string;
      apiKey?: string;
      expectedVersion?: number;
    }>();

    const result = registerPendingModel({
      id: body.id ?? '',
      type: body.type ?? 'ollama-compat',
      baseUrl: body.baseUrl,
      model: body.model ?? '',
      apiKey: body.apiKey,
      expectedVersion: body.expectedVersion,
    });

    if (!result.accepted) {
      return c.json({ error: result.error, state: result.state }, 409);
    }

    const pendingSecret = getPendingSecret();
    if (pendingSecret) {
      if (body.type !== 'ollama-compat') {
        applyValidationResult(pendingSecret.requestId, true, 'Validation skipped');
      } else if (!body.baseUrl) {
        applyValidationResult(pendingSecret.requestId, false, 'Missing baseUrl for validation');
      } else if (!pendingSecret.apiKey) {
        applyValidationResult(pendingSecret.requestId, false, 'Missing apiKey for validation');
      } else {
        void validateConnectivity(body.baseUrl, pendingSecret.apiKey, pendingSecret.requestId);
      }
    }

    return c.json(result.state);
  });

  const server = serve({ fetch: app.fetch, port: config.port, hostname: config.host });
  serverInstance = server;
  logDashboard('INFO', 'dashboard_server_started', {
    url: getBaseUrl(config.port),
    host: config.host,
    port: config.port,
    logFile: getDashboardLogPath(),
  });

  return {
    url: getBaseUrl(config.port),
    port: config.port,
    close: () => {
      stopDashboardRuntime({ stopServer: true, reason: 'server_shutdown' });
    },
  };
}

function createNewsConfig(sources?: string[], kind: EvidenceKind = 'news'): NewsConfig {
  const selected = new Set((sources ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean));
  if (selected.size === 0) {
    return DEFAULT_NEWS_CONFIG;
  }

  const braveEnabled = (
    selected.has('brave')
    || selected.has('brave-web')
    || selected.has('braveweb')
  );

  return {
    ...DEFAULT_NEWS_CONFIG,
    providers: {
      brave: { enabled: braveEnabled && DEFAULT_NEWS_CONFIG.providers.brave.enabled },
      braveWeb: {
        enabled: braveEnabled && (
          DEFAULT_NEWS_CONFIG.providers.braveWeb?.enabled
          ?? DEFAULT_NEWS_CONFIG.providers.brave.enabled
        ),
      },
      newsapi: { enabled: selected.has('newsapi') && DEFAULT_NEWS_CONFIG.providers.newsapi.enabled },
      rss: {
        ...DEFAULT_NEWS_CONFIG.providers.rss,
        enabled: kind === 'news' && selected.has('rss') && DEFAULT_NEWS_CONFIG.providers.rss.enabled,
      },
    },
  };
}

function parseEvidenceKind(value: unknown): EvidenceKind {
  return value === 'web' ? 'web' : 'news';
}

function parseQueryTransformMode(value: unknown): QueryTransformMode {
  return value === 'expand' ? 'expand' : 'off';
}

function parseSearchLanguageScope(value: unknown): SearchLanguageScope {
  return value === 'ko' || value === 'en' || value === 'both' ? value : 'input';
}

function summarizeEventForLog(event: DebateEvent): Record<string, unknown> {
  switch (event.type) {
    case 'round_started':
      return {
        type: event.type,
        round: event.payload.round,
        totalRounds: event.payload.totalRounds,
        participants: event.payload.participants.map((participant) => ({
          id: participant.id,
          provider: participant.provider,
        })),
      };
    case 'agent_chunk':
      return {
        type: event.type,
        round: event.payload.round,
        phase: event.payload.phase,
        provider: event.payload.provider,
        participantId: event.payload.participantId,
        chunkChars: event.payload.token.length,
      };
    case 'round_finished':
      return {
        type: event.type,
        round: event.payload.round,
        messageCount: event.payload.messages.length,
        providers: event.payload.messages.map((message) => message.provider),
      };
    case 'round_state_ready':
      return {
        type: event.type,
        round: event.payload.round,
        shouldSuggestStop: event.payload.shouldSuggestStop,
        source: event.payload.source,
        warning: event.payload.warning,
      };
    case 'synthesis_ready':
      return {
        type: event.type,
        status: event.payload.status,
        judge: event.payload.judge,
        contentChars: event.payload.content?.length ?? 0,
      };
    case 'cancelled':
      return {
        type: event.type,
        reason: event.payload.reason,
        lastRound: event.payload.lastRound,
        lastProvider: event.payload.lastProvider,
      };
    case 'error':
      return {
        type: event.type,
        code: event.payload.code,
        message: event.payload.message,
        provider: event.payload.provider,
        round: event.payload.round,
        retryable: event.payload.retryable,
      };
    default:
      return { type: event.type };
  }
}

function getBaseUrl(port: number): string {
  return `http://localhost:${port}`;
}

async function validateConnectivity(baseUrl: string, apiKey: string, requestId: string): Promise<void> {
  try {
    const provider = new OllamaCompatProvider('pending', baseUrl, apiKey);
    const ok = await provider.validateApiKey();
    applyValidationResult(requestId, ok, ok ? undefined : 'Provider validation failed');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connectivity check failed';
    applyValidationResult(requestId, false, message);
  }
}

function parseParticipants(input: unknown): DebateParticipant[] | undefined {
  if (!Array.isArray(input)) {
    return undefined;
  }
  if (input.length < 2 || input.length > 6) {
    return undefined;
  }

  const parsed = input.map((entry, index) => parseParticipant(entry, index));
  if (parsed.some((participant) => !participant)) {
    return undefined;
  }

  const participants = normalizeDebateParticipants(parsed as DebateParticipant[]);
  const uniqueIds = new Set(participants.map((participant) => participant.id));
  if (uniqueIds.size !== participants.length) {
    return undefined;
  }

  return participants;
}

function parseParticipant(input: unknown, index: number): DebateParticipant | undefined {
  if (!input || typeof input !== 'object') {
    return undefined;
  }

  const value = input as DebateParticipantInput;
  const provider = normalizeProviderName(value.provider);
  const label = sanitizeParticipantText(value.label);
  const role = parseParticipantRole(value.role);
  const id = sanitizeParticipantId(value.id || role?.roleId || `${provider}-${index + 1}`);

  if (!provider || !isValidProviderId(provider) || !label || !role || !id) {
    return undefined;
  }

  return {
    id,
    provider: provider as ProviderName,
    label,
    role,
  };
}

function parseParticipantRole(input: unknown): DebateParticipantRole | undefined {
  if (!input || typeof input !== 'object') {
    return undefined;
  }

  const value = input as DebateParticipantRoleInput;
  const roleId = sanitizeParticipantId(value.roleId);
  const roleLabel = sanitizeParticipantText(value.roleLabel);
  const focus = sanitizeParticipantText(value.focus);
  const instructions = Array.isArray(value.instructions)
    ? value.instructions.map(sanitizeParticipantText).filter(Boolean)
    : [];
  const requiredQuestions = Array.isArray(value.requiredQuestions)
    ? value.requiredQuestions.map(sanitizeParticipantText).filter(Boolean)
    : [];

  if (!roleId || !roleLabel || !focus) {
    return undefined;
  }

  return {
    roleId,
    roleLabel,
    focus,
    instructions,
    requiredQuestions,
  };
}

function parseJudge(input: unknown): ProviderName | 'both' | undefined {
  if (typeof input !== 'string') return undefined;
  const judge = input.trim().toLowerCase();
  if (!judge) return undefined;
  if (judge === 'both') return 'both';
  if (isValidProviderId(judge)) return judge as ProviderName;
  return undefined;
}

function parseDebateMode(input: unknown): DebateMode | undefined {
  if (typeof input !== 'string') return undefined;
  const mode = input.trim().toLowerCase();
  if (mode === 'debate' || mode === 'discussion' || mode === 'plan') {
    return mode;
  }
  return undefined;
}

function usesOllama(
  participants?: DebateParticipant[],
  judge?: ProviderName | 'both',
): boolean {
  if (participants?.some((participant) => isOllamaProviderId(participant.provider))) {
    return true;
  }

  return isOllamaProviderId(judge);
}

function validateWorkflowProviders(
  workflowKind: WorkflowKind,
  participants?: DebateParticipant[],
  judge?: ProviderName | 'both',
): string | null {
  if (workflowKind !== 'project') {
    return null;
  }

  if (usesOllama(participants, judge)) {
    return 'Project workflow supports CLI providers only (codex, claude, gemini).';
  }

  return null;
}

function isOllamaProviderId(provider: unknown): boolean {
  return typeof provider === 'string' && provider.trim().toLowerCase().startsWith('ollama');
}

function normalizeProviderName(input: unknown): string {
  return typeof input === 'string' ? input.trim().toLowerCase() : '';
}

function sanitizeParticipantText(input: unknown): string {
  return typeof input === 'string' ? input.trim().slice(0, 120) : '';
}

function sanitizeParticipantId(input: unknown): string {
  const value = typeof input === 'string' ? input.trim().toLowerCase() : '';
  if (!value) return '';
  return value
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

function isValidProviderId(input: string): boolean {
  return /^[a-z0-9][a-z0-9._-]{0,62}$/i.test(input);
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  const integer = Math.trunc(value);
  return Math.max(min, Math.min(max, integer));
}

interface ParsedAttachment {
  name: string;
  kind: AttachmentKind;
  mimeType: string;
  content: string;
}

function parseAttachments(input: DebateAttachmentInput[] | undefined): ParsedAttachment[] {
  if (!Array.isArray(input) || input.length === 0) {
    return [];
  }

  const parsed: ParsedAttachment[] = [];
  for (const raw of input.slice(0, MAX_ATTACHMENTS)) {
    if (!raw || typeof raw !== 'object') continue;

    const name = sanitizeAttachmentName(raw.name);
    const kind = raw.kind === 'image' ? 'image' : 'text';
    const mimeType = sanitizeMimeType(raw.mimeType, kind);
    const maxChars = kind === 'image' ? MAX_ATTACHMENT_IMAGE_CHARS : MAX_ATTACHMENT_TEXT_CHARS;
    const content = String(raw.content ?? '').slice(0, maxChars);

    if (!content.trim()) continue;

    parsed.push({
      name,
      kind,
      mimeType,
      content,
    });
  }

  return parsed;
}

function sanitizeAttachmentName(raw: unknown): string {
  const fallback = 'attachment';
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return fallback;
  return value.slice(0, 120);
}

function sanitizeMimeType(raw: unknown, kind: AttachmentKind): string {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return kind === 'image' ? 'image/unknown' : 'text/plain';
  return value.slice(0, 80);
}

function mergeQuestionWithAttachments(question: string, attachments: ParsedAttachment[]): string {
  if (attachments.length === 0) {
    return question;
  }

  const sections: string[] = [question, '', '---', '## Attached Inputs'];

  for (const attachment of attachments) {
    if (attachment.kind === 'image') {
      sections.push(
        `### Image: ${attachment.name}`,
        `- mimeType: ${attachment.mimeType}`,
        '- image payload is attached separately for multimodal-capable providers',
      );
      continue;
    }

    sections.push(
      `### File: ${attachment.name}`,
      `- mimeType: ${attachment.mimeType}`,
      '- text payload is attached separately for provider consumption',
    );
  }

  return sections.join('\n');
}

function normalizeTimeoutMs(value: unknown): number {
  const normalized = clampInteger(
    value,
    MIN_EXECUTION_TIMEOUT_MS,
    MAX_EXECUTION_TIMEOUT_MS,
    DEFAULT_EXECUTION_TIMEOUT_MS,
  );
  return normalized;
}

function resolveExecutionCwd(raw: string | undefined): { ok: true; cwd: string } | { ok: false; error: string } {
  const candidate = raw ? resolve(raw) : process.cwd();

  try {
    const stat = statSync(candidate);
    if (!stat.isDirectory()) {
      return { ok: false, error: `executionCwd is not a directory: ${candidate}` };
    }
    return { ok: true, cwd: candidate };
  } catch {
    return { ok: false, error: `executionCwd does not exist: ${candidate}` };
  }
}

function resolveDashboardDir(): string {
  const candidates = [
    join(__dirname, '../../dashboard'),
    join(__dirname, '../../../dashboard'),
  ];

  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'index.html'))) {
      return candidate;
    }
  }

  throw new Error(
    `Dashboard assets not found. Checked: ${candidates.map((path) => join(path, 'index.html')).join(', ')}`,
  );
}
