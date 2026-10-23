import {getLimitFunction} from './limit-function.js';
import type {MapFilterOptions} from './types.js';

/**
 * Similar to `Array.prototype.filter`; runs in parallel, serial, or with custom concurrency pool
 * @param coll - The collection to filter
 * @param filter - The function to test each element
 * @param options - Options for controlling parallelism (default: true - fully parallel)
 */
export async function asyncfilter<T>(
  coll: T[],
  filter: (value: T) => boolean | Promise<boolean>,
  options: MapFilterOptions = true,
): Promise<T[]> {
  if (options === null) {
    throw new Error('Options cannot be null');
  }
  // limitFunction requires the filter to always return a promise
  const filterAsync = async (value: T): Promise<boolean> => filter(value);
  if (options === false) {
    return coll.reduce<Promise<T[]>>(async (accP, item) => {
      const acc = await accP;
      if (await filterAsync(item)) {
        acc.push(item);
      }
      return acc;
    }, Promise.resolve([]));
  }
  const adjustedFilter =
    options === true ? filterAsync : (await getLimitFunction())(filterAsync, {concurrency: options.concurrency});
  const bools = await Promise.all(coll.map(adjustedFilter));
  return coll.reduce<T[]>((acc, item, i) => {
    if (bools[i]) {
      acc.push(item);
    }
    return acc;
  }, []);
}
