import type { DebateMessage, DebateRoundState } from '../types/debate.js';
import type { DebateParticipant } from '../types/roles.js';
import { buildFallbackRoundState } from './round-state.js';
import type { DebateSession, SessionMetadata } from './session-store.js';

export interface ResumePlan {
  startRound: number;
  completedRounds: number[];
  initialMessages: DebateMessage[];
  initialRoundStates: DebateRoundState[];
  synthesisOnly: boolean;
  resumeStage: string;
}

export function buildResumePlan(session: DebateSession): ResumePlan {
  const totalRounds = Math.max(1, session.metadata.rounds);
  const completedMessagesByRound = new Map<number, DebateMessage[]>();
  const roundStatesByRound = new Map<number, DebateRoundState>();
  let synthesisCompleted = false;

  for (const envelope of session.events) {
    const event = envelope.event;
    if (event.type === 'round_finished') {
      completedMessagesByRound.set(
        event.payload.round,
        event.payload.messages.map((message) => ({
          participantId: message.participantId,
          label: message.label,
          provider: message.provider,
          round: event.payload.round,
          phase: message.phase,
          content: message.content,
        })),
      );
      continue;
    }

    if (event.type === 'round_state_ready') {
      roundStatesByRound.set(event.payload.round, event.payload);
      continue;
    }

    if (event.type === 'synthesis_ready' && event.payload.status === 'completed') {
      synthesisCompleted = true;
    }
  }

  if (synthesisCompleted || session.status === 'COMPLETED') {
    throw new Error('Completed sessions do not need resume.');
  }

  const completedRounds: number[] = [];
  for (let round = 1; round <= totalRounds; round++) {
    if (!completedMessagesByRound.has(round)) {
      break;
    }
    completedRounds.push(round);
  }

  const initialMessages: DebateMessage[] = [];
  const initialRoundStates: DebateRoundState[] = [];

  for (const round of completedRounds) {
    const messages = completedMessagesByRound.get(round) ?? [];
    initialMessages.push(...messages);

    const roundState = roundStatesByRound.get(round)
      ?? buildFallbackRoundState(
        messages,
        round,
        'Round state was missing during resume and was reconstructed from completed messages.',
      );
    initialRoundStates.push(roundState);
  }

  const startRound = completedRounds.length >= totalRounds
    ? totalRounds + 1
    : completedRounds.length + 1;

  return {
    startRound,
    completedRounds,
    initialMessages,
    initialRoundStates,
    synthesisOnly: startRound > totalRounds,
    resumeStage: startRound > totalRounds ? 'Synthesis' : `Round ${startRound}`,
  };
}

export function hydrateParticipantsForResume(metadata: SessionMetadata): DebateParticipant[] {
  if (Array.isArray(metadata.participantDetails) && metadata.participantDetails.length > 0) {
    return metadata.participantDetails.map((participant) => ({
      ...participant,
      role: {
        roleId: participant.role?.roleId || participant.id,
        roleLabel: participant.role?.roleLabel || participant.label,
        focus: participant.role?.focus || `${participant.label} 관점에서 질문에 답합니다.`,
        instructions: Array.isArray(participant.role?.instructions) ? [...participant.role.instructions] : [],
        requiredQuestions: Array.isArray(participant.role?.requiredQuestions)
          ? [...participant.role.requiredQuestions]
          : [],
      },
    }));
  }

  return metadata.participants.map((participant, index) => ({
    id: participant.id || `participant-${index + 1}`,
    provider: participant.provider,
    label: participant.label || participant.provider,
    role: {
      roleId: participant.id || `participant-${index + 1}`,
      roleLabel: participant.label || participant.provider,
      focus: `${participant.label || participant.provider} 관점에서 질문에 답합니다.`,
      instructions: [],
      requiredQuestions: [],
    },
  }));
}
