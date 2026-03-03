export class ProviderTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(message: string, timeoutMs: number) {
    super(message);
    this.name = 'ProviderTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

export function isProviderTimeoutError(error: unknown): error is ProviderTimeoutError {
  return error instanceof ProviderTimeoutError;
}
