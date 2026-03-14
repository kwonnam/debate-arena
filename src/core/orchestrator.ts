import { randomUUID } from 'node:crypto';
import type { AIProvider, Message } from '../providers/types.js';
import type {
  DebateCallbacks,
  DebateMessage,
  DebateOptions,
  DebateResult,
  JudgeOption,
  ProviderName,
} from '../types/debate.js';
import type { DebateEvent } from '../types/debate-events.js';
import type { DebateParticipant } from '../types/roles.js';
import type { SessionEvidenceSummary, SessionStore } from './session-store.js';
import { DebateContext } from './context.js';
import { normalizeDebateParticipants } from './participants.js';
import { getPromptBuilders, getSynthesisPromptBuilder } from './prompt-builder.js';
import { buildFallbackRoundState, RoundStateExtractor } from './round-state.js';
import { Synthesizer } from './synthesizer.js';
import { isProviderTimeoutError } from '../providers/errors.js';
import { summarizeSnapshot } from '../news/snapshot.js';

type CancellationReason = 'user_cancelled' | 'timeout' | 'server_shutdown';
type DiagnosticLogger = (message: string, meta?: Record<string, unknown>) => void;

export class DebateOrchestrator {
  private providers: Map<ProviderName, AIProvider>;
  private sessionStore?: SessionStore;
  private eventEmitter?: (event: DebateEvent) => void;
  private diagnosticLogger?: DiagnosticLogger;

