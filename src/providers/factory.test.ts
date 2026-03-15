import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve as resolvePath } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildClaudeCliCommand, buildCodexCliCommand, listProviderModels } from './factory.js';

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

describe('listProviderModels', () => {
  const originalFetch = globalThis.fetch;
  let tempDir = '';

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    delete process.env.FFM_CONFIG_V2;
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = '';
    }
  });

  it('merges config.v2 ollama models with remote model listing', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'debate-arena-config-v2-'));
    const configPath = join(tempDir, 'config.v2.json');

    writeFileSync(configPath, JSON.stringify({
      version: 2,
      providers: {
        'ollama-local': {
          type: 'ollama-compat',
          baseUrl: 'http://127.0.0.1:11434',
          model: 'llama3.2',
        },
        'ollama-cloud-qwen3': {
          type: 'ollama-compat',
          baseUrl: 'https://ollama.com',
          model: 'qwen3-coder-next',
          apiKeyEnvVar: 'OLLAMA_API_KEY',
        },
      },
    }), 'utf-8');

    process.env.FFM_CONFIG_V2 = configPath;
    globalThis.fetch = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify({
      data: [
        { id: 'llama3', name: 'llama3' },
        { id: 'qwen2.5', name: 'qwen2.5' },
      ],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const models = await listProviderModels('ollama-local');

    expect(models.map((model) => model.id)).toEqual([
      'llama3',
      'llama3.2',
      'qwen2.5',
      'qwen3-coder-next',
    ]);
  });
});
