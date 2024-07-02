import B from 'bluebird';

const LONG_SLEEP_THRESHOLD = 5000; // anything over 5000ms will turn into a spin

/**
 * An async/await version of setTimeout
 * @param {number} ms
 * @returns {Promise<void>}
 */
async function sleep (ms) {
  return await B.delay(ms);
}

/**
 * Sometimes `Promise.delay` or `setTimeout` are inaccurate for large wait
 * times. To safely wait for these long times (e.g. in the 5+ minute range), you
 * can use `longSleep`.
 *
 * sYou can also pass a `progressCb` option which is a callback function that
 * receives an object with the properties `elapsedMs`, `timeLeft`, and
 * `progress`. This will be called on every wait interval so you can do your
 * wait logging or whatever.
 * @param {number} ms
 * @param {LongSleepOptions} [opts]
 * @returns {Promise<void>}
 */
async function longSleep (ms, {
  thresholdMs = LONG_SLEEP_THRESHOLD,
  intervalMs = 1000,
  progressCb = null,
} = {}) {
  if (ms < thresholdMs) {
    return await sleep(ms);
  }
  const endAt = Date.now() + ms;
  let timeLeft;
  let elapsedMs = 0;
  do {
    const pre = Date.now();
    await sleep(intervalMs);
    const post = Date.now();
    timeLeft = endAt - post;
    elapsedMs = elapsedMs + (post - pre);
    if (typeof progressCb === 'function') {
      progressCb({elapsedMs, timeLeft, progress: elapsedMs / ms});
    }
  } while (timeLeft > 0);
}

/**
 * An async/await way of running a method until it doesn't throw an error
 * @template [T=any]
 * @param {number} times
 * @param {(...args: any[]) => Promise<T>} fn
 * @param  {...any} args
 * @returns {Promise<T?>}
 */
async function retry (times, fn, ...args) {
  let tries = 0;
  let done = false;
  let res = null;
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
 * @template [T=any]
 * @param {number} times
 * @param {number} sleepMs
 * @param {(...args: any[]) => Promise<T>} fn
 * @param  {...any} args
 * @returns {Promise<T?>}
 */
async function retryInterval (times, sleepMs, fn, ...args) {
  let count = 0;
  let wrapped = async () => {
    count++;
    let res;
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

const parallel = B.all;

/**
 * Export async functions (Promises) and import this with your ES5 code to use
 * it with Node.
 * @template [R=any]
 * @param {any} promisey
 * @param {(err: any, value?: R) => void} cb
 * @returns {Promise<R>}
 */
function nodeify (promisey, cb) { // eslint-disable-line promise/prefer-await-to-callbacks
  return B.resolve(promisey).nodeify(cb);
}

/**
 * Node-ify an entire object of `Promise`-returning functions
 * @param {Record<string,(...args: any[]) => any>} promiseyMap
 * @returns {Record<string,(...args: any[])=>void>}
 */
function nodeifyAll (promiseyMap) {
  /** @type {Record<string,(...args: any[])=>void>} */
  let cbMap = {};
  for (const [name, fn] of Object.entries(promiseyMap)) {
    cbMap[name] = function (...args) {
      const _cb = args.slice(-1)[0];
      args = args.slice(0, -1);
      nodeify(fn(...args), _cb);
    };
  }
  return cbMap;
}

/**
 * @param {(...args: any[]) => any|Promise<any>} fn
 * @param  {...any} args
 */
function asyncify (fn, ...args) {
  B.resolve(fn(...args)).done();
}

/**
 * Similar to `Array.prototype.map`; runs in serial
 * @param {any[]} coll
 * @param {(value: any) => any|Promise<any>} mapper
 * @returns {Promise<any[]>}
 */
async function asyncmap (coll, mapper, runInParallel = true) {
  if (runInParallel) {
    return parallel(coll.map(mapper));
  }

  let newColl = [];
  for (let item of coll) {
    newColl.push(await mapper(item));
  }
  return newColl;
}

/**
 * Similar to `Array.prototype.filter`
 * @param {any[]} coll
 * @param {(value: any) => any|Promise<any>} filter
 * @param {boolean} runInParallel
 * @returns {Promise<any[]>}
 */
async function asyncfilter (coll, filter, runInParallel = true) {
  let newColl = [];
  if (runInParallel) {
    let bools = await parallel(coll.map(filter));
    for (let i = 0; i < coll.length; i++) {
      if (bools[i]) {
        newColl.push(coll[i]);
      }
    }
  } else {
    for (let item of coll) {
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
 * @template T
 * @param {() => Promise<T>|T} condFn
 * @param {WaitForConditionOptions} [options]
 * @returns {Promise<T>}
 */
async function waitForCondition (condFn, options = {}) {
  /** @type {WaitForConditionOptions & {waitMs: number, intervalMs: number}} */
  const opts = {
    waitMs: 5000,
    intervalMs: 500,
    ...options
  };
  const debug = opts.logger ? opts.logger.debug.bind(opts.logger) : () => undefined;
  const error = opts.error;
  const begunAt = Date.now();
  const endAt = begunAt + opts.waitMs;
  /** @returns {Promise<T>} */
  const spin = async function spin () {
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
      ? (typeof error === 'string' ? new Error(error) : error)
      : new Error(`Condition unmet after ${waited} ms. Timing out.`);
  };
  return await spin();
}

export {
  sleep, retry, nodeify, nodeifyAll, retryInterval, asyncify, parallel,
  asyncmap, asyncfilter, waitForCondition, longSleep,
};

/**
 * Options for {@link waitForCondition}
 * @typedef WaitForConditionOptions
 * @property {number} [waitMs]
 * @property {number} [intervalMs]
 * @property {{debug: (...args: any[]) => void}} [logger]
 * @property {string|Error} [error]
 */

/**
 * Options for {@link longSleep}
 * @typedef LongSleepOptions
 * @property {number} [thresholdMs]
 * @property {number} [intervalMs]
 * @property {ProgressCallback?} [progressCb]
 */

/**
 * Parameter provided to a {@link ProgressCallback}
 * @typedef Progress
 * @property {number} elapsedMs
 * @property {number} timeLeft
 * @property {number} progress
 */

/**
 * Progress callback for {@link longSleep}
 * @callback ProgressCallback
 * @param {Progress} progress
 * @returns {void}
 */
