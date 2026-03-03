import { randomUUID } from 'node:crypto';
import type { AIProvider } from '../providers/types.js';
import type {
  DebateCallbacks,
  DebateMessage,
  DebateOptions,
  DebateResult,
  JudgeOption,
  ProviderName,
} from '../types/debate.js';
import type { DebateEvent } from '../types/debate-events.js';
import type { SessionStore } from './session-store.js';
import { DebateContext } from './context.js';
import { getPromptBuilders, getSynthesisPromptBuilder } from './prompt-builder.js';
import { Synthesizer } from './synthesizer.js';
import { isProviderTimeoutError } from '../providers/errors.js';

type CancellationReason = 'user_cancelled' | 'timeout' | 'server_shutdown';

export class DebateOrchestrator {
  private providers: Map<ProviderName, AIProvider>;
  private sessionStore?: SessionStore;
  private eventEmitter?: (event: DebateEvent) => void;

  constructor(
    providers: Map<ProviderName, AIProvider> | { codex: AIProvider; claude: AIProvider; gemini?: AIProvider },
    sessionStore?: SessionStore,
    eventEmitter?: (event: DebateEvent) => void,
  ) {
    if (providers instanceof Map) {
      this.providers = providers;
    } else {
      this.providers = new Map(Object.entries(providers) as [ProviderName, AIProvider][]);
    }
    this.sessionStore = sessionStore;
    this.eventEmitter = eventEmitter;
  }

  private emitEvent(event: DebateEvent): void {
    if (this.sessionStore) {
      try {
        this.sessionStore.append(event.sessionId, event);
      } catch {
        // session may not exist yet; ignore
      }
    }
    this.eventEmitter?.(event);
  }

  private getProvider(name: ProviderName): AIProvider {
    const provider = this.providers.get(name);
    if (!provider) throw new Error(`Provider '${name}' is not configured`);
    return provider;
  }

