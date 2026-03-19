import { describe, expect, it } from 'vitest';
import { buildTemplateParticipants, resolveDefaultStockTemplateId, resolveStockTemplate } from './template-resolver.js';

describe('telegram template resolver', () => {
  it('uses the default stock template when preferred id is missing', () => {
    expect(resolveDefaultStockTemplateId('missing-template')).toBe('news-stock-bull-bear-risk');
  });

  it('maps stock template roles onto predefined ollama providers', () => {
    const template = resolveStockTemplate('news-stock-bull-bear-risk');
    const participants = buildTemplateParticipants(template, [
      'ollama-cloud-qwen3-coder-next',
      'ollama-cloud-glm-5',
      'ollama-cloud-kimi-k2-5',
    ]);

    expect(participants.map((participant) => participant.provider)).toEqual([
      'ollama-cloud-qwen3-coder-next',
      'ollama-cloud-kimi-k2-5',
      'ollama-cloud-glm-5',
    ]);
    expect(participants.map((participant) => participant.label)).toEqual([
      'Bull Thesis',
      'Bear Thesis',
      '리스크 매니저',
    ]);
  });
});
