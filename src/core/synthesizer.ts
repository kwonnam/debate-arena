import type { AIProvider, Message } from '../providers/types.js';
import type { DebateMessage, ParticipantName } from '../types/debate.js';
import type { EvidenceSnapshot } from '../news/snapshot.js';
import { buildSynthesisPrompt, buildSynthesisPromptWithEvidence, type SynthesisPromptBuilder } from './prompt-builder.js';

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

  async generate(
    question: string,
    messages: DebateMessage[],
    snapshot?: EvidenceSnapshot,
  ): Promise<string> {
    const log = messages.map((m) => ({ provider: m.provider, round: m.round, content: m.content }));
    const prompt = snapshot
      ? buildSynthesisPromptWithEvidence(question, log, snapshot)
      : this.buildPrompt(question, log);

    const apiMessages: Message[] = [{ role: 'user', content: prompt }];
    return this.provider.generate(apiMessages);
  }

  async *stream(
    question: string,
    messages: DebateMessage[],
    signal?: AbortSignal,
    executionCwd?: string,
    snapshot?: EvidenceSnapshot,
  ): AsyncIterable<string> {
    const log = messages.map((m) => ({ provider: m.provider, round: m.round, content: m.content }));
    const prompt = snapshot
      ? buildSynthesisPromptWithEvidence(question, log, snapshot)
      : this.buildPrompt(question, log);

    const apiMessages: Message[] = [{ role: 'user', content: prompt }];
    yield* this.provider.stream(apiMessages, signal, executionCwd);
  }
}
