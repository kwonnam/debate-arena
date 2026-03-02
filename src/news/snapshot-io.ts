import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { EvidenceSnapshot } from './snapshot.js';

const DEFAULT_SNAPSHOT_DIR = './ffm-snapshots';

export async function writeSnapshot(
  snapshot: EvidenceSnapshot,
  dir = DEFAULT_SNAPSHOT_DIR,
): Promise<string> {
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, `snap-${snapshot.id}.json`);
  await writeFile(filePath, JSON.stringify(snapshot, null, 2), 'utf-8');
  return filePath;
}

export async function readSnapshot(filePath: string): Promise<EvidenceSnapshot> {
  const raw = await readFile(filePath, 'utf-8');
  return JSON.parse(raw) as EvidenceSnapshot;
}
