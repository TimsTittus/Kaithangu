/** Thrown by a real adapter whose provider has not been set up yet. */
export class NotConfiguredError extends Error {
  readonly code = 'NOT_CONFIGURED';

  constructor(readonly adapter: string) {
    super(`${adapter} adapter is not configured`);
    this.name = 'NotConfiguredError';
  }
}

export function isNotConfiguredError(value: unknown): value is NotConfiguredError {
  return value instanceof NotConfiguredError;
}
