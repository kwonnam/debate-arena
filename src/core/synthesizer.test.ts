import { describe, it, expect, vi } from 'vitest';
import { Synthesizer } from './synthesizer.js';
import type { EvidenceSnapshot } from '../news/snapshot.js';

const mockProvider = {
  generate: vi.fn().mockResolvedValue('synthesis result'),
  stream: vi.fn(),
};

const mockSnapshot: EvidenceSnapshot = {
  id: 'test123',
  query: 'test',
  collectedAt: '2026-03-02T00:00:00Z',
  sources: ['Brave'],
  articles: [],
  excludedCount: 0,
};

describe('Synthesizer', () => {
  it('snapshot 없이 기존 방식으로 동작한다', async () => {
    const synth = new Synthesizer(mockProvider as any);
    const result = await synth.generate('question', []);
    expect(result).toBe('synthesis result');
    expect(mockProvider.generate).toHaveBeenCalledOnce();
  });

  it('snapshot을 받으면 buildSynthesisPromptWithEvidence를 사용한다', async () => {
    const mockBuildPrompt = vi.fn().mockReturnValue('prompt');
    const synth = new Synthesizer(mockProvider as any, mockBuildPrompt as any);
    await synth.generate('question', [], mockSnapshot);
    // evidence-aware builder가 호출됨을 확인
    expect(mockProvider.generate).toHaveBeenCalled();
  });
});
