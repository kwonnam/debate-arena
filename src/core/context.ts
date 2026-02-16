import type { Message } from '../providers/types.js';
import type { DebateMessage, ProviderName } from '../types/debate.js';
import { DEBATE_PROMPTS, type PromptBuilders } from './prompt-builder.js';

export class DebateContext {
  private messages: DebateMessage[] = [];
  private question: string;
  private projectContext?: string;
  private prompts: PromptBuilders;

  constructor(
    question: string,
    projectContext?: string,
    prompts: PromptBuilders = DEBATE_PROMPTS
  ) {
    this.question = question;
    this.projectContext = projectContext;
    this.prompts = prompts;
  }

  addMessage(message: DebateMessage): void {
    this.messages.push(message);
  }

  getMessages(): DebateMessage[] {
    return [...this.messages];
  }

  getLastMessageFrom(provider: ProviderName): DebateMessage | undefined {
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
      { role: 'system', content: this.prompts.systemPrompt(provider, this.projectContext) },
    ];

    if (phase === 'opening') {
      result.push({
        role: 'user',
        content: this.prompts.openingPrompt(this.question),
      });

      // If this is the second provider in round 1, show the first provider's opening
      const opponent: ProviderName =
        provider === 'codex' ? 'claude' : 'codex';
      const opponentOpening = this.messages.find(
        (m) => m.provider === opponent && m.phase === 'opening'
      );
      if (opponentOpening) {
        // Include the opening prompt and ask for response + rebuttal
        result.pop(); // Remove the simple opening prompt
        result.push({
          role: 'user',
          content: this.prompts.openingPrompt(this.question),
        });
        result.push({
          role: 'user',
          content: this.prompts.rebuttalPrompt(opponent, opponentOpening.content),
        });
      }
    } else {
      // Rebuttal: Build conversation history
      result.push({
        role: 'user',
        content: this.prompts.openingPrompt(this.question),
      });

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
}
