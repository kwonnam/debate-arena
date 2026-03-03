import type { DebateEventEnvelope } from '../types/debate-events.js';

type EventListener = (event: DebateEventEnvelope) => void;

export class EventHub {
  private listenersBySession = new Map<string, Set<EventListener>>();

  subscribe(sessionId: string, listener: EventListener): () => void {
    const listeners = this.listenersBySession.get(sessionId) ?? new Set<EventListener>();
    listeners.add(listener);
    this.listenersBySession.set(sessionId, listeners);

    return () => {
      const current = this.listenersBySession.get(sessionId);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) {
        this.listenersBySession.delete(sessionId);
      }
    };
  }

  publish(envelope: DebateEventEnvelope): void {
    const listeners = this.listenersBySession.get(envelope.sessionId);
    if (!listeners) return;
    for (const listener of listeners) {
      listener(envelope);
    }
  }
}
