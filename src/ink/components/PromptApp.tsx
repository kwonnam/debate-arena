import { useState, useCallback, useLayoutEffect } from 'react';
import { useApp, useStdin } from 'ink';
import { InputPrompt } from './InputPrompt.js';
import { CommandMenu } from './CommandMenu.js';
import { StatusBar } from './StatusBar.js';
import type { PromptResult, PromptConfig } from '../types.js';

type Mode = 'input' | 'command-menu';

interface PromptAppProps {
  readonly config: PromptConfig;
  readonly onResult: (result: PromptResult) => void;
}

export function PromptApp({ config, onResult }: PromptAppProps) {
  const { exit } = useApp();
  const { setRawMode, isRawModeSupported } = useStdin();
  const [mode, setMode] = useState<Mode>('input');

  // 커밋 단계에서 동기적으로 stdin 리스너 설정 (useEffect gap 해소)
  // useLayoutEffect는 render 직후 동기 실행되므로 이벤트 루프에 제어가
  // 돌아가기 전에 readable 리스너가 설정됨.
  // PromptApp은 전체 프롬프트 수명 동안 유지되므로 자식 컴포넌트
  // 모드 전환 시에도 rawModeEnabledCount가 항상 ≥1로 유지됨.
  useLayoutEffect(() => {
    if (!isRawModeSupported) return;
    setRawMode(true);
    return () => { setRawMode(false); };
  }, [setRawMode, isRawModeSupported]);

  const handleResult = useCallback(
    (result: PromptResult) => {
      onResult(result);
      exit();
    },
    [onResult, exit],
  );

  return (
    <>
      {config.session && <StatusBar session={config.session} />}
      {mode === 'input' ? (
        <InputPrompt
          debateMode={config.debateMode}
          onSubmit={(value) => {
            const trimmed = value.trim();
            if (!trimmed) {
              handleResult({ kind: 'empty' });
            } else {
              handleResult({ kind: 'line', line: trimmed });
            }
          }}
          onSlash={() => setMode('command-menu')}
          onInterrupt={() => handleResult({ kind: 'interrupt' })}
          onEof={() => handleResult({ kind: 'eof' })}
          onModeToggle={() => handleResult({ kind: 'mode-toggle' })}
        />
      ) : (
        <CommandMenu
          commands={config.commands}
          onSelect={(command, args) => {
            handleResult({ kind: 'slash', command, args });
          }}
          onCancel={() => setMode('input')}
        />
      )}
    </>
  );
}
