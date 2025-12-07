/**
 * Parameter provided to a progress callback
 */
export interface Progress {
  elapsedMs: number;
  timeLeft: number;
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
  thresholdMs?: number;
  intervalMs?: number;
  progressCb?: ProgressCallback | null;
}

/**
 * Options for {@link waitForCondition}
 */
export interface WaitForConditionOptions {
  waitMs?: number;
  intervalMs?: number;
  logger?: {
    debug: (...args: any[]) => void;
  };
  error?: string | Error;
}
