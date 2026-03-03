import { describe, it, expect } from 'vitest';
import { createSnapshotId } from './snapshot.js';

describe('createSnapshotId', () => {
  it('동일한 입력에 동일한 해시를 반환한다', () => {
    const id1 = createSnapshotId('트럼프 관세', ['url1', 'url2']);
    const id2 = createSnapshotId('트럼프 관세', ['url1', 'url2']);
    expect(id1).toBe(id2);
  });

  it('다른 쿼리에 다른 해시를 반환한다', () => {
    const id1 = createSnapshotId('트럼프 관세', ['url1']);
    const id2 = createSnapshotId('반도체 수출', ['url1']);
    expect(id1).not.toBe(id2);
  });

  it('해시는 8자 이상이다', () => {
    const id = createSnapshotId('test', ['url1']);
    expect(id.length).toBeGreaterThanOrEqual(8);
  });
});
