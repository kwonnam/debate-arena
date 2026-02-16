import type { AIProvider, Message } from '../providers/types.js';
import type { ProviderName } from '../types/debate.js';
import { buildApplyPrompt, type ApplyPromptBuilder } from './prompt-builder.js';

export class Applier {
  private provider: AIProvider;
  private providerName: ProviderName;
  private buildPrompt: ApplyPromptBuilder;

  constructor(
    provider: AIProvider,
    providerName: ProviderName,
    buildPrompt: ApplyPromptBuilder = buildApplyPrompt
  ) {
    this.provider = provider;
    this.providerName = providerName;
    this.buildPrompt = buildPrompt;
  }

  async *stream(
    question: string,
    approach: string,
    approachLabel: string,
    isSecondPass?: boolean
  ): AsyncIterable<string> {
    const prompt = this.buildPrompt(
      question,
      approach,
      approachLabel,
      this.providerName,
      isSecondPass
    );
    const messages: Message[] = [{ role: 'user', content: prompt }];
    yield* this.provider.stream(messages);
  }
}
