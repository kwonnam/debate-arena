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
import type { EvidenceSnapshot } from '../news/snapshot.js';
import type { DebateOptions, ProviderName } from '../types/debate.js';
import type { DebateEventEnvelope } from '../types/debate-events.js';
import { DebateOrchestrator } from '../core/orchestrator.js';
import { InMemorySessionStore, type SessionStore } from '../core/session-store.js';
import { collectProjectContext } from '../core/project-context.js';
import { createProviderMap, listProviderOptions } from '../providers/factory.js';
import { createSilentCallbacks } from '../ui/renderer.js';
import { EventHub } from './event-hub.js';
import { DEFAULT_DASHBOARD_CONFIG } from '../config/defaults.js';
import {
  applyValidationResult,
  getConfigEvents,
  getConfigState,
  getPendingSecret,
  registerPendingModel,
} from '../config/state.js';
import { OllamaCompatProvider } from '../providers/ollama-compat.js';

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
  participants?: [ProviderName, ProviderName];
  noContext?: boolean;
  executionCwd?: string;
  attachments?: DebateAttachmentInput[];
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

const EXECUTION_ALLOWLIST = new Set<ExecuteCommand>(['run_debate']);
const DEFAULT_EXECUTION_TIMEOUT_MS = 15 * 60 * 1000;
const MIN_EXECUTION_TIMEOUT_MS = 30 * 1000;
const MAX_EXECUTION_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_CONCURRENT_SESSIONS = 2;
const MAX_ATTACHMENTS = 6;
const MAX_ATTACHMENT_TEXT_CHARS = 12_000;
const MAX_ATTACHMENT_IMAGE_CHARS = 180_000;

class DashboardSessionStore implements SessionStore {
  constructor(
    private readonly store: InMemorySessionStore,
    private readonly hub: EventHub,
  ) {}

  create(sessionId: string, metadata: Parameters<SessionStore['create']>[1]): void {
    this.store.create(sessionId, metadata);
  }

  append(sessionId: string, event: Parameters<SessionStore['append']>[1]): DebateEventEnvelope {
    const envelope = this.store.append(sessionId, event);
    this.hub.publish(envelope);
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
  }

  updateStatus(sessionId: string, status: Parameters<SessionStore['updateStatus']>[1]): void {
    this.store.updateStatus(sessionId, status);
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
    }
    runningSessions.delete(sessionId);
  }

  let serverStopped = false;
  if (options?.stopServer && serverInstance) {
    serverInstance.close();
    serverInstance = null;
    serverStopped = true;
  }

  return { stoppedSessions, serverStopped };
}

