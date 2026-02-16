import { spawn } from 'node:child_process';
import { unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import type { Message } from './types.js';

function renderMessages(messages: Message[]): string {
  const systemMsgs = messages.filter((m) => m.role === 'system');
  const conversationMsgs = messages.filter((m) => m.role !== 'system');

  const parts: string[] = [];

  if (systemMsgs.length > 0) {
    parts.push(systemMsgs.map((m) => m.content).join('\n\n'));
    parts.push('---');
  }

  for (const msg of conversationMsgs) {
    if (msg.role === 'assistant') {
      parts.push(`[Your previous response]\n${msg.content}`);
    } else {
      parts.push(msg.content);
    }
  }

  return parts.join('\n\n');
}

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
    tempFilePath = join(tmpdir(), `fight-for-me-${randomUUID()}.txt`);
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
  timeoutMs: number
): AsyncIterable<string> {
  const prompt = renderMessages(messages);
  const { command, useStdin, cleanup } = await buildCommand(template, prompt);

  const child = spawn(command, {
    shell: true,
    stdio: 'pipe',
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
  let stderr = '';

  const notify = () => {
    if (resolver) {
      resolver();
      resolver = null;
    }
  };

  const timer = setTimeout(() => {
    timedOut = true;
    child.kill();
  }, timeoutMs);

  child.stdout.on('data', (chunk: Buffer | string) => {
    queue.push(chunk.toString());
    notify();
  });

  child.stderr.on('data', (chunk: Buffer | string) => {
    stderr += chunk.toString();
  });

  child.on('close', (code) => {
    clearTimeout(timer);
    exitCode = code;
    done = true;
    notify();
  });

  child.on('error', (error) => {
    clearTimeout(timer);
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
    await cleanup();
  }

  if (timedOut) {
    throw new Error(`Command timed out after ${timeoutMs}ms: ${template}`);
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
