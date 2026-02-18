import { stdin } from 'node:process';

export function resetTTYInputState(): void {
  if (!stdin.isTTY) return;

  try {
    if (typeof stdin.setRawMode === 'function' && stdin.isRaw) {
      stdin.setRawMode(false);
    }
  } catch {
    // Ignore: not all environments allow raw mode toggling at all times.
  }

  // resume()은 uv_read_start()를 호출하여 핸들을 ACTIVE + ref'd로 만듦.
  // 이벤트 루프를 유지하여 프로세스 종료를 방지.
  // 데이터 유실 우려: resetTTYInputState()와 다음 inkPrompt() 사이에는
  // 마이크로태스크 경계만 있어 I/O 폴링이 없으므로 stdin 데이터 도착 불가.
  stdin.resume();
}

export async function withSafeStdin<T>(task: () => Promise<T>): Promise<T> {
  resetTTYInputState();
  try {
    return await task();
  } finally {
    resetTTYInputState();
  }
}