export function startDashboardServer(): { url: string; port: number; close: () => void } {
  if (serverInstance) {
    return { url: getBaseUrl(DEFAULT_DASHBOARD_CONFIG.port), port: DEFAULT_DASHBOARD_CONFIG.port, close: serverInstance.close };
  }

  const config = DEFAULT_DASHBOARD_CONFIG;
  const hub = new EventHub();
  const baseStore = new InMemorySessionStore();
  const sessionStore = new DashboardSessionStore(baseStore, hub);
  const cleanupRunSession = (sessionId: string): void => {
    const entry = runningSessions.get(sessionId);
    if (!entry) return;
    clearTimeout(entry.timeoutTimer);
    runningSessions.delete(sessionId);
  };

  const parseDebateInput = (input: DebateExecutionInput): {
    question: string;
    rounds: number;
    judge: ProviderName | 'both';
    participants?: [ProviderName, ProviderName];
    noContext: boolean;
    executionCwd?: string;
    attachments: ParsedAttachment[];
  } | null => {
    const question = input.question?.trim();
    if (!question) {
      return null;
    }

    const rounds = clampInteger(input.rounds, 1, 8, 3);
    const judge = parseJudge(input.judge) ?? 'claude';
    const participants = parseParticipants(input.participants);
    if (input.participants && !participants) {
      return null;
    }

    const noContext = Boolean(input.noContext);
    const executionCwd = typeof input.executionCwd === 'string' ? input.executionCwd.trim() : '';
    const attachments = parseAttachments(input.attachments);

    return {
      question,
      rounds,
      judge,
      participants,
      noContext,
      executionCwd: executionCwd || undefined,
      attachments,
    };
  };

  const runDebateFromInput = async (
    input: DebateExecutionInput,
    timeoutMsRaw?: number,
  ): Promise<
    | { ok: true; sessionId: string; timeoutMs: number }
    | { ok: false; status: 400 | 429; error: string }
  > => {
    if (runningSessions.size >= MAX_CONCURRENT_SESSIONS) {
      return {
        ok: false,
        status: 429,
        error: `Maximum concurrent sessions reached (${MAX_CONCURRENT_SESSIONS})`,
      };
    }

    const parsed = parseDebateInput(input);
    if (!parsed) {
      return { ok: false, status: 400, error: 'Invalid debate input payload' };
    }

    const executionCwdResult = resolveExecutionCwd(parsed.executionCwd);
    if (!executionCwdResult.ok) {
      return { ok: false, status: 400, error: executionCwdResult.error };
    }
    const executionCwd = executionCwdResult.cwd;

    let providerMap: ReturnType<typeof createProviderMap>;
    try {
      providerMap = createProviderMap(parsed.participants, parsed.judge);
    } catch (error) {
      return {
        ok: false,
        status: 400,
        error: error instanceof Error ? error.message : 'Provider configuration error',
      };
    }

    const projectContext = parsed.noContext
      ? undefined
      : await collectProjectContext({ cwd: executionCwd });

    const questionWithAttachments = mergeQuestionWithAttachments(parsed.question, parsed.attachments);

    const timeoutMs = normalizeTimeoutMs(timeoutMsRaw);
    const controller = new AbortController();
    const sessionId = randomUUID();
    const timeoutTimer = setTimeout(() => {
      const running = runningSessions.get(sessionId);
      if (!running || running.controller.signal.aborted) return;
      running.controller.abort('timeout');
    }, timeoutMs);
    timeoutTimer.unref();

    runningSessions.set(sessionId, {
      controller,
      startedAt: Date.now(),
      timeoutMs,
      timeoutTimer,
    });

    const options: DebateOptions = {
      sessionId,
      question: questionWithAttachments,
      rounds: parsed.rounds,
      stream: true,
      synthesis: true,
      judge: parsed.judge,
      format: 'pretty',
      mode: 'debate',
      interactive: false,
      participants: parsed.participants,
      signal: controller.signal,
      executionCwd,
      projectContext,
      attachments: parsed.attachments,
    };

    const orchestrator = new DebateOrchestrator(providerMap, sessionStore);

    orchestrator
      .run(options, createSilentCallbacks())
      .catch(() => null)
      .finally(() => {
        cleanupRunSession(sessionId);
      });

    return { ok: true, sessionId, timeoutMs };
  };

  const app = new Hono();
  app.use('*', cors({ origin: config.corsOrigin, credentials: false }));

  const dashboardDir = resolveDashboardDir();
  const dashboardIndex = readFileSync(join(dashboardDir, 'index.html'), 'utf-8');
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
          return {
            id: snap.id,
            query: snap.query,
            articleCount: snap.articles.length,
            createdAt: snap.collectedAt,
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
    const filePath = join(SNAPSHOT_DIR, `snap-${id}.json`);
    try {
      const raw = await readFile(filePath, 'utf-8');
      const snap = JSON.parse(raw) as EvidenceSnapshot;
      return c.json(snap);
    } catch {
      return c.json({ error: 'Snapshot not found' }, 404);
    }
  });

  app.post('/api/snapshots/collect', async (c: Context) => {
    let body: { query?: string; newsMode?: string; sources?: string[] };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }
    const query = body.query?.trim();
    if (!query) {
      return c.json({ error: 'query is required' }, 400);
    }
    try {
      const snapshot = await collectEvidence(query, { snapshotDir: SNAPSHOT_DIR });
      return c.json({
        id: snapshot.id,
        query: snapshot.query,
        articleCount: snapshot.articles.length,
        createdAt: snapshot.collectedAt,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to collect evidence';
      return c.json({ error: message }, 500);
    }
  });

  app.delete('/api/snapshots/:id', async (c: Context) => {
    const id = c.req.param('id');
    const filePath = join(SNAPSHOT_DIR, `snap-${id}.json`);
    try {
      await unlink(filePath);
      return c.json({ ok: true });
    } catch {
      return c.json({ error: 'Snapshot not found' }, 404);
    }
  });

  app.get('/api/sessions', (c: Context) => c.json({ sessions: sessionStore.list() }));

  app.get('/api/providers', (c: Context) => {
    const options = listProviderOptions();
    return c.json({
      providers: options,
      judgeOptions: [...options.map((provider) => provider.name), 'both'],
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
    return c.json({ ok: true });
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
    return c.json({ sessionId: result.sessionId, timeoutMs: result.timeoutMs });
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

  return {
    url: getBaseUrl(config.port),
    port: config.port,
    close: () => {
      stopDashboardRuntime({ stopServer: true, reason: 'server_shutdown' });
    },
  };
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

function parseParticipants(input: unknown): [ProviderName, ProviderName] | undefined {
  if (!Array.isArray(input)) {
    return undefined;
  }
  if (input.length !== 2) {
    return undefined;
  }
  const first = normalizeProviderName(input[0]);
  const second = normalizeProviderName(input[1]);
  if (!first || !second || first === second) {
    return undefined;
  }
  if (!isValidProviderId(first) || !isValidProviderId(second)) {
    return undefined;
  }
  return [first as ProviderName, second as ProviderName];
}

function parseJudge(input: unknown): ProviderName | 'both' | undefined {
  if (typeof input !== 'string') return undefined;
  const judge = input.trim().toLowerCase();
  if (!judge) return undefined;
  if (judge === 'both') return 'both';
  if (isValidProviderId(judge)) return judge as ProviderName;
  return undefined;
}

function normalizeProviderName(input: unknown): string {
  return typeof input === 'string' ? input.trim().toLowerCase() : '';
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

if (process.argv[1] === __filename) {
  const { url } = startDashboardServer();
  console.log(`Dashboard server running at ${url}`);
}
