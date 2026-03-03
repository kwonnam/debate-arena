import type { ProviderConfig } from './defaults.js';

export type SchemaStatus = 'valid' | 'invalid';
export type ConnectivityStatus = 'unknown' | 'ok' | 'fail';
export type PendingStatus = 'validating' | 'ready' | 'failed';

export interface ProviderSummary {
  id: string;
  type: ProviderConfig['type'];
  baseUrl?: string;
  model: string;
  apiKeyMasked?: string;
}

export interface ConfigSnapshot {
  version: number;
  providers: Record<string, ProviderSummary>;
  updatedAt: number;
}

export interface PendingConfigState {
  version: number;
  providers: Record<string, ProviderSummary>;
  updatedAt: number;
  pendingStatus: PendingStatus;
  schemaStatus: SchemaStatus;
  connectivityStatus: ConnectivityStatus;
  effectivePolicy: 'next_session';
  validationRequestId?: string;
  validationMessage?: string;
}

export interface ConfigStateView {
  active: ConfigSnapshot;
  pending: PendingConfigState | null;
  revision: number;
}

interface ConfigEvent {
  revision: number;
  type: 'pending_created' | 'validation_result';
  timestamp: number;
  payload: Record<string, unknown>;
}

interface PendingSecret {
  apiKey?: string;
  requestId: string;
}

const now = () => Date.now();

let revisionCounter = 0;
const events: ConfigEvent[] = [];

const activeSnapshot: ConfigSnapshot = {
  version: 1,
  providers: {},
  updatedAt: now(),
};

let pendingState: PendingConfigState | null = null;
let pendingSecret: PendingSecret | null = null;

function maskKey(key?: string): string | undefined {
  if (!key) return undefined;
  if (key.length <= 4) return '***';
  return `${key.slice(0, 2)}***${key.slice(-2)}`;
}

function nextRevision(): number {
  revisionCounter += 1;
  return revisionCounter;
}

function pushEvent(type: ConfigEvent['type'], payload: Record<string, unknown>): void {
  events.push({
    revision: nextRevision(),
    type,
    timestamp: now(),
    payload,
  });
}

export function getConfigState(): ConfigStateView {
  return {
    active: activeSnapshot,
    pending: pendingState,
    revision: revisionCounter,
  };
}

export function getConfigEvents(fromRevision: number): ConfigEvent[] {
  const start = Math.max(0, fromRevision || 0);
  return events.filter((event) => event.revision > start);
}

export interface RegisterModelInput {
  id: string;
  type: ProviderConfig['type'];
  baseUrl?: string;
  model: string;
  apiKey?: string;
  expectedVersion?: number;
}

export interface RegisterResult {
  state: ConfigStateView;
  accepted: boolean;
  error?: string;
}

export function registerPendingModel(input: RegisterModelInput): RegisterResult {
  if (input.expectedVersion && input.expectedVersion !== activeSnapshot.version) {
    return {
      accepted: false,
      error: 'Version conflict. Please refresh and retry.',
      state: getConfigState(),
    };
  }

  if (!input.id || !input.type || !input.model) {
    return {
      accepted: false,
      error: 'Missing required fields: id, type, model.',
      state: getConfigState(),
    };
  }

  if (input.type === 'ollama-compat' && !input.baseUrl) {
    return {
      accepted: false,
      error: 'baseUrl is required for ollama-compat providers.',
      state: getConfigState(),
    };
  }

  const nextVersion = activeSnapshot.version + 1;
  const requestId = `${nextVersion}-${now()}`;
  const newProvider: ProviderSummary = {
    id: input.id,
    type: input.type,
    baseUrl: input.baseUrl,
    model: input.model,
    apiKeyMasked: maskKey(input.apiKey),
  };

  pendingState = {
    version: nextVersion,
    providers: { ...activeSnapshot.providers, [input.id]: newProvider },
    updatedAt: now(),
    pendingStatus: 'validating',
    schemaStatus: 'valid',
    connectivityStatus: 'unknown',
    effectivePolicy: 'next_session',
    validationRequestId: requestId,
  };

  pendingSecret = { apiKey: input.apiKey, requestId };

  pushEvent('pending_created', {
    version: nextVersion,
    providerId: input.id,
    type: input.type,
  });

  return { accepted: true, state: getConfigState() };
}

export function applyValidationResult(requestId: string, ok: boolean, message?: string): void {
  if (!pendingState || pendingState.validationRequestId !== requestId) return;
  pendingState = {
    ...pendingState,
    pendingStatus: ok ? 'ready' : 'failed',
    connectivityStatus: ok ? 'ok' : 'fail',
    validationMessage: message,
    updatedAt: now(),
  };

  pushEvent('validation_result', {
    version: pendingState.version,
    ok,
    message,
  });
}

export function getPendingSecret(): PendingSecret | null {
  return pendingSecret;
}