  async run(options: DebateOptions, callbacks: DebateCallbacks): Promise<DebateResult> {
    const sessionId = options.sessionId ?? randomUUID();
    const mode = options.mode ?? 'debate';
    const prompts = getPromptBuilders(mode);
    const synthBuilder = getSynthesisPromptBuilder(mode);

    const { rounds, stream } = options;
    const participants = options.participants ?? (['codex', 'claude'] as [ProviderName, ProviderName]);
    const context = new DebateContext(
      options.question,
      options.projectContext,
      prompts,
      options.attachments ?? [],
      participants,
      options.snapshot,
      options.newsMode,
    );

    if (this.sessionStore) {
      this.sessionStore.create(sessionId, {
        sessionId,
        question: options.question,
        participants,
        rounds: options.rounds,
        createdAt: Date.now(),
      });
      this.sessionStore.updateStatus(sessionId, 'RUNNING');
    }

    try {
      for (let round = 1; round <= rounds; round++) {
        this.ensureNotAborted(sessionId, options.signal, round);
        this.sessionStore?.updateStatus(sessionId, 'RUNNING');
        callbacks.onRoundStart(round, rounds);

        this.emitEvent({
          type: 'round_started',
          sessionId,
          timestamp: Date.now(),
          payload: { round, total: rounds, participants },
        });

        const phase = round === 1 ? 'opening' : 'rebuttal';
        const [first, second] = participants;

        // First provider goes first
        await this.executeTurn(
          context,
          first,
          round,
          phase,
          stream,
          callbacks,
          sessionId,
          options.signal,
          options.executionCwd,
        );

        // Second provider responds
        // On round 1, second's opening also includes rebuttal to first
        const secondPhase = round === 1 ? 'opening' : 'rebuttal';
        await this.executeTurn(
          context,
          second,
          round,
          secondPhase,
          stream,
          callbacks,
          sessionId,
          options.signal,
          options.executionCwd,
        );

        // User turn (interactive mode)
        if (options.interactive && callbacks.onUserInput) {
          await this.executeUserTurn(context, round, callbacks);
        }

        // Collect round messages
        const roundMessages = context.getMessages()
          .filter((m) => m.round === round && m.provider !== 'user')
          .map((m) => ({ provider: m.provider, phase: m.phase, content: m.content }));

        this.emitEvent({
          type: 'round_finished',
          sessionId,
          timestamp: Date.now(),
          payload: { round, messages: roundMessages },
        });
        this.sessionStore?.updateStatus(sessionId, 'ROUND_COMPLETE');
      }

      // Synthesis
      let synthesis: string | null = null;
      if (options.synthesis) {
        callbacks.onSynthesisStart();
        this.sessionStore?.updateStatus(sessionId, 'SYNTHESIZING');

        const judgeProvider = this.getJudgeProvider(options.judge);
        const judgeProviderName = options.judge === 'both' ? 'claude' : options.judge;

        this.emitEvent({
          type: 'synthesis_ready',
          sessionId,
          timestamp: Date.now(),
          payload: { status: 'started', judge: judgeProviderName },
        });

        const synthesizer = new Synthesizer(judgeProvider, synthBuilder);

        try {
          if (stream) {
            const chunks: string[] = [];
            for await (const token of synthesizer.stream(
              options.question,
              context.getMessages(),
              options.signal,
              options.executionCwd,
              options.snapshot,
            )) {
              this.ensureNotAborted(sessionId, options.signal, rounds, judgeProviderName);
              callbacks.onSynthesisToken(token);
              this.emitEvent({
                type: 'agent_chunk',
                sessionId,
                timestamp: Date.now(),
                payload: { provider: judgeProviderName, token, round: rounds, phase: 'synthesis' },
              });
              chunks.push(token);
            }
            synthesis = chunks.join('');
          } else {
            this.ensureNotAborted(sessionId, options.signal, rounds, judgeProviderName);
            synthesis = await synthesizer.generate(
              options.question,
              context.getMessages(),
              options.snapshot,
            );
          }
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            this.emitCancellation(
              sessionId,
              this.getCancellationReason(options.signal),
              rounds,
              judgeProviderName
            );
            throw error;
          }
          if (isProviderTimeoutError(error)) {
            this.emitCancellation(sessionId, 'timeout', rounds, judgeProviderName);
            throw error;
          }
          throw error;
        }

        callbacks.onSynthesisEnd(synthesis);

        this.emitEvent({
          type: 'synthesis_ready',
          sessionId,
          timestamp: Date.now(),
          payload: { status: 'completed', judge: judgeProviderName, content: synthesis },
        });
      }

      if (this.sessionStore) {
        this.sessionStore.updateStatus(sessionId, 'COMPLETED');
      }

      return {
        question: options.question,
        messages: context.getMessages(),
        synthesis,
        rounds,
      };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        this.emitCancellation(sessionId, this.getCancellationReason(options.signal));
      } else if (isProviderTimeoutError(error)) {
        this.emitCancellation(sessionId, 'timeout');
      } else {
        const status = this.sessionStore?.get(sessionId)?.status;
        if (status !== 'FAILED' && status !== 'CANCELLED') {
          this.sessionStore?.updateStatus(sessionId, 'FAILED');
        }
      }
      throw error;
    }
  }

  private async executeUserTurn(
    context: DebateContext,
    round: number,
    callbacks: DebateCallbacks
  ): Promise<void> {
    callbacks.onUserTurnStart?.();

    const content = await callbacks.onUserInput!();

    if (content.trim() === '') {
      callbacks.onUserTurnEnd?.('');
      return;
    }

    const message: DebateMessage = {
      provider: 'user',
      round,
      phase: 'rebuttal',
      content,
    };
    context.addMessage(message);
    callbacks.onUserTurnEnd?.(content);
  }

  private async executeTurn(
    context: DebateContext,
    provider: ProviderName,
    round: number,
    phase: 'opening' | 'rebuttal',
    stream: boolean,
    callbacks: DebateCallbacks,
    sessionId: string,
    signal?: AbortSignal,
    executionCwd?: string,
  ): Promise<void> {
    this.ensureNotAborted(sessionId, signal, round, provider);

    callbacks.onTurnStart(provider, phase);
    this.sessionStore?.updateStatus(sessionId, 'STREAMING');

    const messages = context.buildMessagesFor(provider, round, phase);
    const aiProvider = this.getProvider(provider);

    let content: string;
    try {
      content = await this.callWithRetry(
        async () => {
          if (stream) {
            const chunks: string[] = [];
            for await (const token of aiProvider.stream(messages, signal, executionCwd)) {
              this.ensureNotAborted(sessionId, signal, round, provider);
              callbacks.onToken(provider, token);
              this.emitEvent({
                type: 'agent_chunk',
                sessionId,
                timestamp: Date.now(),
                payload: { provider, token, round, phase },
              });
              chunks.push(token);
            }
            return chunks.join('');
          }
          return await aiProvider.generate(messages);
        },
        provider,
        callbacks,
        3,
        sessionId
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        this.emitCancellation(sessionId, this.getCancellationReason(signal), round, provider);
      } else if (isProviderTimeoutError(error)) {
        this.emitCancellation(sessionId, 'timeout', round, provider);
      }
      throw error;
    }

    const message: DebateMessage = { provider, round, phase, content };
    context.addMessage(message);
    this.sessionStore?.updateStatus(sessionId, 'RUNNING');
    callbacks.onTurnEnd(provider, content);
  }

  private async callWithRetry(
    fn: () => Promise<string>,
    provider: ProviderName,
    callbacks: DebateCallbacks,
    maxAttempts = 3,
    sessionId?: string
  ): Promise<string> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        // Re-throw AbortError immediately without emitting error event
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw error;
        }
        if (isProviderTimeoutError(error)) {
          throw error;
        }
        if (!isRateLimitError(error) || attempt === maxAttempts) {
          if (sessionId) {
            this.emitEvent({
              type: 'error',
              sessionId,
              timestamp: Date.now(),
              payload: {
                code: isRateLimitError(error) ? 'RATE_LIMIT_EXCEEDED' : 'PROVIDER_UNAVAILABLE',
                message: error instanceof Error ? error.message : String(error),
                provider,
                round: undefined,
                retryable: false,
              },
            });
          }
          throw error;
        }
        callbacks.onRetry(provider, attempt, maxAttempts, error as Error);
        await delay(attempt * 5000);
      }
    }
    throw new Error('Unreachable');
  }

  private getJudgeProvider(judge: JudgeOption): AIProvider {
    // For 'both', prefer claude as synthesizer, fallback to first available
    if (judge === 'both') {
      return this.providers.get('claude') ?? this.providers.values().next().value!;
    }
    return this.getProvider(judge);
  }

  private ensureNotAborted(
    sessionId: string,
    signal?: AbortSignal,
    lastRound?: number,
    lastProvider?: ProviderName,
  ): void {
    if (!signal?.aborted) return;
    this.emitCancellation(sessionId, this.getCancellationReason(signal), lastRound, lastProvider);
    throw new DOMException('Aborted', 'AbortError');
  }

  private getCancellationReason(signal?: AbortSignal): CancellationReason {
    return parseCancellationReason(signal?.reason) ?? 'user_cancelled';
  }

  private emitCancellation(
    sessionId: string,
    reason: CancellationReason,
    lastRound?: number,
    lastProvider?: ProviderName,
  ): void {
    const status = this.sessionStore?.get(sessionId)?.status;
    if (status === 'CANCELLED' || status === 'FAILED') {
      return;
    }

    this.emitEvent({
      type: 'cancelled',
      sessionId,
      timestamp: Date.now(),
      payload: { reason, lastRound, lastProvider },
    });
    this.sessionStore?.updateStatus(sessionId, reason === 'timeout' ? 'FAILED' : 'CANCELLED');
  }
}

function isRateLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes('rate limit') || message.includes('429') || message.includes('too many requests');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseCancellationReason(reason: unknown): CancellationReason | null {
  if (
    reason === 'user_cancelled' ||
    reason === 'timeout' ||
    reason === 'server_shutdown'
  ) {
    return reason;
  }

  if (reason instanceof Error) {
    return parseCancellationReason(reason.message);
  }

  if (typeof reason === 'string') {
    const normalized = reason.toLowerCase();
    if (normalized.includes('timeout')) return 'timeout';
    if (normalized.includes('server')) return 'server_shutdown';
    if (normalized.includes('cancel') || normalized.includes('abort')) return 'user_cancelled';
  }

  if (reason && typeof reason === 'object' && 'reason' in reason) {
    return parseCancellationReason((reason as { reason?: unknown }).reason);
  }

  return null;
}
