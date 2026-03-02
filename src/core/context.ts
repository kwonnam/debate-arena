import type { Message } from '../providers/types.js';
import type { DebateAttachment, DebateMessage, ParticipantName, ProviderName, NewsMode } from '../types/debate.js';
import { DEBATE_PROMPTS, type PromptBuilders, buildRoundEvidenceSection, type RoundEvidenceMode } from './prompt-builder.js';
import type { EvidenceSnapshot } from '../news/snapshot.js';

export class DebateContext {
  private messages: DebateMessage[] = [];
  private question: string;
  private projectContext?: string;
  private prompts: PromptBuilders;
  private attachments: DebateAttachment[];
  private participants?: ProviderName[];
  private snapshot?: EvidenceSnapshot;
  private newsMode?: NewsMode;

  constructor(
    question: string,
    projectContext?: string,
    prompts: PromptBuilders = DEBATE_PROMPTS,
    attachments: DebateAttachment[] = [],
    participants?: ProviderName[],
    snapshot?: EvidenceSnapshot,
    newsMode?: NewsMode,
  ) {
    this.question = question;
    this.projectContext = projectContext;
    this.prompts = prompts;
    this.attachments = attachments;
    this.participants = participants;
    this.snapshot = snapshot;
    this.newsMode = newsMode;
  }

  addMessage(message: DebateMessage): void {
    this.messages.push(message);
  }

  getMessages(): DebateMessage[] {
    return [...this.messages];
  }

  getLastMessageFrom(provider: ParticipantName): DebateMessage | undefined {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].provider === provider) {
        return this.messages[i];
      }
    }
    return undefined;
  }

  /**
   * Build the message array to send to a provider for its next turn.
   * - system: debater system prompt
   * - Alternating user/assistant messages reflecting the debate history
   */
  buildMessagesFor(
    provider: ProviderName,
    round: number,
    phase: 'opening' | 'rebuttal'
  ): Message[] {
    const result: Message[] = [
      { role: 'system', content: this.prompts.systemPrompt(provider, this.projectContext, this.participants) },
    ];

    if (phase === 'opening') {
      result.push(this.buildOpeningMessage(provider));

      // If this is the second provider in round 1, show the first provider's opening
      // Find opponent's opening dynamically without hardcoding provider names
      const opponentOpening = this.messages.find(
        (m) => m.provider !== provider && m.provider !== 'user' && m.phase === 'opening'
      );
      if (opponentOpening) {
        // Include the opening prompt and ask for response + rebuttal
        result.pop(); // Remove the simple opening prompt
        result.push(this.buildOpeningMessage(provider));
        result.push({
          role: 'user',
          content: this.prompts.rebuttalPrompt(opponentOpening.provider, opponentOpening.content),
        });
      }
    } else {
      // Rebuttal: Build conversation history
      result.push(this.buildOpeningMessage(provider));

      // Replay the debate as alternating messages
      for (const msg of this.messages) {
        if (msg.provider === provider) {
          result.push({ role: 'assistant', content: msg.content });
        } else {
          result.push({
            role: 'user',
            content: this.prompts.rebuttalPrompt(msg.provider, msg.content),
          });
        }
      }
    }

    return result;
  }

  private getEvidenceModeForProvider(provider: ProviderName): RoundEvidenceMode {
    if (!this.newsMode || this.newsMode === 'unified') return 'unified';
    const isFirst = !this.participants || this.participants[0] === provider;
    return isFirst ? 'split-first' : 'split-second';
  }

  private buildOpeningMessage(provider?: ProviderName): Message {
    let content = this.prompts.openingPrompt(this.question);

    if (this.snapshot && this.snapshot.articles.length > 0 && provider) {
      const mode = this.getEvidenceModeForProvider(provider);
      const evidenceSection = buildRoundEvidenceSection(mode, this.snapshot.articles);
      if (evidenceSection) {
        content += evidenceSection;
      }
    }

    return {
      role: 'user',
      content,
      attachments: this.attachments.length > 0 ? [...this.attachments] : undefined,
    };
  }
}
