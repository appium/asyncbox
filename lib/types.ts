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
