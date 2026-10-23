import {sleep} from './sleep.js';

/**
 * An async/await way of running a method until it doesn't throw an error
 * @param times - The maximum number of times to retry the function
 * @param fn - The async function to retry
 * @param args - Arguments to pass to the function
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
 * @param times - The maximum number of times to retry the function
 * @param sleepMs - The number of milliseconds to wait between retries
 * @param fn - The async function to retry
 * @param args - Arguments to pass to the function
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
