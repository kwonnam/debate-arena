import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeSnapshot, readSnapshot } from './snapshot-io.js';
import type { EvidenceSnapshot } from './snapshot.js';
import { mkdirSync, rmSync } from 'node:fs';

const TEST_DIR = '/tmp/ffm-test-snapshots';

const mockSnapshot: EvidenceSnapshot = {
  id: 'abc123',
  query: 'test query',
  collectedAt: '2026-03-02T00:00:00Z',
  sources: ['Brave'],
  articles: [],
  excludedCount: 0,
};

describe('snapshot I/O', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('저장하고 다시 읽으면 동일한 snapshot이 된다', async () => {
    const filePath = await writeSnapshot(mockSnapshot, TEST_DIR);
    const loaded = await readSnapshot(filePath);
    expect(loaded).toEqual(mockSnapshot);
  });

  it('파일명은 snap-{id}.json 형식이다', async () => {
    const filePath = await writeSnapshot(mockSnapshot, TEST_DIR);
    expect(filePath).toContain('snap-abc123.json');
  });

  it('존재하지 않는 파일을 읽으면 오류를 던진다', async () => {
    await expect(readSnapshot('/tmp/nonexistent.json')).rejects.toThrow();
  });
});
