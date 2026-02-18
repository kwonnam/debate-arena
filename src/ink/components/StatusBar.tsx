import { Box, Text } from 'ink';
import type { SessionDisplayInfo } from '../types.js';

interface StatusBarProps {
  readonly session: SessionDisplayInfo;
}

export function StatusBar({ session }: StatusBarProps) {
  return (
    <Box>
      <Text dimColor>
        {`rounds:${session.rounds} judge:${session.judge} format:${session.format} stream:${session.stream ? 'on' : 'off'}`}
      </Text>
    </Box>
  );
}
