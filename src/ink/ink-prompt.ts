import { createElement } from 'react';
import { render } from 'ink';
import { stdin, stdout } from 'node:process';
import * as readline from 'node:readline';
import { PromptApp } from './components/PromptApp.js';
import type { PromptResult, PromptConfig } from './types.js';

// Queue-based non-TTY reader: readline runs continuously and pushes results
// into a queue. readNonTTY() pulls from the queue or waits for the next item.
// This avoids the race condition where buffered lines are emitted between
// listener removal and re-registration.
const _nonTTYQueue: PromptResult[] = [];
let _nonTTYWaiter: ((result: PromptResult) => void) | null = null;
let _nonTTYDone = false;
let _nonTTYInit = false;

function parseLine(line: string): PromptResult {
  const trimmed = line.trim();
  if (trimmed === '') return { kind: 'empty' };
  if (trimmed.startsWith('/')) {
    const spaceIdx = trimmed.indexOf(' ', 1);
    if (spaceIdx === -1) return { kind: 'slash', command: trimmed.slice(1), args: '' };
    return {
      kind: 'slash',
      command: trimmed.slice(1, spaceIdx),
      args: trimmed.slice(spaceIdx + 1).trim(),
    };
  }
  return { kind: 'line', line: trimmed };
}

function initNonTTY(): void {
  if (_nonTTYInit) return;
  _nonTTYInit = true;

  const rl = readline.createInterface({ input: stdin, crlfDelay: Infinity });

  rl.on('line', (line: string) => {
    const result = parseLine(line);
    if (_nonTTYWaiter) {
      const waiter = _nonTTYWaiter;
      _nonTTYWaiter = null;
      waiter(result);
    } else {
      _nonTTYQueue.push(result);
    }
  });

  rl.once('close', () => {
    _nonTTYDone = true;
    if (_nonTTYWaiter) {
      const waiter = _nonTTYWaiter;
      _nonTTYWaiter = null;
      waiter({ kind: 'eof' });
    }
  });
}

function readNonTTY(): Promise<PromptResult> {
  stdout.write('ffm > ');
  initNonTTY();

  return new Promise<PromptResult>((resolve) => {
    if (_nonTTYQueue.length > 0) {
      resolve(_nonTTYQueue.shift()!);
      return;
    }
    if (_nonTTYDone) {
      resolve({ kind: 'eof' });
      return;
    }
    _nonTTYWaiter = resolve;
  });
}

export async function inkPrompt(config: PromptConfig): Promise<PromptResult> {
  if (!stdin.isTTY) {
    return readNonTTY();
  }

  return new Promise<PromptResult>((resolve) => {
    let result: PromptResult | null = null;

    // Defense-in-depth: render 전에 raw mode 설정하여 동기 렌더 중
    // 키 입력이 character 단위로 버퍼링되도록 함.
    // 실제 readable 리스너는 PromptApp의 useLayoutEffect에서 설정됨.
    try {
      stdin.setRawMode(true);
    } catch {
      // Non-fatal: Ink의 useEffect가 처리
    }
    stdin.ref();

    const app = render(
      createElement(PromptApp, {
        config,
        onResult: (r: PromptResult) => {
          result = r;
        },
      }),
      {
        patchConsole: false,
        exitOnCtrlC: false,
      },
    );

    app
      .waitUntilExit()
      .then(() => {
        resolve(result ?? { kind: 'interrupt' });
      })
      .catch(() => {
        resolve({ kind: 'interrupt' });
      });
  });
}
