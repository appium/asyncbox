/** Base class of the built-in typed errors of this package; match by {@link AsyncboxError.is} or `code`. */
export class AsyncboxError extends Error {
  /** Stable machine-readable identifier of the error class, e.g. `ERR_ASYNCBOX_TIMEOUT` */
  static readonly code: string = 'ERR_ASYNCBOX';

  /** Same as the static `code` of the error class */
  readonly code: string;

  constructor(message: string, code: string = new.target.code) {
    super(message);
    this.name = 'AsyncboxError';
    this.code = code;
  }

  /**
   * Whether `err` is an instance of this error class. Unlike a bare `instanceof`, it also
   * matches by `code`, so errors created by another copy of this package are recognized.
   * Subclasses are matched by `instanceof` only, i.e. `TimeoutError.is` does not match a
   * `ConditionUnmetError` created by another copy.
   */
  static is<E extends AsyncboxError>(
    this: (abstract new (...args: any[]) => E) & {code: string},
    err: unknown,
  ): err is E {
    return err instanceof this || (err instanceof Error && (err as {code?: unknown}).code === this.code);
  }
}

/** Error thrown by {@link withTimeout} when the deadline is exceeded. */
export class TimeoutError extends AsyncboxError {
  static override readonly code: string = 'ERR_ASYNCBOX_TIMEOUT';

  constructor(message?: string, code?: string) {
    super(message ?? 'Operation timed out', code);
    this.name = 'TimeoutError';
  }
}

/** Thrown by {@link waitForCondition} when the condition is not met in time. */
export class ConditionUnmetError extends TimeoutError {
  static override readonly code = 'ERR_ASYNCBOX_CONDITION_UNMET';

  constructor(message?: string) {
    super(message ?? 'Condition unmet');
    this.name = 'ConditionUnmetError';
  }
}

/** Thrown by {@link AsyncLock} when a queue, execution or occupation time limit is exceeded. */
export class LockTimeoutError extends TimeoutError {
  static override readonly code = 'ERR_ASYNCBOX_LOCK_TIMEOUT';

  constructor(message?: string) {
    super(message ?? 'Lock timed out');
    this.name = 'LockTimeoutError';
  }
}

/** Thrown by {@link AsyncLock} when the queue of a key already holds `maxPending` tasks. */
export class LockQueueFullError extends AsyncboxError {
  static override readonly code = 'ERR_ASYNCBOX_LOCK_QUEUE_FULL';

  constructor(message?: string) {
    super(message ?? 'Too many pending tasks in queue');
    this.name = 'LockQueueFullError';
  }
}

/** Thrown when a promise is cancelled via `cancel`. */
export class PromiseCancellationError extends AsyncboxError {
  static override readonly code = 'ERR_ASYNCBOX_CANCELLED';

  constructor(message: string = 'Promise cancelled') {
    super(message);
    this.name = 'PromiseCancellationError';
  }
}
