import { describe, expect, it } from 'vitest';
import { resolve as resolvePath } from 'node:path';
import { buildClaudeCliCommand, buildCodexCliCommand } from './factory.js';

describe('buildCodexCliCommand', () => {
  it('injects web search before exec', () => {
    expect(buildCodexCliCommand('codex exec --skip-git-repo-check -', '', true))
      .toBe('codex --search exec --skip-git-repo-check -');
  });

  it('keeps search as a single flag and preserves model placement', () => {
    expect(buildCodexCliCommand('codex --search exec --skip-git-repo-check -', 'gpt-5', true))
      .toBe('codex --search exec --skip-git-repo-check --model gpt-5 -');
  });

  it('supports npx-based codex commands', () => {
    expect(buildCodexCliCommand('npx @openai/codex exec -', 'gpt-5', true))
      .toBe('npx @openai/codex --search exec --model gpt-5 -');
  });

  it('only adds model when requested', () => {
    expect(buildCodexCliCommand('codex exec --skip-git-repo-check -', '', false))
      .toBe('codex exec --skip-git-repo-check -');
  });
});

describe('buildClaudeCliCommand', () => {
  it('adds model, mcp config, strict mode, and allowed tools', () => {
    expect(buildClaudeCliCommand('claude -p', {
      model: 'claude-sonnet-4-5',
      mcpConfigs: ['/tmp/brave.json'],
      strictMcpConfig: true,
      allowedTools: ['mcp__brave-search'],
    })).toBe(
      'claude -p --model claude-sonnet-4-5 --mcp-config "/tmp/brave.json" --strict-mcp-config --allowedTools "mcp__brave-search"',
    );
  });

  it('deduplicates repeated tool and config entries', () => {
    expect(buildClaudeCliCommand('claude -p --allowedTools "Read"', {
      mcpConfigs: ['/tmp/brave.json', '/tmp/brave.json'],
      allowedTools: ['mcp__brave-search', 'mcp__brave-search'],
    })).toBe(
      'claude -p --allowedTools "Read" --mcp-config "/tmp/brave.json"',
    );
  });

  it('resolves relative mcp config paths to absolute paths', () => {
    expect(buildClaudeCliCommand('claude -p', {
      mcpConfigs: ['./.claude/debate-arena.mcp.json'],
    })).toBe(
      `claude -p --mcp-config ${JSON.stringify(resolvePath('./.claude/debate-arena.mcp.json'))}`,
    );
  });
});
