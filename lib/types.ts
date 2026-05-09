/**
 * Parameter provided to a progress callback
 */
export interface Progress {
  /** Elapsed time in milliseconds since the operation started */
  elapsedMs: number;
  /** Remaining time in milliseconds until the operation completes */
  timeLeft: number;
  /** Progress as a number between 0 and 1 (0 = not started, 1 = complete) */
  progress: number;
}

/**
 * Progress callback for {@link longSleep}
 */
export type ProgressCallback = (progress: Progress) => void;

/**
 * Options for {@link longSleep}
 */
export interface LongSleepOptions {
  /** Minimum duration in milliseconds before using long sleep behavior.
   * @default 5000
   */
  thresholdMs?: number;
  /** Interval in milliseconds between progress callbacks.
   * @default 1000
   */
  intervalMs?: number;
  /** Optional callback function to receive progress updates during the sleep */
  progressCb?: ProgressCallback | null;
}

/**
 * Options for {@link asyncmap} and {@link asyncfilter}
 */
export type MapFilterOptions = boolean | {concurrency: number};

/**
 * Object form of {@link sleep}'s argument: duration plus optional cancellation rejection override.
 * Structural typing allows class instances; {@link sleep} accepts any non-array object with a finite `ms`.
 */
export interface SleepOptions {
  /** Duration in milliseconds */
  ms: number;
  /**
   * When {@link sleep}'s `cancel` runs: a non-empty string becomes {@link PromiseCancellationError}
   * with that message; an `Error` rejects with that same instance; `null` resolves the promise
   * instead of rejecting; omitted, `undefined`, or `''` use the default {@link PromiseCancellationError}.
   */
  cancelError?: string | Error | null;
}

/**
 * Argument to {@link sleep}: either milliseconds or an options object (see {@link SleepOptions}).
 */
export type SleepArg = number | SleepOptions;

/**
 * A promise with a {@linkcode cancel} method (e.g. from {@link sleep}).
 *
 * @typeParam T - Resolved value type; {@link sleep} uses `void`.
 */
export type CancellablePromise<T = void> = Promise<T> & {
  cancel: () => void;
};

/**
 * Options for {@link waitForCondition}
 */
export interface WaitForConditionOptions {
  /** Maximum time to wait in milliseconds.
   * @default 5000
   */
  waitMs?: number;
  /** Interval in milliseconds between condition checks.
   * @default 500
   */
  intervalMs?: number;
  /** Optional logger object with a debug method for logging wait progress */
  logger?: {
    debug: (...args: any[]) => void;
  };
  /** Custom error message (string) or Error object to throw if condition is not met.
   * If not provided, a default error is thrown
   */
  error?: string | Error;
}
