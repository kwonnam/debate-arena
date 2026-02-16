import type { AIProvider } from '../providers/types.js';
import type {
  DebateCallbacks,
  DebateMessage,
  DebateOptions,
  DebateResult,
  ProviderName,
} from '../types/debate.js';
import { DebateContext } from './context.js';
import { getPromptBuilders, getSynthesisPromptBuilder } from './prompt-builder.js';
import { Synthesizer } from './synthesizer.js';

export class DebateOrchestrator {
  private codex: AIProvider;
  private claude: AIProvider;

  constructor(codex: AIProvider, claude: AIProvider) {
    this.codex = codex;
    this.claude = claude;
  }

  private getProvider(name: ProviderName): AIProvider {
    return name === 'codex' ? this.codex : this.claude;
  }

  async run(options: DebateOptions, callbacks: DebateCallbacks): Promise<DebateResult> {
    const mode = options.mode ?? 'debate';
    const prompts = getPromptBuilders(mode);
    const synthBuilder = getSynthesisPromptBuilder(mode);

    const context = new DebateContext(options.question, options.projectContext, prompts);
    const { rounds, stream } = options;

    for (let round = 1; round <= rounds; round++) {
      callbacks.onRoundStart(round, rounds);
      const phase = round === 1 ? 'opening' : 'rebuttal';

      // Codex goes first
      await this.executeTurn(context, 'codex', round, phase, stream, callbacks);

      // Claude responds
      // On round 1, Claude's opening also includes rebuttal to Codex
      const claudePhase = round === 1 ? 'opening' : 'rebuttal';
      await this.executeTurn(context, 'claude', round, claudePhase, stream, callbacks);
    }

    // Synthesis
    let synthesis: string | null = null;
    if (options.synthesis) {
      callbacks.onSynthesisStart();

      const judgeProvider = this.getJudgeProvider(options.judge);
      const synthesizer = new Synthesizer(judgeProvider, synthBuilder);

      if (stream) {
        const chunks: string[] = [];
        for await (const token of synthesizer.stream(
          options.question,
          context.getMessages()
        )) {
          callbacks.onSynthesisToken(token);
          chunks.push(token);
        }
        synthesis = chunks.join('');
      } else {
        synthesis = await synthesizer.generate(
          options.question,
          context.getMessages()
        );
      }
      callbacks.onSynthesisEnd(synthesis);
    }

    return {
      question: options.question,
      messages: context.getMessages(),
      synthesis,
      rounds,
    };
  }

  private async executeTurn(
    context: DebateContext,
    provider: ProviderName,
    round: number,
    phase: 'opening' | 'rebuttal',
    stream: boolean,
    callbacks: DebateCallbacks
  ): Promise<void> {
    callbacks.onTurnStart(provider, phase);

    const messages = context.buildMessagesFor(provider, round, phase);
    const aiProvider = this.getProvider(provider);

    const content = await this.callWithRetry(
      async () => {
        if (stream) {
          const chunks: string[] = [];
          for await (const token of aiProvider.stream(messages)) {
            callbacks.onToken(provider, token);
            chunks.push(token);
          }
          return chunks.join('');
        }
        return await aiProvider.generate(messages);
      },
      provider,
      callbacks
    );

    const message: DebateMessage = { provider, round, phase, content };
    context.addMessage(message);
    callbacks.onTurnEnd(provider, content);
  }

  private async callWithRetry(
    fn: () => Promise<string>,
    provider: ProviderName,
    callbacks: DebateCallbacks,
    maxAttempts = 3
  ): Promise<string> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (!isRateLimitError(error) || attempt === maxAttempts) {
          throw error;
        }
        callbacks.onRetry(provider, attempt, maxAttempts, error as Error);
        await delay(attempt * 5000);
      }
    }
    throw new Error('Unreachable');
  }

  private getJudgeProvider(judge: 'codex' | 'claude' | 'both'): AIProvider {
    // For 'both', default to Claude as the synthesizer
    if (judge === 'codex') return this.codex;
    return this.claude;
  }
}

function isRateLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes('rate limit') || message.includes('429') || message.includes('too many requests');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
