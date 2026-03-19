import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadTelegramBotSettings } from './settings.js';

describe('loadTelegramBotSettings', () => {
  const envKeys = [
    'FFM_CONFIG_V2',
    'DEBATE_ARENA_CONFIG_V2',
    'TELEGRAM_OLLAMA_PROVIDER_IDS',
    'TELEGRAM_JUDGE_PROVIDER',
  ] as const;
  const previousEnv = new Map<string, string | undefined>();
  let tempDir = '';

  afterEach(() => {
    for (const key of envKeys) {
      const previous = previousEnv.get(key);
      if (previous === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous;
      }
    }
    previousEnv.clear();

    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = '';
    }
  });

  it('prefers the Telegram default Ollama cloud model set when env override is absent', () => {
    for (const key of envKeys) {
      previousEnv.set(key, process.env[key]);
      delete process.env[key];
    }

    tempDir = mkdtempSync(join(tmpdir(), 'debate-arena-telegram-settings-'));
    const configPath = join(tempDir, 'config.v2.json');

    writeFileSync(configPath, JSON.stringify({
      version: 2,
      providers: {
        'ollama-cloud-qwen3-coder-next': {
          type: 'ollama-compat',
          baseUrl: 'https://ollama.com',
          model: 'qwen3-coder-next',
        },
        'ollama-cloud-glm-5': {
          type: 'ollama-compat',
          baseUrl: 'https://ollama.com',
          model: 'glm-5:cloud',
        },
        'ollama-cloud-minimax-m2-5': {
          type: 'ollama-compat',
          baseUrl: 'https://ollama.com',
          model: 'minimax-m2.5:cloud',
        },
        'ollama-cloud-kimi-k2-5': {
          type: 'ollama-compat',
          baseUrl: 'https://ollama.com',
          model: 'kimi-k2.5:cloud',
        },
        'ollama-cloud-qwen3-5-397b': {
          type: 'ollama-compat',
          baseUrl: 'https://ollama.com',
          model: 'qwen3.5:397b-cloud',
        },
        'ollama-cloud-nemotron-3-super': {
          type: 'ollama-compat',
          baseUrl: 'https://ollama.com',
          model: 'nemotron-3-super:cloud',
        },
      },
      defaultProvider: 'ollama-cloud-qwen3-coder-next',
      debate: {
        defaultJudge: 'ollama-cloud-qwen3-coder-next',
      },
    }), 'utf-8');

    process.env.FFM_CONFIG_V2 = configPath;

    const settings = loadTelegramBotSettings();

    expect(settings.ollamaProviderIds.slice(0, 5)).toEqual([
      'ollama-cloud-qwen3-5-397b',
      'ollama-cloud-glm-5',
      'ollama-cloud-nemotron-3-super',
      'ollama-cloud-kimi-k2-5',
      'ollama-cloud-minimax-m2-5',
    ]);
    expect(settings.judgeProviderId).toBe('ollama-cloud-qwen3-5-397b');
  });
});
