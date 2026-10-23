/** Error thrown by {@link withTimeout} when the deadline is exceeded. */
export class TimeoutError extends Error {
  constructor(message?: string) {
    super(message ?? 'Operation timed out');
    this.name = 'TimeoutError';
  }
}

/** Thrown when a promise is cancelled via `cancel`. */
export class PromiseCancellationError extends Error {
  constructor(message: string = 'Promise cancelled') {
    super(message);
    this.name = 'PromiseCancellationError';
  }
}
