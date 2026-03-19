import { describe, expect, it, vi } from 'vitest';
import { SynthesisSimplifier } from './synthesis-simplifier.js';

describe('SynthesisSimplifier', () => {
  it('plain-language rewrite prompt를 provider에 전달한다', async () => {
    const provider = {
      generate: vi.fn().mockResolvedValue('쉽게 풀어쓴 답변'),
      stream: vi.fn(),
    };

    const simplifier = new SynthesisSimplifier(provider as any);
    const result = await simplifier.generate('어떤 DB를 써야 할까?', '원래 결론', 'debate');

    expect(result).toBe('쉽게 풀어쓴 답변');
    expect(provider.generate).toHaveBeenCalledOnce();
    expect(provider.generate.mock.calls[0][0][0].content).toContain('Original conclusion:');
    expect(provider.generate.mock.calls[0][0][0].content).toContain('원래 결론');
  });
});
