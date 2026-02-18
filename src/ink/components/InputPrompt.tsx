import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';

interface InputPromptProps {
  readonly onSubmit: (value: string) => void;
  readonly onSlash: () => void;
  readonly onInterrupt: () => void;
  readonly onEof: () => void;
}

export function InputPrompt({ onSubmit, onSlash, onInterrupt, onEof }: InputPromptProps) {
  const [value, setValue] = useState('');

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      onInterrupt();
      return;
    }
    if (key.ctrl && input === 'd') {
      onEof();
    }
  });

  return (
    <Box>
      <Text bold color="yellow">ffm</Text>
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
