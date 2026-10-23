import {sleep} from './sleep.js';
import type {WaitForConditionOptions} from './types.js';

/**
 * Takes a condition (a function returning a boolean or boolean promise), and
 * waits until the condition is true.
 *
 * Throws a `/Condition unmet/` error if the condition has not been satisfied
 * within the allocated time, unless an error is provided in the options, as the
 * `error` property, which is either thrown itself, or used as the message.
 *
 * The condition result is returned if it is not falsy. If the condition throws an
 * error then this exception will be immediately passed through.
 *
 * The default options are: `{ waitMs: 5000, intervalMs: 500 }`
 * @param condFn - The condition function to evaluate
 * @param options - Options for controlling the wait behavior
 */
export async function waitForCondition<T>(
  condFn: () => Promise<T> | T,
  options: WaitForConditionOptions = {},
): Promise<T> {
  const opts: WaitForConditionOptions & {waitMs: number; intervalMs: number} = {
    ...options,
    waitMs: typeof options.waitMs === 'number' ? options.waitMs : 5000,
    intervalMs: typeof options.intervalMs === 'number' ? options.intervalMs : 500,
  };
  const debug = opts.logger ? opts.logger.debug.bind(opts.logger) : () => undefined;
  const error = opts.error;
  const begunAt = performance.now();
  const endAt = begunAt + opts.waitMs;
  const spin = async function spin(): Promise<T> {
    const result = await condFn();
    if (result) {
      return result;
    }
    const now = performance.now();
    const waited = Math.round(now - begunAt);
    const remainingTime = endAt - now;
    if (now < endAt) {
      debug(`Waited for ${waited} ms so far`);
      await sleep(Math.min(opts.intervalMs, remainingTime));
      return await spin();
    }
    // if there is an error option, it is either a string message or an error itself
    if (error) {
      throw typeof error === 'string' ? new Error(error) : error;
    }
    throw new Error(`Condition unmet after ${waited} ms. Timing out.`);
  };
  return await spin();
}
