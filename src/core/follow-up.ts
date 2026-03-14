import type { PreviousDebateContext } from '../types/debate.js';
import type { DebateSession } from './session-store.js';

export function buildFollowUpContext(session: DebateSession): PreviousDebateContext {
  let synthesis: string | undefined;
  let latestRoundState: PreviousDebateContext['latestRoundState'];

  for (const envelope of session.events) {
    const event = envelope.event;
    if (event.type === 'round_state_ready') {
      latestRoundState = event.payload;
      continue;
    }

    if (event.type === 'synthesis_ready' && event.payload.status === 'completed' && event.payload.content?.trim()) {
      synthesis = event.payload.content.trim();
    }
  }

  if (!synthesis && !latestRoundState) {
    throw new Error('The selected session does not have reusable debate output yet.');
  }

  return {
    sourceSessionId: session.metadata.sessionId,
    question: session.metadata.question,
    judge: session.metadata.judge,
    participants: session.metadata.participants.map((participant) => ({
      label: participant.label,
      provider: participant.provider,
    })),
    synthesis,
    latestRoundState: latestRoundState
      ? {
        ...latestRoundState,
        keyIssues: [...latestRoundState.keyIssues],
        agreements: [...latestRoundState.agreements],
        nextFocus: [...latestRoundState.nextFocus],
      }
      : undefined,
  };
}
