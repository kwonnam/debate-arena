import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_OBSIDIAN_EXPORT_CONFIG,
  loadObsidianConfig,
  resolveObsidianExportTarget,
  saveObsidianConfig,
} from './config.js';

describe('obsidian config', () => {
  it('loads defaults when config file is missing', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'debate-arena-obsidian-'));
    const filePath = join(rootDir, 'obsidian.json');

    expect(loadObsidianConfig(filePath)).toEqual({
      path: filePath,
      config: DEFAULT_OBSIDIAN_EXPORT_CONFIG,
    });
  });

  it('saves and reloads normalized settings', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'debate-arena-obsidian-'));
    const filePath = join(rootDir, 'obsidian.json');

    const saved = saveObsidianConfig({
      vaultPath: join(rootDir, 'vault'),
      folders: {
        general: 'Inbox',
        project: 'Projects/Plans',
        news: '../News//Daily',
      },
      openAfterSave: true,
    }, filePath);

    expect(saved.config.folders.news).toBe('News/Daily');
    expect(loadObsidianConfig(filePath).config).toEqual(saved.config);
  });

  it('resolves workflow target inside the configured vault', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'debate-arena-obsidian-'));
    const vaultPath = join(rootDir, 'vault');
    mkdirSync(vaultPath, { recursive: true });

    const target = resolveObsidianExportTarget({
      vaultPath,
      folders: {
        general: 'Inbox',
        project: 'Projects',
        news: 'News',
      },
      openAfterSave: false,
    }, 'project', 'My Session.md');

    expect(target.relativePath).toBe('Projects/My Session.md');
    expect(target.absolutePath.startsWith(vaultPath)).toBe(true);
    expect(target.obsidianUrl).toContain('obsidian://open');
  });
});
