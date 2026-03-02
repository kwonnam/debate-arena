import { BraveNewsProvider } from './providers/brave.js';
import { EvidenceBuilder } from './evidence-builder.js';
import { writeSnapshot, readSnapshot } from './snapshot-io.js';
import type { EvidenceSnapshot } from './snapshot.js';
import type { SearchOptions } from './providers/types.js';

export type { EvidenceSnapshot, SearchOptions };
export { readSnapshot, writeSnapshot };

export interface NewsOptions extends SearchOptions {
  quiet?: boolean;           // 기사 목록 미표시
  snapshotFile?: string;     // 기존 스냅샷 재사용
  snapshotDir?: string;      // 스냅샷 저장 폴더
}

export async function collectEvidence(
  query: string,
  options?: NewsOptions,
): Promise<EvidenceSnapshot> {
  // 기존 스냅샷 재사용
  if (options?.snapshotFile) {
    return readSnapshot(options.snapshotFile);
  }

  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey) {
    throw new Error(
      'BRAVE_API_KEY environment variable is required.\n' +
      'Get your free key at: https://api.search.brave.com\n' +
      'Then add to .env: BRAVE_API_KEY=your_key_here'
    );
  }

  const providers = [new BraveNewsProvider(apiKey)];
  const builder = new EvidenceBuilder(providers);
  const snapshot = await builder.build(query, options);

  // 자동 저장
  await writeSnapshot(snapshot, options?.snapshotDir);

  return snapshot;
}
