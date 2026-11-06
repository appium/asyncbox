/** Base class of the built-in typed errors of this package; match by `instanceof` or {@link AsyncboxError.code}. */
export class AsyncboxError extends Error {
  /** Stable machine-readable identifier, e.g. `ERR_ASYNCBOX_TIMEOUT` */
  readonly code: string;

  constructor(message: string, code: string = 'ERR_ASYNCBOX') {
    super(message);
    this.name = 'AsyncboxError';
    this.code = code;
  }
}

/** Error thrown by {@link withTimeout} when the deadline is exceeded. */
export class TimeoutError extends AsyncboxError {
  constructor(message?: string, code: string = 'ERR_ASYNCBOX_TIMEOUT') {
    super(message ?? 'Operation timed out', code);
    this.name = 'TimeoutError';
  }
}

/** Thrown by {@link waitForCondition} when the condition is not met in time. */
export class ConditionUnmetError extends TimeoutError {
  constructor(message?: string) {
    super(message ?? 'Condition unmet', 'ERR_ASYNCBOX_CONDITION_UNMET');
    this.name = 'ConditionUnmetError';
  }
}

/** Thrown by {@link AsyncLock} when a queue, execution or occupation time limit is exceeded. */
export class LockTimeoutError extends TimeoutError {
  constructor(message?: string) {
    super(message ?? 'Lock timed out', 'ERR_ASYNCBOX_LOCK_TIMEOUT');
    this.name = 'LockTimeoutError';
  }
}

/** Thrown by {@link AsyncLock} when the queue of a key already holds `maxPending` tasks. */
export class LockQueueFullError extends AsyncboxError {
  constructor(message?: string) {
    super(message ?? 'Too many pending tasks in queue', 'ERR_ASYNCBOX_LOCK_QUEUE_FULL');
    this.name = 'LockQueueFullError';
  }
}

/** Thrown when a promise is cancelled via `cancel`. */
export class PromiseCancellationError extends AsyncboxError {
  constructor(message: string = 'Promise cancelled') {
    super(message, 'ERR_ASYNCBOX_CANCELLED');
    this.name = 'PromiseCancellationError';
  }
}