  constructor(
    providers: Map<ProviderName, AIProvider> | { codex: AIProvider; claude: AIProvider; gemini?: AIProvider },
    sessionStore?: SessionStore,
    eventEmitter?: (event: DebateEvent) => void,
    diagnosticLogger?: DiagnosticLogger,
  ) {
    if (providers instanceof Map) {
      this.providers = providers;
    } else {
      this.providers = new Map(Object.entries(providers) as [ProviderName, AIProvider][]);
    }
    this.sessionStore = sessionStore;
    this.eventEmitter = eventEmitter;
    this.diagnosticLogger = diagnosticLogger;
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

  private logDiagnostic(message: string, meta?: Record<string, unknown>): void {
    this.diagnosticLogger?.(message, meta);
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
    const resumeFromRound = normalizeResumeFromRound(options.resumeFromRound, rounds);
    const participants = normalizeDebateParticipants(options.participants);
    const context = new DebateContext(
      options.question,
      options.projectContext,
      prompts,
      options.attachments ?? [],
      participants,
      options.snapshot,
      options.newsMode,
      options.previousDebate,
    );

    for (const message of options.initialMessages ?? []) {
      context.addMessage(message);
    }

    for (const roundState of options.initialRoundStates ?? []) {
      context.addRoundState(roundState);
    }

    if (this.sessionStore) {
      this.sessionStore.create(sessionId, {
        sessionId,
        question: options.question,
        participants: toEventParticipants(participants),
        participantDetails: participants,
        rounds: options.rounds,
        createdAt: Date.now(),
        judge: options.judge,
        mode: mode,
        workflowKind: options.workflowKind ?? 'general',
        executionCwd: options.executionCwd,
        noContext: options.noContext,
        attachments: options.attachments ?? [],
        evidence: toSessionEvidenceSummary(options.snapshot),
        ollamaModel: options.ollamaModel,
        resumedFromSessionId: options.resumeFromSessionId,
        resumeStage: options.resumeStage,
        continuedFromSessionId: options.continuedFromSessionId,
      });
      this.sessionStore.updateStatus(sessionId, 'RUNNING');
    }
    this.emitSeededHistory(sessionId, participants, rounds, context, resumeFromRound);
    this.logDiagnostic('debate_run_started', {
      sessionId,
      rounds,
      stream,
      judge: options.judge,
      workflowKind: options.workflowKind ?? 'general',
      participantProviders: participants.map((participant) => participant.provider),
      executionCwd: options.executionCwd,
      hasSnapshot: Boolean(options.snapshot),
      resumedFromSessionId: options.resumeFromSessionId,
      resumeStage: options.resumeStage,
      resumeFromRound,
    });

    try {
      for (let round = resumeFromRound; round <= rounds; round++) {
        this.ensureNotAborted(sessionId, options.signal, round);
        this.sessionStore?.updateStatus(sessionId, 'RUNNING');
        callbacks.onRoundStart(round, rounds);

        this.emitEvent({
          type: 'round_started',
          sessionId,
          timestamp: Date.now(),
          payload: { round, total: rounds, totalRounds: rounds, participants: toEventParticipants(participants) },
        });

        const phase = round === 1 ? 'opening' : 'rebuttal';

        if (round === 1) {
          await this.executeParallelOpeningTurns(
            context,
            participants,
            round,
            stream,
            callbacks,
            sessionId,
            options.signal,
            options.executionCwd,
          );
        } else {
          for (const participant of participants) {
            await this.executeTurn(
              context,
              participant,
              round,
              phase,
              stream,
              callbacks,
              sessionId,
              options.signal,
              options.executionCwd,
            );
          }
        }

        // User turn (interactive mode)
        if (options.interactive && callbacks.onUserInput) {
          await this.executeUserTurn(context, round, callbacks);
        }

        // Collect round messages
        const roundMessages = context.getMessages()
          .filter((m) => m.round === round)
          .map((m) => ({
            provider: m.provider,
            participantId: m.participantId,
            label: m.label,
            phase: m.phase,
            content: m.content,
          }));

        this.emitEvent({
          type: 'round_finished',
          sessionId,
          timestamp: Date.now(),
          payload: { round, messages: roundMessages },
        });
        const roundState = await this.buildRoundState(
          context,
          options.question,
          round,
          options.judge,
        );
        context.addRoundState(roundState);
        this.emitEvent({
          type: 'round_state_ready',
          sessionId,
          timestamp: Date.now(),
          payload: roundState,
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
              context.getRoundStates(),
            )) {
              this.ensureNotAborted(sessionId, options.signal, rounds, judgeProviderName);
              callbacks.onSynthesisToken(token);
              this.emitEvent({
                type: 'agent_chunk',
                sessionId,
                timestamp: Date.now(),
                payload: {
                  provider: judgeProviderName,
                  participantId: 'judge',
                  label: 'Judge',
                  token,
                  round: rounds,
                  phase: 'synthesis',
                },
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
              context.getRoundStates(),
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
      this.logDiagnostic('debate_run_completed', {
        sessionId,
        rounds,
        synthesized: Boolean(synthesis),
        messageCount: context.getMessages().length,
      });

      return {
        question: options.question,
        messages: context.getMessages(),
        roundStates: context.getRoundStates(),
        synthesis,
        rounds,
        mode,
      };
    } catch (error) {
      this.logDiagnostic('debate_run_failed', {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
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
      participantId: 'user',
      label: 'User',
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
    participant: DebateParticipant,
    round: number,
    phase: 'opening' | 'rebuttal',
    stream: boolean,
    callbacks: DebateCallbacks,
    sessionId: string,
    signal?: AbortSignal,
    executionCwd?: string,
  ): Promise<void> {
    this.ensureNotAborted(sessionId, signal, round, participant.provider);

    callbacks.onTurnStart(participant, phase);
    this.sessionStore?.updateStatus(sessionId, 'STREAMING');

    const message = await this.generateTurnMessage(
      context,
      participant,
      round,
      phase,
      stream,
      callbacks,
      sessionId,
      signal,
      executionCwd,
      true,
    );
    context.addMessage(message);
    this.sessionStore?.updateStatus(sessionId, 'RUNNING');
    callbacks.onTurnEnd(participant, message.content);
  }

  private async executeParallelOpeningTurns(
    context: DebateContext,
    participants: DebateParticipant[],
    round: number,
    stream: boolean,
    callbacks: DebateCallbacks,
    sessionId: string,
    signal?: AbortSignal,
    executionCwd?: string,
  ): Promise<void> {
    this.sessionStore?.updateStatus(sessionId, 'STREAMING');

    const settled = await Promise.allSettled(
      participants.map((participant) =>
        this.generateTurnMessage(
          context,
          participant,
          round,
          'opening',
          stream,
          callbacks,
          sessionId,
          signal,
          executionCwd,
          false,
          false,
        )
      )
    );

    const rejected = settled.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    if (rejected) {
      throw rejected.reason;
    }

    const messages = settled.map((result) => (result as PromiseFulfilledResult<DebateMessage>).value);
    for (const message of messages) {
      const participant = participants.find((entry) => entry.id === message.participantId);
      if (!participant) continue;
      callbacks.onTurnStart(participant, message.phase);
      if (stream) {
        this.emitBufferedTurnChunk(sessionId, message);
      }
      context.addMessage(message);
      callbacks.onTurnEnd(participant, message.content);
    }
    this.sessionStore?.updateStatus(sessionId, 'RUNNING');
  }

  private async generateTurnMessage(
    context: DebateContext,
    participant: DebateParticipant,
    round: number,
    phase: 'opening' | 'rebuttal',
    stream: boolean,
    callbacks: DebateCallbacks,
    sessionId: string,
    signal?: AbortSignal,
    executionCwd?: string,
    forwardTokens = true,
    emitChunkEvents = true,
  ): Promise<DebateMessage> {
    this.ensureNotAborted(sessionId, signal, round, participant.provider);

    const messages = context.buildMessagesFor(participant, round, phase);
    const aiProvider = this.getProvider(participant.provider);
    const startedAt = Date.now();
    this.logDiagnostic('turn_started', {
      sessionId,
      round,
      phase,
      participantId: participant.id,
      participantLabel: participant.label,
      provider: participant.provider,
      promptMessageCount: messages.length,
      promptChars: estimateMessageChars(messages),
    });

    try {
      const content = await this.callWithRetry(
        async () => {
          if (stream) {
            const chunks: string[] = [];
            for await (const token of aiProvider.stream(messages, signal, executionCwd)) {
              this.ensureNotAborted(sessionId, signal, round, participant.provider);
              if (forwardTokens) {
                callbacks.onToken(participant, token);
              }
              if (emitChunkEvents) {
                this.emitEvent({
                  type: 'agent_chunk',
                  sessionId,
                  timestamp: Date.now(),
                  payload: {
                    provider: participant.provider,
                    participantId: participant.id,
                    label: participant.label,
                    token,
                    round,
                    phase,
                  },
                });
              }
              chunks.push(token);
            }
            return chunks.join('');
          }
          return aiProvider.generate(messages);
        },
        participant,
        callbacks,
        3,
        sessionId
      );
      this.logDiagnostic('turn_completed', {
        sessionId,
        round,
        phase,
        participantId: participant.id,
        participantLabel: participant.label,
        provider: participant.provider,
        durationMs: Date.now() - startedAt,
        contentChars: content.length,
      });

      return {
        participantId: participant.id,
        label: participant.label,
        provider: participant.provider,
        round,
        phase,
        content,
      };
    } catch (error) {
      this.logDiagnostic(
        isProviderTimeoutError(error)
          ? 'turn_timeout'
          : error instanceof DOMException && error.name === 'AbortError'
            ? 'turn_aborted'
            : 'turn_failed',
        {
          sessionId,
          round,
          phase,
          participantId: participant.id,
          participantLabel: participant.label,
          provider: participant.provider,
          durationMs: Date.now() - startedAt,
          error: error instanceof Error ? error.message : String(error),
        },
      );
      if (error instanceof DOMException && error.name === 'AbortError') {
        this.emitCancellation(sessionId, this.getCancellationReason(signal), round, participant.provider);
      } else if (isProviderTimeoutError(error)) {
        this.emitCancellation(sessionId, 'timeout', round, participant.provider);
      }
      throw error;
    }
  }

  private emitBufferedTurnChunk(sessionId: string, message: DebateMessage): void {
    if (!message.content) return;

    this.emitEvent({
      type: 'agent_chunk',
      sessionId,
      timestamp: Date.now(),
      payload: {
        provider: message.provider,
        participantId: message.participantId,
        label: message.label,
        token: message.content,
        round: message.round,
        phase: message.phase,
      },
    });
  }

  private emitSeededHistory(
    sessionId: string,
    participants: DebateParticipant[],
    totalRounds: number,
    context: DebateContext,
    resumeFromRound: number,
  ): void {
    if (resumeFromRound <= 1) {
      return;
    }

    for (let round = 1; round < resumeFromRound; round++) {
      const roundMessages = context.getMessagesForRound(round);
      if (roundMessages.length === 0) {
        continue;
      }

      this.emitEvent({
        type: 'round_started',
        sessionId,
        timestamp: Date.now(),
        payload: {
          round,
          total: totalRounds,
          totalRounds,
          participants: toEventParticipants(participants),
        },
      });

      this.emitEvent({
        type: 'round_finished',
        sessionId,
        timestamp: Date.now(),
        payload: {
          round,
          messages: roundMessages.map((message) => ({
            provider: message.provider,
            participantId: message.participantId,
            label: message.label,
            phase: message.phase,
            content: message.content,
          })),
        },
      });

      const roundState = context.getRoundStates().find((entry) => entry.round === round);
      if (!roundState) {
        continue;
      }

      this.emitEvent({
        type: 'round_state_ready',
        sessionId,
        timestamp: Date.now(),
        payload: roundState,
      });
    }
  }

  private async buildRoundState(
    context: DebateContext,
    question: string,
    round: number,
    judge: JudgeOption,
  ) {
    const roundMessages = context.getMessagesForRound(round);
    const judgeProvider = this.getJudgeProvider(judge);
    const extractor = new RoundStateExtractor(judgeProvider);

    try {
      return await extractor.extract(question, roundMessages, round);
    } catch (error) {
      const warning = error instanceof Error ? error.message : String(error);
      return buildFallbackRoundState(roundMessages, round, warning);
    }
  }

  private async callWithRetry(
    fn: () => Promise<string>,
    participant: DebateParticipant,
    callbacks: DebateCallbacks,
    maxAttempts = 3,
    sessionId?: string
  ): Promise<string> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const content = await fn();
        this.logDiagnostic('turn_attempt_completed', {
          sessionId,
          participantId: participant.id,
          participantLabel: participant.label,
          provider: participant.provider,
          attempt,
          contentChars: content.length,
        });
        return content;
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
                provider: participant.provider,
                round: undefined,
                retryable: false,
              },
            });
          }
          throw error;
        }
        callbacks.onRetry(participant, attempt, maxAttempts, error as Error);
        this.logDiagnostic('turn_retry_scheduled', {
          sessionId,
          participantId: participant.id,
          participantLabel: participant.label,
          provider: participant.provider,
          attempt,
          maxAttempts,
          error: error instanceof Error ? error.message : String(error),
        });
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

function estimateMessageChars(messages: Message[]): number {
  return messages.reduce((total, message) => {
    const attachmentChars = (message.attachments ?? []).reduce((sum, attachment) => {
      return sum + (attachment.content?.length ?? 0);
    }, 0);
    return total + message.content.length + attachmentChars;
  }, 0);
}

function toSessionEvidenceSummary(snapshot?: DebateOptions['snapshot']): SessionEvidenceSummary | undefined {
  if (!snapshot) {
    return undefined;
  }

  const summary = summarizeSnapshot(snapshot);
  return {
    id: summary.id,
    kind: summary.kind,
    query: summary.query,
    collectedAt: summary.collectedAt,
    articleCount: summary.articleCount,
    sources: summary.sources,
    topDomains: summary.topDomains,
    excludedCount: summary.excludedCount,
  };
}

function toEventParticipants(participants: DebateParticipant[]) {
  return participants.map((participant) => ({
    id: participant.id,
    label: participant.label,
    provider: participant.provider,
  }));
}

function isRateLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes('rate limit') || message.includes('429') || message.includes('too many requests');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeResumeFromRound(resumeFromRound: number | undefined, rounds: number): number {
  if (!Number.isFinite(resumeFromRound)) {
    return 1;
  }

  return Math.max(1, Math.min(rounds + 1, Math.trunc(resumeFromRound as number)));
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
