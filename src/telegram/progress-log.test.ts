import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildTelegramProgressScopeFromMessage,
  getTelegramEventsLogPath,
  getTelegramRequestLogPath,
  logTelegramProgress,
  readTelegramProgressTail,
} from './progress-log.js';

describe('telegram progress log', () => {
  const previousCwd = process.cwd();
  let tempDir = '';

  afterEach(() => {
    process.chdir(previousCwd);
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = '';
    }
  });

  it('writes both global and request-scoped jsonl logs', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'debate-arena-telegram-progress-'));
    process.chdir(tempDir);

    const scope = buildTelegramProgressScopeFromMessage({
      message_id: 12,
      chat: { id: 345, type: 'private' },
      from: { id: 678 },
      text: 'hello',
    }, 999);

    logTelegramProgress('INFO', 'test_event', scope, {
      token: 'secret-value',
      questionPreview: 'hello',
    });

    const globalLines = readTelegramProgressTail(getTelegramEventsLogPath(), 10);
    const requestLines = readTelegramProgressTail(getTelegramRequestLogPath(scope.requestId), 10);

    expect(globalLines).toHaveLength(1);
    expect(requestLines).toHaveLength(1);
    expect(globalLines[0]).toContain('"event":"test_event"');
    expect(globalLines[0]).toContain('"requestId":"chat-345-upd-999-msg-12"');
    expect(globalLines[0]).toContain('"token":"[REDACTED]"');
  });
});
