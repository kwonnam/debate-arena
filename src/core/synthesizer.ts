import type { AIProvider, Message } from '../providers/types.js';
import type { DebateMessage, ParticipantName } from '../types/debate.js';
import { buildSynthesisPrompt, type SynthesisPromptBuilder } from './prompt-builder.js';

export class Synthesizer {
  private provider: AIProvider;
  private buildPrompt: SynthesisPromptBuilder;

  constructor(
    provider: AIProvider,
    buildPrompt: SynthesisPromptBuilder = buildSynthesisPrompt
  ) {
    this.provider = provider;
    this.buildPrompt = buildPrompt;
  }

  async generate(question: string, messages: DebateMessage[]): Promise<string> {
    const prompt = this.buildPrompt(
      question,
      messages.map((m) => ({
        provider: m.provider,
        round: m.round,
        content: m.content,
      }))
    );

    const apiMessages: Message[] = [
      { role: 'user', content: prompt },
    ];

    return this.provider.generate(apiMessages);
  }

  async *stream(
    question: string,
    messages: DebateMessage[]
  ): AsyncIterable<string> {
    const prompt = this.buildPrompt(
      question,
      messages.map((m) => ({
        provider: m.provider,
        round: m.round,
        content: m.content,
      }))
    );

    const apiMessages: Message[] = [
      { role: 'user', content: prompt },
    ];

    yield* this.provider.stream(apiMessages);
  }
}
