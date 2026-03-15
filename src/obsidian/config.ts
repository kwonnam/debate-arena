import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import type { WorkflowKind } from '../types/debate.js';

export interface ObsidianExportFolders {
  general: string;
  project: string;
  news: string;
}

export interface ObsidianExportConfig {
  vaultPath: string;
  folders: ObsidianExportFolders;
  openAfterSave: boolean;
}

interface PersistedObsidianConfig {
  vaultPath?: unknown;
  folders?: Partial<Record<keyof ObsidianExportFolders, unknown>>;
  openAfterSave?: unknown;
}

const DEFAULT_CONFIG_DIR = join(homedir(), '.debate-arena');
const DEFAULT_CONFIG_FILE = join(DEFAULT_CONFIG_DIR, 'obsidian.json');

export const DEFAULT_OBSIDIAN_EXPORT_CONFIG: ObsidianExportConfig = {
  vaultPath: '',
  folders: {
    general: 'Debate Arena/Inbox',
    project: 'Debate Arena/Projects',
    news: 'Debate Arena/News',
  },
  openAfterSave: false,
};

export function loadObsidianConfig(configFile = DEFAULT_CONFIG_FILE): {
  path: string;
  config: ObsidianExportConfig;
} {
  ensureConfigDir(configFile);
  if (!existsSync(configFile)) {
    return {
      path: configFile,
      config: cloneObsidianConfig(DEFAULT_OBSIDIAN_EXPORT_CONFIG),
    };
  }

  try {
    const raw = readFileSync(configFile, 'utf-8');
    const parsed = JSON.parse(raw) as PersistedObsidianConfig;
    return {
      path: configFile,
      config: normalizeObsidianConfig(parsed),
    };
  } catch {
    return {
      path: configFile,
      config: cloneObsidianConfig(DEFAULT_OBSIDIAN_EXPORT_CONFIG),
    };
  }
}

export function saveObsidianConfig(
  nextConfig: Partial<ObsidianExportConfig>,
  configFile = DEFAULT_CONFIG_FILE,
): {
  path: string;
  config: ObsidianExportConfig;
} {
  ensureConfigDir(configFile);
  const current = loadObsidianConfig(configFile).config;
  const merged = normalizeObsidianConfig({
    ...current,
    ...nextConfig,
    folders: {
      ...current.folders,
      ...(nextConfig.folders ?? {}),
    },
  });

  writeFileSync(configFile, JSON.stringify(merged, null, 2), 'utf-8');
  return { path: configFile, config: merged };
}

export function resolveObsidianExportTarget(
  config: ObsidianExportConfig,
  workflowKind: WorkflowKind | undefined,
  filename: string,
): {
  vaultPath: string;
  relativePath: string;
  absolutePath: string;
  obsidianUrl: string;
} {
  const vaultPath = normalizeVaultPath(config.vaultPath);
  if (!vaultPath) {
    throw new Error('Obsidian Vault 경로가 아직 설정되지 않았습니다.');
  }

  if (!existsSync(vaultPath) || !statSync(vaultPath).isDirectory()) {
    throw new Error(`설정된 Obsidian Vault 경로를 찾을 수 없습니다: ${vaultPath}`);
  }

  const safeFilename = sanitizeObsidianFilename(filename);
  if (!safeFilename) {
    throw new Error('저장할 노트 파일명이 올바르지 않습니다.');
  }

  const folder = getWorkflowFolder(config.folders, workflowKind);
  const relativePath = [folder, safeFilename].filter(Boolean).join('/');
  const absolutePath = resolve(vaultPath, relativePath);
  const normalizedVaultRoot = `${resolve(vaultPath)}/`;
  const normalizedAbsolutePath = absolutePath.replace(/\\/g, '/');

  if (!(normalizedAbsolutePath === resolve(vaultPath).replace(/\\/g, '/')
    || normalizedAbsolutePath.startsWith(normalizedVaultRoot.replace(/\\/g, '/')))) {
    throw new Error('Obsidian 노트 저장 경로가 Vault 바깥으로 벗어났습니다.');
  }

  return {
    vaultPath,
    relativePath,
    absolutePath,
    obsidianUrl: buildObsidianOpenUrl(vaultPath, relativePath),
  };
}

export function buildObsidianOpenUrl(vaultPath: string, relativePath: string): string {
  const vaultName = basename(resolve(vaultPath));
  return `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(relativePath.replace(/\\/g, '/'))}`;
}

function ensureConfigDir(configFile: string): void {
  mkdirSync(resolve(configFile, '..'), { recursive: true });
}

function cloneObsidianConfig(config: ObsidianExportConfig): ObsidianExportConfig {
  return {
    vaultPath: config.vaultPath,
    folders: { ...config.folders },
    openAfterSave: config.openAfterSave,
  };
}

function normalizeObsidianConfig(input: PersistedObsidianConfig | Partial<ObsidianExportConfig>): ObsidianExportConfig {
  return {
    vaultPath: normalizeVaultPath(input.vaultPath),
    folders: {
      general: normalizeFolderPath(input.folders?.general ?? DEFAULT_OBSIDIAN_EXPORT_CONFIG.folders.general),
      project: normalizeFolderPath(input.folders?.project ?? DEFAULT_OBSIDIAN_EXPORT_CONFIG.folders.project),
      news: normalizeFolderPath(input.folders?.news ?? DEFAULT_OBSIDIAN_EXPORT_CONFIG.folders.news),
    },
    openAfterSave: Boolean(input.openAfterSave),
  };
}

function normalizeVaultPath(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  if (raw === '~') {
    return homedir();
  }

  if (raw.startsWith('~/')) {
    return resolve(join(homedir(), raw.slice(2)));
  }

  return resolve(raw);
}

function normalizeFolderPath(value: unknown): string {
  return String(value ?? '')
    .replace(/\\/g, '/')
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => Boolean(segment) && segment !== '.' && segment !== '..')
    .join('/');
}

function getWorkflowFolder(
  folders: ObsidianExportFolders,
  workflowKind: WorkflowKind | undefined,
): string {
  if (workflowKind === 'project') {
    return folders.project;
  }
  if (workflowKind === 'news') {
    return folders.news;
  }
  return folders.general;
}

function sanitizeObsidianFilename(filename: string): string {
  const safe = String(filename ?? '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  if (!safe) return '';
  return safe.toLowerCase().endsWith('.md') ? safe : `${safe}.md`;
}
