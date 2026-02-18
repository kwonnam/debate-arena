import { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import type { CommandItem } from '../types.js';

interface CommandMenuProps {
  readonly commands: readonly CommandItem[];
  readonly onSelect: (command: string, args: string) => void;
  readonly onCancel: () => void;
}

const MAX_VISIBLE = 12;

export function CommandMenu({ commands, onSelect, onCancel }: CommandMenuProps) {
  const [filter, setFilter] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [argMode, setArgMode] = useState<CommandItem | null>(null);
  const [argValue, setArgValue] = useState('');

  const filtered = useMemo(() => {
    const lower = filter.toLowerCase();
    return commands
      .filter(
        (c) =>
          !lower ||
          c.command.startsWith(lower) ||
          c.description.toLowerCase().includes(lower),
      )
      .slice(0, MAX_VISIBLE);
  }, [filter, commands]);

  useInput((_input, key) => {
    if (argMode) {
      if (key.escape) {
        setArgMode(null);
        setArgValue('');
      }
      return;
    }

    if (key.escape || ((key.backspace || key.delete) && filter === '')) {
      onCancel();
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((i) => Math.max(0, i - 1));
      return;
    }

    if (key.downArrow) {
      setSelectedIndex((i) => Math.min(filtered.length - 1, i + 1));
    }
  });

  if (argMode) {
    const placeholder =
      argMode.args.kind !== 'none' ? argMode.args.placeholder : '';

    return (
      <Box flexDirection="column">
        <Box>
          <Text color="cyan">/{argMode.command} </Text>
          <TextInput
            value={argValue}
            onChange={setArgValue}
            placeholder={placeholder}
            onSubmit={(val) => {
              onSelect(argMode.command, val.trim());
            }}
          />
        </Box>
        <Text dimColor>
          {'  '}
          {argMode.args.kind === 'required'
            ? '(required)'
            : '(optional, press Enter to skip)'}
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box>
        <Text color="cyan">/</Text>
        <TextInput
          value={filter}
          onChange={(val) => {
            setFilter(val);
            setSelectedIndex(0);
          }}
          onSubmit={() => {
            if (filtered.length > 0) {
              const cmd = filtered[selectedIndex];
              if (cmd.args.kind !== 'none') {
                setArgMode(cmd);
              } else {
                onSelect(cmd.command, '');
              }
            }
          }}
        />
      </Box>
      {filtered.map((cmd, i) => {
        const isSelected = i === selectedIndex;
        const argLabel =
          cmd.args.kind === 'none' ? '' : ` ${cmd.args.placeholder}`;
        return (
          <Box key={cmd.command}>
            <Text color={isSelected ? 'cyan' : undefined} bold={isSelected}>
              {isSelected ? '> ' : '  '}
              /{cmd.command}
              {argLabel}
            </Text>
            <Text dimColor> - {cmd.description}</Text>
          </Box>
        );
      })}
      {filtered.length === 0 && (
        <Text dimColor>{'  No matching commands'}</Text>
      )}
    </Box>
  );
}
