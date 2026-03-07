import type { Message } from '../providers/types.js';
import type {
  DebateAttachment,
  DebateMessage,
  DebateRoundState,
  NewsMode,
} from '../types/debate.js';
import type { DebateParticipant } from '../types/roles.js';
import {
  DEBATE_PROMPTS,
  type PromptBuilders,
  buildRoundEvidenceSection,
  buildRoundStateContextSection,
  buildTranscriptFallbackSection,
  type RoundEvidenceMode,
} from './prompt-builder.js';
import type { EvidenceSnapshot } from '../news/snapshot.js';
import { buildParticipantRolePrompt } from '../roles/config.js';

export class DebateContext {
  private messages: DebateMessage[] = [];
  private roundStates: DebateRoundState[] = [];
  private question: string;
  private projectContext?: string;
  private prompts: PromptBuilders;
  private attachments: DebateAttachment[];
  private participants?: DebateParticipant[];
  private snapshot?: EvidenceSnapshot;
  private newsMode?: NewsMode;

  constructor(
    question: string,
    projectContext?: string,
    prompts: PromptBuilders = DEBATE_PROMPTS,
    attachments: DebateAttachment[] = [],
    participants?: DebateParticipant[],
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

  addRoundState(state: DebateRoundState): void {
    this.roundStates = [...this.roundStates.filter((entry) => entry.round !== state.round), state]
      .sort((left, right) => left.round - right.round);
  }

  getRoundStates(): DebateRoundState[] {
    return [...this.roundStates];
  }

  getMessagesForRound(round: number): DebateMessage[] {
    return this.messages.filter((message) => message.round === round);
  }

  getLastMessageFrom(provider: string): DebateMessage | undefined {
    return this.getLastMessageFromBeforeRound(provider);
  }

  private getLastMessageFromBeforeRound(
    participantId: string,
    roundExclusive?: number,
  ): DebateMessage | undefined {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (
        this.messages[i].participantId === participantId &&
        (roundExclusive === undefined || this.messages[i].round < roundExclusive)
      ) {
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
    participant: DebateParticipant,
    round: number,
    phase: 'opening' | 'rebuttal'
  ): Message[] {
    const result: Message[] = [
      { role: 'system', content: this.prompts.systemPrompt(participant, this.projectContext, this.participants) },
    ];

    if (phase === 'opening') {
      result.push(this.buildOpeningMessage(participant));
      return result;
    }

    result.push(this.buildOpeningMessage(participant));
    this.appendRoundStateContext(result, round, participant);

    return result;
  }

  private getEvidenceModeForParticipant(participant: DebateParticipant): RoundEvidenceMode {
    if (!this.newsMode || this.newsMode === 'unified') return 'unified';
    if (!this.participants || this.participants.length !== 2) return 'unified';
    const isFirst = this.participants[0]?.id === participant.id;
    return isFirst ? 'split-first' : 'split-second';
  }

  private buildOpeningMessage(participant?: DebateParticipant): Message {
    let content = this.prompts.openingPrompt(this.question);

    if (participant) {
      content += [
        '',
        '## Assigned Role',
        buildParticipantRolePrompt(participant.role),
      ].join('\n');
    }

    if (this.snapshot && this.snapshot.articles.length > 0 && participant) {
      const mode = this.getEvidenceModeForParticipant(participant);
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

  private appendRoundStateContext(result: Message[], round: number, participant: DebateParticipant): void {
    const priorStates = this.roundStates.filter((state) => state.round < round);
    if (priorStates.length === 0) {
      this.appendTranscriptReplay(result, participant);
      return;
    }

    const lastOwnMessage = this.getLastMessageFromBeforeRound(participant.id, round);
    if (lastOwnMessage) {
      result.push({ role: 'assistant', content: lastOwnMessage.content });
    }

    result.push({
      role: 'user',
      content: buildRoundStateContextSection(priorStates),
    });

    const latestOpponentMessages = this.getLatestOpponentMessagesBeforeRound(participant.id, round);
    for (const latestOpponentMessage of latestOpponentMessages) {
      result.push({
        role: 'user',
        content: this.prompts.rebuttalPrompt(latestOpponentMessage.label, latestOpponentMessage.content),
      });
    }

    const latestUserMessage = this.getLastMessageFromBeforeRound('user', round);
    if (latestUserMessage) {
      result.push({
        role: 'user',
        content: [
          '## Latest User Guidance',
          latestUserMessage.content,
          '',
          'Treat this as direct user guidance that should shape your next response.',
        ].join('\n'),
      });
    }

    for (const state of priorStates) {
      if (!state.transcriptFallbackUsed) continue;
      const messages = this.getMessagesForRound(state.round)
        .map((message) => ({ label: message.label, content: message.content }));
      if (messages.length === 0) continue;
      result.push({
        role: 'user',
        content: buildTranscriptFallbackSection(state.round, messages),
      });
    }

    result.push({
      role: 'user',
      content: [
        '## Your Task',
        'Using the compressed debate state above, respond to the strongest unresolved disagreements from the other participants.',
        'Use the latest participant responses and any explicit user guidance as higher-priority context than older rounds.',
        'Directly address counterarguments, build on valid agreements, and avoid repeating settled points.',
      ].join('\n'),
    });
  }

  private getLatestOpponentMessagesBeforeRound(
    participantId: string,
    roundExclusive: number,
  ): DebateMessage[] {
    const collected = new Map<string, DebateMessage>();

    for (let i = this.messages.length - 1; i >= 0; i--) {
      const message = this.messages[i];
      if (message.round >= roundExclusive) continue;
      if (message.participantId === participantId || message.participantId === 'user') continue;
      if (!collected.has(message.participantId)) {
        collected.set(message.participantId, message);
      }
    }

    const participantOrder = this.participants?.map((entry) => entry.id) || [];
    return [...collected.values()].sort((left, right) => {
      return participantOrder.indexOf(left.participantId) - participantOrder.indexOf(right.participantId);
    });
  }

  private appendTranscriptReplay(result: Message[], participant: DebateParticipant): void {
    for (const msg of this.messages) {
      if (msg.participantId === participant.id) {
        result.push({ role: 'assistant', content: msg.content });
      } else {
        result.push({
          role: 'user',
          content: this.prompts.rebuttalPrompt(msg.label, msg.content),
        });
      }
    }
  }
}
