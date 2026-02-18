import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import type { DebateMode } from '../../types/debate.js';

interface InputPromptProps {
  readonly debateMode: DebateMode;
  readonly onSubmit: (value: string) => void;
  readonly onSlash: () => void;
  readonly onInterrupt: () => void;
  readonly onEof: () => void;
  readonly onModeToggle: () => void;
}

export function InputPrompt({ debateMode, onSubmit, onSlash, onInterrupt, onEof, onModeToggle }: InputPromptProps) {
  const [value, setValue] = useState('');

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      onInterrupt();
      return;
    }
    if (key.ctrl && input === 'd') {
      onEof();
      return;
    }
    if (key.shift && key.tab) {
      onModeToggle();
      return;
    }
  });

  const modeColor = debateMode === 'plan' ? 'blue' : 'green';
  const modeLabel = debateMode === 'plan' ? 'plan' : 'debate';

  return (
    <Box>
      <Text bold color="yellow">ffm</Text>
      <Text color={modeColor}>{` [${modeLabel}]`}</Text>
      <Text dimColor>{' > '}</Text>
      <TextInput
        value={value}
        onChange={(newValue) => {
          if (value === '' && newValue === '/') {
            onSlash();
            return;
          }
          setValue(newValue);
        }}
        onSubmit={onSubmit}
      />
    </Box>
  );
}
