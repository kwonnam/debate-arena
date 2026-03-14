import { spawn } from 'node:child_process';
import { unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import type { Message } from './types.js';
import { ProviderTimeoutError } from './errors.js';
import { renderMessages } from './prompt-renderer.js';

const ABORT_GRACE_PERIOD_MS = 3000;
const STDERR_PREVIEW_LIMIT = 2000;

async function buildCommand(template: string, prompt: string): Promise<{
  command: string;
  useStdin: boolean;
  cleanup: () => Promise<void>;
}> {
  let command = template.trim();
  const usesPromptPlaceholder = command.includes('{prompt}');
  const usesPromptFilePlaceholder = command.includes('{prompt_file}');
  let tempFilePath: string | null = null;

  if (usesPromptFilePlaceholder) {
    tempFilePath = join(tmpdir(), `debate-arena-${randomUUID()}.txt`);
    writeFileSync(tempFilePath, prompt, 'utf8');
    command = command.replaceAll('{prompt_file}', `"${tempFilePath}"`);
  }

  if (usesPromptPlaceholder) {
    const jsonEscapedPrompt = JSON.stringify(prompt);
    command = command.replaceAll('{prompt}', jsonEscapedPrompt);
  }

  return {
    command,
    useStdin: !usesPromptPlaceholder && !usesPromptFilePlaceholder,
    cleanup: async () => {
      if (tempFilePath) {
        try {
          await unlink(tempFilePath);
        } catch {
          // Ignore cleanup failures.
        }
      }
    },
  };
}

export async function* runCommandStream(
  template: string,
  messages: Message[],
  timeoutMs: number,
  signal?: AbortSignal,
  executionCwd?: string,
): AsyncIterable<string> {
  const prompt = renderMessages(messages);
  const { command, useStdin, cleanup } = await buildCommand(template, prompt);

  const child = spawn(command, {
    shell: true,
    stdio: 'pipe',
    cwd: executionCwd,
    windowsHide: true,
    env: {
      ...process.env,
      CLAUDECODE: '',
    },
  });

  const queue: string[] = [];
  let resolver: (() => void) | null = null;
  let done = false;
  let exitCode: number | null = null;
  let timedOut = false;
  let aborted = false;
  let stderr = '';
  let forceKillTimer: NodeJS.Timeout | null = null;

  const notify = () => {
    if (resolver) {
      resolver();
      resolver = null;
    }
  };

  const killGracefully = () => {
    if (child.killed) return;
    child.kill('SIGTERM');
    if (!forceKillTimer) {
      forceKillTimer = setTimeout(() => {
        if (!done && !child.killed) {
          child.kill('SIGKILL');
        }
      }, ABORT_GRACE_PERIOD_MS);
      forceKillTimer.unref();
    }
  };

  const timer = setTimeout(() => {
    timedOut = true;
    killGracefully();
  }, timeoutMs);

  const abortListener = () => {
    aborted = true;
    killGracefully();
    notify();
  };

  if (signal) {
    if (signal.aborted) {
      abortListener();
    } else {
      signal.addEventListener('abort', abortListener, { once: true });
    }
  }

  child.stdout.on('data', (chunk: Buffer | string) => {
    queue.push(chunk.toString());
    notify();
  });

  child.stderr.on('data', (chunk: Buffer | string) => {
    stderr += chunk.toString();
  });

  child.on('close', (code) => {
    clearTimeout(timer);
    if (forceKillTimer) {
      clearTimeout(forceKillTimer);
      forceKillTimer = null;
    }
    exitCode = code;
    done = true;
    notify();
  });

  child.on('error', (error) => {
    clearTimeout(timer);
    if (forceKillTimer) {
      clearTimeout(forceKillTimer);
      forceKillTimer = null;
    }
    stderr += `\n${error.message}`;
    exitCode = 1;
    done = true;
    notify();
  });

  if (useStdin) {
    child.stdin.write(prompt);
  }
  child.stdin.end();

  try {
    while (!done || queue.length > 0) {
      if (queue.length === 0) {
        await new Promise<void>((resolve) => {
          resolver = resolve;
        });
        continue;
      }

      while (queue.length > 0) {
        yield queue.shift() as string;
      }
    }
  } finally {
    clearTimeout(timer);
    if (forceKillTimer) {
      clearTimeout(forceKillTimer);
      forceKillTimer = null;
    }
    if (signal) {
      signal.removeEventListener('abort', abortListener);
    }
    await cleanup();
  }

  if (timedOut) {
    const stderrPreview = formatStderrPreview(stderr);
    throw new ProviderTimeoutError(
      `Command timed out after ${timeoutMs}ms: ${template}${stderrPreview ? `\nStderr:\n${stderrPreview}` : ''}`,
      timeoutMs,
    );
  }

  if (aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  if (exitCode !== 0) {
    const details = stderr.trim() || `exit code ${exitCode}`;
    const lowered = details.toLowerCase();
    if (lowered.includes('stdin is not a terminal')) {
      throw new Error(
        `Command requires interactive TTY: ${template}. Configure a non-interactive command (e.g. add -p/--print).`
      );
    }
    throw new Error(`Command failed (${template}): ${details}`);
  }
}

function formatStderrPreview(stderr: string): string {
  const normalized = stderr.trim();
  if (!normalized) return '';
  if (normalized.length <= STDERR_PREVIEW_LIMIT) {
    return normalized;
  }
  return `${normalized.slice(0, STDERR_PREVIEW_LIMIT)}…`;
}
