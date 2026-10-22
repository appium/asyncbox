import {sleep} from './sleep.js';
import type {LongSleepOptions} from './types.js';

const LONG_SLEEP_THRESHOLD = 5000; // anything over 5000ms will turn into a spin

/**
 * Sometimes `Promise.delay` or `setTimeout` are inaccurate for large wait
 * times. To safely wait for these long times (e.g. in the 5+ minute range), you
 * can use `longSleep`.
 *
 * You can also pass a `progressCb` option which is a callback function that
 * receives an object with the properties `elapsedMs`, `timeLeft`, and
 * `progress`. This will be called on every wait interval so you can do your
 * wait logging or whatever.
 * @param ms - The number of milliseconds to wait
 * @param options - Options for controlling the long sleep behavior
 */
export async function longSleep(
  ms: number,
  {thresholdMs = LONG_SLEEP_THRESHOLD, intervalMs = 1000, progressCb = null}: LongSleepOptions = {},
): Promise<void> {
  if (ms < thresholdMs) {
    return await sleep(ms);
  }
  const endAt = performance.now() + ms;
  let timeLeft: number;
  let elapsedMs = 0;
  do {
    const pre = performance.now();
    await sleep(intervalMs);
    const post = performance.now();
    timeLeft = endAt - post;
    elapsedMs = elapsedMs + (post - pre);
    if (typeof progressCb === 'function') {
      progressCb({elapsedMs: Math.round(elapsedMs), timeLeft: Math.round(timeLeft), progress: elapsedMs / ms});
    }
  } while (timeLeft > 0);
}
