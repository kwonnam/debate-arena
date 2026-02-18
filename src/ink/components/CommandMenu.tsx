import { useState, useMemo, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import type { CommandItem } from '../types.js';

interface CommandMenuProps {
  readonly commands: readonly CommandItem[];
  readonly onSelect: (command: string, args: string) => void;
  readonly onCancel: () => void;
}

const MAX_VISIBLE = 12;

function applyCompletion(current: string, completion: string): string {
  const parts = current.trimStart().split(/\s+/);

  if (parts.length <= 1) {
    return completion + ' ';
  }

  return parts.slice(0, -1).join(' ') + ' ' + completion;
}

export function CommandMenu({ commands, onSelect, onCancel }: CommandMenuProps) {
  const [filter, setFilter] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [argMode, setArgMode] = useState<CommandItem | null>(null);
  const [argValue, setArgValue] = useState('');
  const [completionIndex, setCompletionIndex] = useState(0);

  const completions = useMemo(() => {
    if (!argMode?.getCompletions) return [];
    return [...argMode.getCompletions(argValue)];
  }, [argMode, argValue]);

  useEffect(() => {
    setCompletionIndex(0);
  }, [argValue]);

  const filtered = useMemo(() => {
    const lower = filter.toLowerCase();
    return commands
      .filter(
        (c) =>
          !lower ||
          c.command.startsWith(lower) ||
          c.aliases?.some((a) => a.startsWith(lower)) ||
          c.description.toLowerCase().includes(lower),
      )
      .slice(0, MAX_VISIBLE);
  }, [filter, commands]);

  useInput((_input, key) => {
    if (argMode) {
      if (key.escape) {
        setArgMode(null);
        setArgValue('');
        return;
      }

      if (completions.length > 0) {
        if (key.tab) {
          const selected = completions[completionIndex];
          if (selected !== undefined) {
            setArgValue(applyCompletion(argValue, selected));
          }
          return;
        }

        if (key.upArrow) {
          setCompletionIndex((i) => Math.max(0, i - 1));
          return;
        }

        if (key.downArrow) {
          setCompletionIndex((i) => Math.min(completions.length - 1, i + 1));
          return;
        }
      }

      return;
    }

    if (key.escape || ((key.backspace || key.delete) && filter === '')) {
      onCancel();
      return;
    }

    if (key.tab) {
      if (filtered.length > 0) {
        const cmd = filtered[selectedIndex];
        if (cmd.args.kind !== 'none') {
          setArgMode(cmd);
        } else {
          onSelect(cmd.command, '');
        }
      }
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
              if (completions.length > 0) {
                const selected = completions[completionIndex];
                if (selected !== undefined) {
                  const applied = applyCompletion(val, selected);
                  const tokenCount = applied.trim().split(/\s+/).length;
                  if (tokenCount >= 2) {
                    onSelect(argMode.command, applied.trim());
                  } else {
                    setArgValue(applied);
                  }
                  return;
                }
              }
              onSelect(argMode.command, val.trim());
            }}
          />
        </Box>
        {completions.length > 0 ? (
          completions.map((item, i) => {
            const isHighlighted = i === completionIndex;
            return (
              <Box key={item}>
                <Text
                  color={isHighlighted ? 'cyan' : undefined}
                  bold={isHighlighted}
                >
                  {isHighlighted ? '> ' : '  '}
                  {item}
                </Text>
              </Box>
            );
          })
        ) : (
          <Text dimColor>
            {'  '}
            {argMode.args.kind === 'required'
              ? '(required)'
              : '(optional, press Enter to skip)'}
          </Text>
        )}
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
