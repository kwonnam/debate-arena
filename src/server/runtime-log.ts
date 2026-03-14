import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

const LOG_ROOT = resolve(process.cwd(), '.omc/logs');
const SESSION_LOG_ROOT = join(LOG_ROOT, 'sessions');
const DASHBOARD_LOG_FILE = join(LOG_ROOT, 'dashboard-server.log');
const MAX_META_STRING_LENGTH = 1_200;

export function getDashboardLogPath(): string {
  ensureLogDirs();
  return DASHBOARD_LOG_FILE;
}

export function getSessionLogPath(sessionId: string): string {
  ensureLogDirs();
  return join(SESSION_LOG_ROOT, `${sanitizeSessionId(sessionId)}.log`);
}

export function logDashboard(
  level: LogLevel,
  message: string,
  meta?: Record<string, unknown>,
): void {
  writeLog(DASHBOARD_LOG_FILE, level, message, meta);
}

export function logSession(
  sessionId: string,
  level: LogLevel,
  message: string,
  meta?: Record<string, unknown>,
): void {
  writeLog(getSessionLogPath(sessionId), level, message, meta);
}

export function readLogTail(filePath: string, lines = 200): string[] {
  if (!existsSync(filePath)) {
    return [];
  }

  const raw = readFileSync(filePath, 'utf-8');
  const normalized = raw.split(/\r?\n/).filter(Boolean);
  return normalized.slice(-clampLines(lines));
}

function writeLog(
  filePath: string,
  level: LogLevel,
  message: string,
  meta?: Record<string, unknown>,
): void {
  try {
    ensureLogDirs();
    const timestamp = new Date().toISOString();
    const suffix = meta ? ` ${JSON.stringify(redactMeta(meta))}` : '';
    appendFileSync(filePath, `[${timestamp}] ${level} ${message}${suffix}\n`, 'utf-8');
  } catch {
    // Logging must never break runtime behavior.
  }
}

function ensureLogDirs(): void {
  mkdirSync(LOG_ROOT, { recursive: true });
  mkdirSync(SESSION_LOG_ROOT, { recursive: true });
}

function clampLines(value: number): number {
  if (!Number.isFinite(value)) return 200;
  return Math.max(1, Math.min(1_000, Math.trunc(value)));
}

function sanitizeSessionId(sessionId: string): string {
  return sessionId.replace(/[^a-z0-9._-]+/gi, '-').slice(0, 80) || 'unknown-session';
}

function redactMeta(meta: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(meta).map(([key, value]) => [key, redactValue(key, value)]),
  );
}

function redactValue(key: string, value: unknown): unknown {
  if (value == null) return value;

  if (/(api[-_]?key|token|authorization|secret|password)/i.test(key)) {
    return '[REDACTED]';
  }

  if (typeof value === 'string') {
    return value.length > MAX_META_STRING_LENGTH
      ? `${value.slice(0, MAX_META_STRING_LENGTH)}…`
      : value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((entry) => redactValue(key, entry));
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
    };
  }

  if (typeof value === 'object') {
    return redactMeta(value as Record<string, unknown>);
  }

  return String(value);
}
