export function isTerminalSessionStatus(status) {
  return status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED';
}

export function deriveSessionStatusPatchFromEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object') {
    return null;
  }

  const sessionId = String(envelope.sessionId || '').trim();
  if (!sessionId) {
    return null;
  }

  const event = envelope.event;
  const status = deriveSessionStatusFromEvent(event);
  if (!status) {
    return null;
  }

  const updatedAt = Number(envelope.timestamp);
  return {
    sessionId,
    status,
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
  };
}

export function deriveSessionStatusFromEvent(event) {
  if (!event || typeof event !== 'object') {
    return null;
  }

  switch (event.type) {
    case 'round_started':
      return 'RUNNING';
    case 'agent_chunk':
      return event.payload?.phase === 'synthesis' ? 'SYNTHESIZING' : 'STREAMING';
    case 'round_state_ready':
      return 'ROUND_COMPLETE';
    case 'synthesis_ready':
      if (event.payload?.status === 'started') return 'SYNTHESIZING';
      if (event.payload?.status === 'completed') return 'COMPLETED';
      return null;
    case 'cancelled':
      return event.payload?.reason === 'timeout' ? 'FAILED' : 'CANCELLED';
    case 'error':
      return 'FAILED';
    default:
      return null;
  }
}

export function applySessionStatusPatch(sessions, patch) {
  if (!Array.isArray(sessions) || !patch?.sessionId || !patch?.status) {
    return Array.isArray(sessions) ? sessions : [];
  }

  let changed = false;
  const nextSessions = sessions.map((session) => {
    if (session?.sessionId !== patch.sessionId) {
      return session;
    }

    changed = true;
    return {
      ...session,
      status: patch.status,
      updatedAt: Math.max(Number(session.updatedAt) || 0, Number(patch.updatedAt) || 0),
    };
  });

  return changed ? nextSessions : sessions;
}
