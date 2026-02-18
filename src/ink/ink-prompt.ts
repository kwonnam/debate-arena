import { createElement } from 'react';
import { render } from 'ink';
import { stdin, stdout } from 'node:process';
import * as readline from 'node:readline';
import { PromptApp } from './components/PromptApp.js';
import type { PromptResult, PromptConfig } from './types.js';

function readNonTTY(): Promise<PromptResult> {
  stdout.write('ffm > ');
  return new Promise<PromptResult>((resolve) => {
    const rl = readline.createInterface({ input: stdin });

    rl.once('line', (line: string) => {
      rl.close();
      const trimmed = line.trim();
      if (trimmed === '') {
        resolve({ kind: 'empty' });
      } else if (trimmed.startsWith('/')) {
        const spaceIdx = trimmed.indexOf(' ', 1);
        if (spaceIdx === -1) {
          resolve({ kind: 'slash', command: trimmed.slice(1), args: '' });
        } else {
          resolve({
            kind: 'slash',
            command: trimmed.slice(1, spaceIdx),
            args: trimmed.slice(spaceIdx + 1).trim(),
          });
        }
      } else {
        resolve({ kind: 'line', line: trimmed });
      }
    });

    rl.once('close', () => {
      resolve({ kind: 'eof' });
    });
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
