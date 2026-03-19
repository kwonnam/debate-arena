import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { extractTelegramMessage, type TelegramMessage, type TelegramUpdate } from './types.js';

export type TelegramProgressLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export interface TelegramProgressScope {
  requestId: string;
  updateId?: number;
  chatId?: number;
  messageId?: number;
  userId?: number;
}

interface TelegramProgressEntry {
  timestamp: string;
  level: TelegramProgressLevel;
  event: string;
  requestId: string;
  updateId?: number;
  chatId?: number;
  messageId?: number;
  userId?: number;
  meta?: Record<string, unknown>;
}

const MAX_META_STRING_LENGTH = 1_200;

export function buildTelegramProgressScope(update: TelegramUpdate): TelegramProgressScope {
  const message = extractTelegramMessage(update);
  return buildTelegramProgressScopeFromMessage(
    message,
    typeof update.update_id === 'number' ? update.update_id : undefined,
  );
}

export function buildTelegramProgressScopeFromMessage(
  message?: TelegramMessage,
  updateId?: number,
): TelegramProgressScope {
  const chatId = typeof message?.chat?.id === 'number' ? message.chat.id : undefined;
  const messageId = typeof message?.message_id === 'number' ? message.message_id : undefined;
  const userId = typeof message?.from?.id === 'number' ? message.from.id : undefined;

  return {
    requestId: createRequestId({ chatId, updateId, messageId }),
    updateId,
    chatId,
    messageId,
    userId,
  };
}

export function logTelegramProgress(
  level: TelegramProgressLevel,
  event: string,
  scope: TelegramProgressScope,
  meta?: Record<string, unknown>,
): void {
  try {
    ensureLogDirs();
    const entry: TelegramProgressEntry = {
      timestamp: new Date().toISOString(),
      level,
      event,
      requestId: scope.requestId,
      updateId: scope.updateId,
      chatId: scope.chatId,
      messageId: scope.messageId,
      userId: scope.userId,
      meta: meta ? redactMeta(meta) : undefined,
    };
    const line = `${JSON.stringify(entry)}\n`;
    appendFileSync(getEventsLogPath(), line, 'utf-8');
    appendFileSync(getRequestLogPath(scope.requestId), line, 'utf-8');
  } catch {
    // Progress logging must never break bot execution.
  }
}

export function getTelegramEventsLogPath(): string {
  ensureLogDirs();
  return getEventsLogPath();
}

export function getTelegramRequestLogPath(requestId: string): string {
  ensureLogDirs();
  return getRequestLogPath(requestId);
}

export function readTelegramProgressTail(filePath: string, lines = 200): string[] {
  if (!existsSync(filePath)) {
    return [];
  }

  const raw = readFileSync(filePath, 'utf-8');
  return raw.split(/\r?\n/).filter(Boolean).slice(-clampLines(lines));
}

function ensureLogDirs(): void {
  mkdirSync(getLogRoot(), { recursive: true });
  mkdirSync(getRequestLogRoot(), { recursive: true });
}

function getRequestLogPath(requestId: string): string {
  return join(getRequestLogRoot(), `${sanitizePathSegment(requestId)}.jsonl`);
}

function getLogRoot(): string {
  return resolve(process.cwd(), 'output/telegram/progress');
}

function getRequestLogRoot(): string {
  return join(getLogRoot(), 'requests');
}

function getEventsLogPath(): string {
  return join(getLogRoot(), 'events.jsonl');
}

function createRequestId(input: {
  chatId?: number;
  updateId?: number;
  messageId?: number;
}): string {
  const chatId = input.chatId ?? 'unknown-chat';
  const updateId = input.updateId ?? 'unknown-update';
  const messageId = input.messageId ?? 'unknown-message';
  return sanitizePathSegment(`chat-${chatId}-upd-${updateId}-msg-${messageId}`);
}

function sanitizePathSegment(value: string): string {
  return value.replace(/[^a-z0-9._-]+/gi, '-').slice(0, 120) || 'unknown';
}

function clampLines(value: number): number {
  if (!Number.isFinite(value)) return 200;
  return Math.max(1, Math.min(1_000, Math.trunc(value)));
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
