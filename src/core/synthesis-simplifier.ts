import type { AIProvider, Message } from '../providers/types.js';
import type { DebateMode } from '../types/debate.js';
import { buildPlainLanguageRewritePrompt } from './prompt-builder.js';

export class SynthesisSimplifier {
  constructor(private readonly provider: AIProvider) {}

  async generate(
    question: string,
    synthesis: string,
    mode: DebateMode = 'debate',
  ): Promise<string> {
    const messages: Message[] = [{
      role: 'user',
      content: buildPlainLanguageRewritePrompt(question, synthesis, mode),
    }];

    return this.provider.generate(messages);
  }
}
