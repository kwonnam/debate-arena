import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, extname, basename } from 'node:path';

const MAX_TOTAL_CHARS = 30_000;
const MAX_FILE_CHARS = 8_000;
const MAX_TREE_DEPTH = 3;
const MAX_AUTO_FILES = 5;
const MAX_USER_FILES = 10;

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '__pycache__',
  'coverage', 'target', '.cache', '.turbo', '.nuxt', '.output',
  '.svelte-kit', 'vendor', '.venv', 'venv', 'env',
]);

const BINARY_EXTENSIONS = new Set([
  '.lock', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.webp',
  '.zip', '.tar', '.gz', '.exe', '.dll', '.so', '.dylib', '.woff',
  '.woff2', '.ttf', '.eot', '.mp3', '.mp4', '.avi', '.mov', '.pdf',
  '.bin', '.dat', '.db', '.sqlite', '.pyc', '.class', '.o', '.obj',
]);

const IMPORTANT_FILES = [
  'README.md', 'readme.md', 'README.rst',
  'package.json', 'tsconfig.json',
  'pyproject.toml', 'setup.py', 'setup.cfg',
  'Cargo.toml', 'go.mod',
  'Makefile', 'Dockerfile', 'docker-compose.yml',
  '.env.example',
];

export interface CollectContextOptions {
  cwd?: string;
  files?: readonly string[];
}

interface CollectedFile {
  path: string;
  content: string;
}

export async function collectProjectContext(
  opts: CollectContextOptions = {}
): Promise<string> {
  const cwd = opts.cwd ?? process.cwd();

  try {
    const tree = await buildDirectoryTree(cwd, MAX_TREE_DEPTH);
    const autoFiles = await detectImportantFiles(cwd);
    const userFiles = opts.files
      ? await readUserFiles(cwd, opts.files.slice(0, MAX_USER_FILES))
      : [];

    return formatProjectContext(tree, autoFiles, userFiles);
  } catch {
    return '';
  }
}

async function buildDirectoryTree(
  root: string,
  maxDepth: number
): Promise<string> {
  const lines: string[] = [];

  async function walk(dir: string, depth: number, prefix: string): Promise<void> {
    if (depth > maxDepth) return;

    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    const sorted = entries
      .filter((e) => !e.name.startsWith('.') || e.name === '.env.example')
      .filter((e) => !IGNORE_DIRS.has(e.name))
      .filter((e) => !BINARY_EXTENSIONS.has(extname(e.name)))
      .sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

    for (const entry of sorted) {
      if (entry.isDirectory()) {
        lines.push(`${prefix}${entry.name}/`);
        await walk(join(dir, entry.name), depth + 1, `${prefix}  `);
      } else {
        lines.push(`${prefix}${entry.name}`);
      }
    }
  }

  await walk(root, 0, '');
  return lines.join('\n');
}

async function detectImportantFiles(cwd: string): Promise<CollectedFile[]> {
  const found: CollectedFile[] = [];

  for (const name of IMPORTANT_FILES) {
    if (found.length >= MAX_AUTO_FILES) break;

    const filePath = join(cwd, name);
    const content = await readFileWithLimit(filePath, MAX_FILE_CHARS);
    if (content !== null) {
      found.push({ path: name, content });
    }
  }

  return found;
}

async function readUserFiles(
  cwd: string,
  files: readonly string[]
): Promise<CollectedFile[]> {
  const result: CollectedFile[] = [];

  for (const file of files) {
    const fullPath = join(cwd, file);
    const ext = extname(file);

    if (BINARY_EXTENSIONS.has(ext)) {
      console.warn(`Warning: Skipping binary file: ${file}`);
      continue;
    }

    const content = await readFileWithLimit(fullPath, MAX_FILE_CHARS);
    if (content !== null) {
      result.push({ path: file, content });
    } else {
      console.warn(`Warning: Could not read file: ${file}`);
    }
  }

  return result;
}

async function readFileWithLimit(
  filePath: string,
  maxChars: number
): Promise<string | null> {
  try {
    const info = await stat(filePath);
    if (!info.isFile()) return null;

    const raw = await readFile(filePath, 'utf-8');
    if (raw.length <= maxChars) return raw;
    return `${raw.slice(0, maxChars)}\n\n... [truncated at ${maxChars} characters]`;
  } catch {
    return null;
  }
}

function formatProjectContext(
  tree: string,
  autoFiles: CollectedFile[],
  userFiles: CollectedFile[]
): string {
  const sections: string[] = ['## Project Context'];

  if (tree) {
    sections.push('### Directory Structure', '```', tree, '```');
  }

  const allFiles = deduplicateFiles([...userFiles, ...autoFiles]);
  let totalChars = sections.join('\n').length;

  for (const file of allFiles) {
    const section = `### File: ${file.path}\n\`\`\`\n${file.content}\n\`\`\``;
    if (totalChars + section.length > MAX_TOTAL_CHARS) break;
    sections.push(section);
    totalChars += section.length;
  }

  const result = sections.join('\n\n');
  return result || '';
}

function deduplicateFiles(files: CollectedFile[]): CollectedFile[] {
  const seen = new Set<string>();
  return files.filter((f) => {
    const normalized = f.path.replace(/\\/g, '/');
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}
