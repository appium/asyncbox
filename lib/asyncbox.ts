import B from 'bluebird';
import _ from 'lodash';
import type {LongSleepOptions, WaitForConditionOptions} from './types.js';

const LONG_SLEEP_THRESHOLD = 5000; // anything over 5000ms will turn into a spin

/**
 * An async/await version of setTimeout
 */
export async function sleep(ms: number): Promise<void> {
  return await B.delay(ms);
}

/**
 * Sometimes `Promise.delay` or `setTimeout` are inaccurate for large wait
 * times. To safely wait for these long times (e.g. in the 5+ minute range), you
 * can use `longSleep`.
 *
 * You can also pass a `progressCb` option which is a callback function that
 * receives an object with the properties `elapsedMs`, `timeLeft`, and
 * `progress`. This will be called on every wait interval so you can do your
 * wait logging or whatever.
 */
export async function longSleep(
  ms: number,
  {thresholdMs = LONG_SLEEP_THRESHOLD, intervalMs = 1000, progressCb = null}: LongSleepOptions = {},
): Promise<void> {
  if (ms < thresholdMs) {
    return await sleep(ms);
  }
  const endAt = Date.now() + ms;
  let timeLeft: number;
  let elapsedMs = 0;
  do {
    const pre = Date.now();
    await sleep(intervalMs);
    const post = Date.now();
    timeLeft = endAt - post;
    elapsedMs = elapsedMs + (post - pre);
    if (_.isFunction(progressCb)) {
      progressCb({elapsedMs, timeLeft, progress: elapsedMs / ms});
    }
  } while (timeLeft > 0);
}

/**
 * An async/await way of running a method until it doesn't throw an error
 */
export async function retry<T = any>(
  times: number,
  fn: (...args: any[]) => Promise<T>,
  ...args: any[]
): Promise<T | null> {
  let tries = 0;
  let done = false;
  let res: T | null = null;
  while (!done && tries < times) {
    tries++;
    try {
      res = await fn(...args);
      done = true;
    } catch (err) {
      if (tries >= times) {
        throw err;
      }
    }
  }
  return res;
}

/**
 * You can also use `retryInterval` to add a sleep in between retries. This can
 * be useful if you want to throttle how fast we retry.
 */
export async function retryInterval<T = any>(
  times: number,
  sleepMs: number,
  fn: (...args: any[]) => Promise<T>,
  ...args: any[]
): Promise<T | null> {
  let count = 0;
  const wrapped = async (): Promise<T> => {
    count++;
    let res: T;
    try {
      res = await fn(...args);
    } catch (e) {
      // do not pause when finished the last retry
      if (count !== times) {
        await sleep(sleepMs);
      }
      throw e;
    }
    return res;
  };
  return await retry(times, wrapped);
}

export const parallel = B.all;

/**
 * Export async functions (Promises) and import this with your ES5 code to use
 * it with Node.
 */
// eslint-disable-next-line promise/prefer-await-to-callbacks
export function nodeify<R = any>(promisey: any, cb: (err: any, value?: R) => void): Promise<R> {
  return B.resolve(promisey).nodeify(cb);
}

/**
 * Node-ify an entire object of `Promise`-returning functions
 */
export function nodeifyAll<T extends Record<string, (...args: any[]) => any>>(
  promiseyMap: T,
): Record<string, (...args: any[]) => void> {
  const cbMap: Record<string, (...args: any[]) => void> = {};
  for (const [name, fn] of _.toPairs(promiseyMap)) {
    cbMap[name] = function (...args: any[]) {
      const _cb = args.slice(-1)[0] as (err: any, ...values: any[]) => void;
      const fnArgs = args.slice(0, -1);
      nodeify(fn(...fnArgs), _cb);
    };
  }
  return cbMap;
}

/**
 * Fire and forget async function execution
 */
export function asyncify(fn: (...args: any[]) => any | Promise<any>, ...args: any[]): void {
  B.resolve(fn(...args)).done();
}

/**
 * Similar to `Array.prototype.map`; runs in serial or parallel
 */
export async function asyncmap<T, R>(
  coll: T[],
  mapper: (value: T) => R | Promise<R>,
  runInParallel = true,
): Promise<R[]> {
  if (runInParallel) {
    return parallel(coll.map(mapper));
  }

  const newColl: R[] = [];
  for (const item of coll) {
    newColl.push(await mapper(item));
  }
  return newColl;
}

/**
 * Similar to `Array.prototype.filter`
 */
export async function asyncfilter<T>(
  coll: T[],
  filter: (value: T) => boolean | Promise<boolean>,
  runInParallel = true,
): Promise<T[]> {
  const newColl: T[] = [];
  if (runInParallel) {
    const bools = await parallel(coll.map(filter));
    for (let i = 0; i < coll.length; i++) {
      if (bools[i]) {
        newColl.push(coll[i]);
      }
    }
  } else {
    for (const item of coll) {
      if (await filter(item)) {
        newColl.push(item);
      }
    }
  }
  return newColl;
}

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
 */
export async function waitForCondition<T>(
  condFn: () => Promise<T> | T,
  options: WaitForConditionOptions = {},
): Promise<T> {
  const opts: WaitForConditionOptions & {waitMs: number; intervalMs: number} = _.defaults(options, {
    waitMs: 5000,
    intervalMs: 500,
  });
  const debug = opts.logger ? opts.logger.debug.bind(opts.logger) : _.noop;
  const error = opts.error;
  const begunAt = Date.now();
  const endAt = begunAt + opts.waitMs;
  const spin = async function spin(): Promise<T> {
    const result = await condFn();
    if (result) {
      return result;
    }
    const now = Date.now();
    const waited = now - begunAt;
    const remainingTime = endAt - now;
    if (now < endAt) {
      debug(`Waited for ${waited} ms so far`);
      await B.delay(Math.min(opts.intervalMs, remainingTime));
      return await spin();
    }
    // if there is an error option, it is either a string message or an error itself
    throw error
      ? _.isString(error)
        ? new Error(error)
        : error
      : new Error(`Condition unmet after ${waited} ms. Timing out.`);
  };
  return await spin();
}
